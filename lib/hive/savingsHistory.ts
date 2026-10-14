import type { SavingsEvent } from "@/lib/wallet/yieldSeries";

// Browser-reachable (CORS) nodes, tried in order.
const HIVE_NODES = ["https://api.hive.blog", "https://api.deathwing.me", "https://api.openhive.network"];
const HBD_NAI = "@@000000013";
const PAGE = 1000;
/** Hard stop so a pathological account can't loop forever. */
const MAX_PAGES = 20;

// account_history_api filter bits: transfer_to_savings (32), interest (55),
// fill_transfer_from_savings (59). The mask exceeds 2^53, so it is written
// into the JSON body as a BigInt literal — a JS number (and therefore the
// /api/hive proxy, which re-serialises) would lose the bits.
const FILTER_LOW = ((1n << 32n) | (1n << 55n) | (1n << 59n)).toString();

interface NaiAsset {
  nai: string;
  amount: string;
  precision: number;
}

const naiToNumber = (a: NaiAsset) => Number(a.amount) / 10 ** a.precision;

/** POST a raw JSON-RPC body, falling through the node list. */
async function hiveRpc(body: string): Promise<any> {
  let lastError: unknown;
  for (const node of HIVE_NODES) {
    try {
      const res = await fetch(node, { method: "POST", headers: { "content-type": "application/json" }, body });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json?.error) throw new Error(json.error.message ?? "rpc error");
      return json.result;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

/**
 * Every HBD savings deposit, withdrawal and interest payment of an account,
 * oldest first. Pages back through the full history — a truncated window
 * would drop old deposits and show the difference as fake "earnings".
 * Returns null on RPC failure (unknown, never "no history").
 */
export async function fetchHbdSavingsEvents(account: string): Promise<SavingsEvent[] | null> {
  try {
    const events: SavingsEvent[] = [];
    let start = -1;
    for (let page = 0; page < MAX_PAGES; page++) {
      const body = `{"jsonrpc":"2.0","id":1,"method":"account_history_api.get_account_history","params":{"account":${JSON.stringify(
        account,
      )},"start":${start},"limit":${PAGE},"operation_filter_low":${FILTER_LOW},"operation_filter_high":0}}`;
      const history = (await hiveRpc(body))?.history;
      if (!Array.isArray(history)) return null;

      for (const [, entry] of history) {
        const { type, value } = entry.op;
        const t = Math.floor(new Date(entry.timestamp + "Z").getTime() / 1000);
        if (type === "transfer_to_savings_operation") {
          if (value.to !== account || value.amount.nai !== HBD_NAI) continue;
          events.push({ t, kind: "deposit", amount: naiToNumber(value.amount) });
        } else if (type === "fill_transfer_from_savings_operation") {
          if (value.from !== account || value.amount.nai !== HBD_NAI) continue;
          events.push({ t, kind: "withdraw", amount: naiToNumber(value.amount) });
        } else if (type === "interest_operation") {
          // is_saved_into_hbd_balance=true is interest on liquid HBD, not savings.
          if (value.owner !== account || value.is_saved_into_hbd_balance) continue;
          events.push({ t, kind: "interest", amount: naiToNumber(value.interest) });
        }
      }

      // `limit` counts matching ops; a short page means we reached the start.
      const oldest = history[0]?.[0];
      if (history.length < PAGE || typeof oldest !== "number" || oldest <= 0) break;
      start = oldest - 1;
    }
    return events.sort((a, b) => a.t - b.t);
  } catch {
    return null;
  }
}

/** Current HBD savings APR set by the witnesses (e.g. 0.10), or null. */
export async function fetchHbdInterestRate(): Promise<number | null> {
  try {
    const result = await hiveRpc(
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "condenser_api.get_dynamic_global_properties", params: [] }),
    );
    const bps = Number(result?.hbd_interest_rate);
    return Number.isFinite(bps) ? bps / 10_000 : null;
  } catch {
    return null;
  }
}
