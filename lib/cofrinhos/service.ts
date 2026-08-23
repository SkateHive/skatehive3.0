import fetchAccount from "@/lib/hive/fetchAccount";
import type { SavingsJarInput, SavingsJarRow } from "./supabase";

/** Parse a Hive asset string/number like "12.345 HBD" into a number. */
export function parseHbdAmount(value: unknown): number {
  if (typeof value === "number") return value;
  const n = parseFloat(String(value ?? "0").split(" ")[0]);
  return Number.isFinite(n) ? n : 0;
}

/** Round to Hive's 3-decimal precision. */
export function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

/** Read the on-chain HBD savings balance for an account. */
export async function getOnChainHbdSavings(account: string): Promise<number> {
  const { account: acc } = await fetchAccount(account.toLowerCase());
  return parseHbdAmount((acc as any).savings_hbd_balance);
}

export interface JarsSummary {
  allocated_total: number;
  /** Savings not yet assigned to any money-backed jar (can be negative on drift). */
  unallocated: number;
  /** True when jars claim more than the on-chain savings balance. */
  over_allocated: boolean;
}

/** Compute the allocation summary for a set of jars against the savings balance. */
export function summarize(
  jars: Pick<SavingsJarRow, "allocated_hbd" | "is_wishlist">[],
  onChainSavings: number
): JarsSummary {
  const allocated_total = round3(
    jars.reduce((s, j) => s + (j.is_wishlist ? 0 : Number(j.allocated_hbd || 0)), 0)
  );
  return {
    allocated_total,
    unallocated: round3(onChainSavings - allocated_total),
    over_allocated: allocated_total > onChainSavings + 1e-6,
  };
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ValidationResult {
  ok: boolean;
  error?: string;
  value: SavingsJarInput;
}

/**
 * Validate and normalize client-supplied jar fields. `partial` allows omitting
 * fields (for PATCH); when false, `name` is required (for create).
 */
export function validateJarInput(body: any, partial: boolean): ValidationResult {
  const value: SavingsJarInput = {};

  if (body?.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 1 || name.length > 60) {
      return { ok: false, error: "Name must be 1–60 characters", value };
    }
    value.name = name;
  } else if (!partial) {
    return { ok: false, error: "Name is required", value };
  }

  if (body?.target_hbd !== undefined && body.target_hbd !== null) {
    const target = Number(body.target_hbd);
    if (!Number.isFinite(target) || target <= 0) {
      return { ok: false, error: "Target must be a positive number", value };
    }
    value.target_hbd = round3(target);
  } else if (body?.target_hbd === null) {
    value.target_hbd = null;
  }

  if (body?.deadline !== undefined && body.deadline !== null) {
    const deadline = String(body.deadline);
    if (!DATE_RE.test(deadline) || Number.isNaN(Date.parse(deadline))) {
      return { ok: false, error: "Deadline must be YYYY-MM-DD", value };
    }
    value.deadline = deadline;
  } else if (body?.deadline === null) {
    value.deadline = null;
  }

  if (body?.icon !== undefined) {
    const icon = String(body.icon).trim();
    if (icon.length > 8) {
      return { ok: false, error: "Invalid icon", value };
    }
    value.icon = icon || "🐷";
  }

  if (body?.color !== undefined) {
    const color = String(body.color).trim();
    if (!HEX_COLOR_RE.test(color)) {
      return { ok: false, error: "Color must be a #rrggbb hex value", value };
    }
    value.color = color;
  }

  if (body?.is_wishlist !== undefined) {
    value.is_wishlist = Boolean(body.is_wishlist);
  }

  if (body?.sort_order !== undefined) {
    const order = Number(body.sort_order);
    if (!Number.isInteger(order) || order < 0) {
      return { ok: false, error: "Invalid sort order", value };
    }
    value.sort_order = order;
  }

  return { ok: true, value };
}
