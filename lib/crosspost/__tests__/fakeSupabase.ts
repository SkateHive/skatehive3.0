/**
 * Minimal in-memory stand-in for the supabase-js query builder.
 *
 * Deliberately NOT a mock that records calls: the things worth testing in the
 * cross-post queue are the DATABASE guarantees — the partial unique index that
 * makes dedupe work, and the compare-and-swap that stops two curators from
 * double-posting. Asserting on mock calls would prove nothing about either, so
 * this fake actually enforces them.
 *
 * What it models:
 *   - insert / upsert / select / update with eq, in, is, gte filters
 *   - order, limit, range, single()
 *   - { count: "exact", head: true }
 *   - UNIQUE constraints, including PARTIAL ones (index WHERE clause) and
 *     Postgres' NULLS-DISTINCT rule — a NULL column never collides.
 *
 * What it does NOT model: joins, RLS, transactions, jsonb operators. Anything
 * needing those has to be verified against a real Postgres.
 */

export type Row = Record<string, any>;

export interface UniqueConstraint {
  /** Columns that together must be unique. */
  columns: string[];
  /** Partial-index predicate. Rows failing it are exempt from the constraint. */
  where?: (row: Row) => boolean;
  name?: string;
}

interface Filter {
  (row: Row): boolean;
}

export interface FakeDb {
  tables: Record<string, Row[]>;
  /** Rows inserted get an auto id when they don't carry one. */
  nextId: () => string;
}

class FakeQuery implements PromiseLike<any> {
  private filters: Filter[] = [];
  private selectRequested = false;
  private countMode: "exact" | null = null;
  private headOnly = false;
  private singleMode = false;
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitN: number | null = null;
  private rangeBounds: [number, number] | null = null;

  constructor(
    private db: FakeDb,
    private uniques: Record<string, UniqueConstraint[]>,
    private table: string,
    private mode: "select" | "insert" | "update" | "upsert",
    private payload?: Row | Row[],
    private upsertOnConflict?: string[]
  ) {}

