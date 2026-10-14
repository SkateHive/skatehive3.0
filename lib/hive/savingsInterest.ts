/**
 * HBD savings interest, computed the way the chain does it.
 *
 * The chain accumulates `savings_hbd_seconds` (balance in milli-HBD × seconds)
 * and pays `hbd_seconds × rate / 1 year` on the first savings operation at
 * least 30 days after the last payment. So the accrued amount is
 *   (savings_hbd_seconds / 1000 + balance × (now − seconds_last_update)) × rate / year
 * — NOT balance × days-since-last-payment. An account that never received
 * interest has last_interest_payment = 1970-01-01, which the naive formula
 * turned into ~56 years of interest.
 */

const YEAR = 365 * 86_400;
export const INTEREST_INTERVAL_SEC = 30 * 86_400;

/** Hive timestamps are UTC without a "Z". Epoch/placeholder dates → null. */
export function parseHiveTime(value?: string | null): number | null {
  if (!value) return null;
  const ms = new Date(value.endsWith("Z") ? value : value + "Z").getTime();
  // 1970-01-01T00:00:00 is the chain's "never".
  return Number.isFinite(ms) && ms > 86_400_000 ? Math.floor(ms / 1000) : null;
}

export interface SavingsAccountFields {
  savings_hbd_balance?: string | number;
  savings_hbd_seconds?: string | number;
  savings_hbd_seconds_last_update?: string;
  savings_hbd_last_interest_payment?: string;
}

export function estimateSavingsInterest(acc: SavingsAccountFields, rate: number, now = Math.floor(Date.now() / 1000)) {
  const balance = parseFloat(String(acc.savings_hbd_balance ?? "0")) || 0;
  const storedSeconds = Number(acc.savings_hbd_seconds ?? 0) / 1000;
  const lastUpdate = parseHiveTime(acc.savings_hbd_seconds_last_update);
  const lastPayment = parseHiveTime(acc.savings_hbd_last_interest_payment);
  const hbdSeconds = storedSeconds + (lastUpdate != null ? balance * Math.max(0, now - lastUpdate) : 0);
  const accrued = (hbdSeconds * rate) / YEAR;
  const nextEligible = lastPayment != null ? lastPayment + INTEREST_INTERVAL_SEC : now;
  return {
    balance,
    accrued,
    lastPayment,
    daysUntilClaim: Math.max(0, Math.ceil((nextEligible - now) / 86_400)),
  };
}