  // ── filters ────────────────────────────────────────────────────────
  eq(column: string, value: any) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  in(column: string, values: any[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }
  is(column: string, value: any) {
    this.filters.push((row) => (row[column] ?? null) === value);
    return this;
  }
  gte(column: string, value: any) {
    this.filters.push((row) => String(row[column]) >= String(value));
    return this;
  }

  // ── shaping ────────────────────────────────────────────────────────
  select(_columns?: string, options?: { count?: "exact"; head?: boolean }) {
    this.selectRequested = true;
    if (options?.count) this.countMode = options.count;
    if (options?.head) this.headOnly = true;
    return this;
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  range(from: number, to: number) {
    this.rangeBounds = [from, to];
    return this;
  }
  single() {
    this.singleMode = true;
    return this;
  }

  // ── execution ──────────────────────────────────────────────────────
  private rows(): Row[] {
    if (!this.db.tables[this.table]) this.db.tables[this.table] = [];
    return this.db.tables[this.table];
  }

  private matching(): Row[] {
    return this.rows().filter((row) => this.filters.every((f) => f(row)));
  }

  /**
   * Postgres semantics: a unique index ignores rows where any indexed column
   * is NULL, and a PARTIAL index only covers rows satisfying its predicate.
   */
  private violatesUnique(candidate: Row, ignore?: Row): UniqueConstraint | null {
    for (const uq of this.uniques[this.table] ?? []) {
      if (uq.where && !uq.where(candidate)) continue;
      const values = uq.columns.map((c) => candidate[c] ?? null);
      if (values.some((v) => v === null)) continue; // NULLS DISTINCT
      const clash = this.rows().some((row) => {
        if (row === ignore) return false;
        if (uq.where && !uq.where(row)) return false;
        return uq.columns.every((c, i) => (row[c] ?? null) === values[i]);
      });
      if (clash) return uq;
    }
    return null;
  }

  private uniqueError(uq: UniqueConstraint) {
    return {
      code: "23505",
      message: `duplicate key value violates unique constraint "${
        uq.name ?? uq.columns.join("_")
      }"`,
    };
  }

  private shape(result: Row[]) {
    let out = [...result];
    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      out.sort((a, b) => {
        const av = String(a[column] ?? "");
        const bv = String(b[column] ?? "");
        return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    const total = out.length;
    if (this.rangeBounds) out = out.slice(this.rangeBounds[0], this.rangeBounds[1] + 1);
    if (this.limitN !== null) out = out.slice(0, this.limitN);
    return { out, total };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute() {
    switch (this.mode) {
      case "insert": {
        const incoming = Array.isArray(this.payload) ? this.payload : [this.payload!];
        const created: Row[] = [];
        for (const raw of incoming) {
          const row: Row = { id: raw.id ?? this.db.nextId(), ...raw };
          if (!row.created_at) row.created_at = new Date().toISOString();
          if (!row.updated_at) row.updated_at = row.created_at;
          const uq = this.violatesUnique(row);
          if (uq) return { data: null, error: this.uniqueError(uq), count: null };
          this.rows().push(row);
          created.push(row);
        }
        if (!this.selectRequested) return { data: null, error: null, count: null };
        return {
          data: this.singleMode ? created[0] : created,
          error: null,
          count: null,
        };
      }

      case "upsert": {
        const incoming = Array.isArray(this.payload) ? this.payload : [this.payload!];
        const written: Row[] = [];
        for (const raw of incoming) {
          const keys = this.upsertOnConflict ?? ["id"];
          const existing = this.rows().find((row) =>
            keys.every((k) => (row[k] ?? null) === (raw[k] ?? null))
          );
          if (existing) {
            Object.assign(existing, raw);
            written.push(existing);
          } else {
            const row: Row = { id: raw.id ?? this.db.nextId(), ...raw };
            if (!row.created_at) row.created_at = new Date().toISOString();
            const uq = this.violatesUnique(row);
            if (uq) return { data: null, error: this.uniqueError(uq), count: null };
            this.rows().push(row);
            written.push(row);
          }
        }
        if (!this.selectRequested) return { data: null, error: null, count: null };
        return { data: this.singleMode ? written[0] : written, error: null, count: null };
      }

      case "update": {
        const targets = this.matching();
        const updated: Row[] = [];
        for (const row of targets) {
          const candidate = { ...row, ...(this.payload as Row) };
          const uq = this.violatesUnique(candidate, row);
          if (uq) return { data: null, error: this.uniqueError(uq), count: null };
          Object.assign(row, this.payload as Row);
          updated.push(row);
        }
        const { out } = this.shape(updated);
        if (!this.selectRequested) return { data: null, error: null, count: null };
        return {
          data: this.singleMode ? out[0] ?? null : out,
          error: null,
          count: null,
        };
      }

      case "select":
      default: {
        const { out, total } = this.shape(this.matching());
        if (this.headOnly) {
          return { data: null, error: null, count: this.countMode ? total : null };
        }
        return {
          data: this.singleMode ? out[0] ?? null : out,
          error: null,
          count: this.countMode ? total : null,
        };
      }
    }
  }
}

export function createFakeSupabase(config: {
  tables?: Record<string, Row[]>;
  uniques?: Record<string, UniqueConstraint[]>;
}) {
  let counter = 0;
  const db: FakeDb = {
    tables: config.tables ?? {},
    nextId: () => `row-${++counter}`,
  };
  const uniques = config.uniques ?? {};

  const client = {
    db,
    from(table: string) {
      return {
        select: (columns?: string, options?: { count?: "exact"; head?: boolean }) =>
          new FakeQuery(db, uniques, table, "select").select(columns, options),
        insert: (payload: Row | Row[]) =>
          new FakeQuery(db, uniques, table, "insert", payload),
        update: (payload: Row) => new FakeQuery(db, uniques, table, "update", payload),
        upsert: (payload: Row | Row[], options?: { onConflict?: string }) =>
          new FakeQuery(
            db,
            uniques,
            table,
            "upsert",
            payload,
            options?.onConflict?.split(",").map((c) => c.trim())
          ),
      };
    },
  };
  return client;
}

/**
 * The constraints from migrations 0029 / 0021 that this code depends on.
 * Kept next to the fake so a schema change that breaks dedupe shows up as a
 * failing test rather than a production duplicate.
 */
export const ACTIVE_STATUSES = ["pending_review", "approved", "publishing", "published"];

export const QUEUE_UNIQUES: Record<string, UniqueConstraint[]> = {
  userbase_crosspost_queue: [
    {
      name: "userbase_crosspost_queue_active_uniq",
      columns: ["target", "hive_author", "hive_permlink"],
      where: (row) => ACTIVE_STATUSES.includes(row.status),
    },
  ],
  userbase_instagram_posts: [
    {
      name: "userbase_instagram_posts_author_permlink_uniq",
      columns: ["hive_author", "hive_permlink"],
    },
  ],
};
