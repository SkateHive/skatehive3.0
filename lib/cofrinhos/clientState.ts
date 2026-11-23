/**
 * Pure helpers for the savings-jars client (hooks/wallet/useSavingsJars.ts),
 * kept free of React so they can be unit-tested.
 */

import { formatUnits, parseUnits } from "viem";

export type JarCurrency = "HBD" | "USDC";

/** Jar amounts are stored with 3 decimals (numeric(12,3)). */
const JAR_DECIMALS = 3;
const USDC_DECIMALS = 6;

interface JarLike {
  currency: JarCurrency;
  hive_account: string | null;
  evm_address: string | null;
}

interface JarsResponse<J extends JarLike, B> {
  account?: string | null;
  evm_address?: string | null;
  jars?: J[];
  balances?: Partial<Record<JarCurrency, B>>;
}

/**
 * Keep only what belongs to the identities connected right now. The session
 * cookies can outlive an account or wallet switch; `staleHive` / `staleEvm`
 * tell the caller which session to clear instead of showing someone else's jars.
 */
export function selectOwnJars<J extends JarLike, B>(
  data: JarsResponse<J, B>,
  hiveUser: string | null,
  evmAddress: string | null
): {
  jars: J[];
  balances: Partial<Record<JarCurrency, B>>;
  hiveOk: boolean;
  evmOk: boolean;
  staleHive: boolean;
  staleEvm: boolean;
} {
  const hiveOk = !!data.account && data.account === hiveUser;
  const evmOk = !!data.evm_address && data.evm_address === evmAddress;
  const jars = (data.jars ?? []).filter((jar) =>
    jar.currency === "USDC"
      ? evmOk && jar.evm_address === evmAddress
      : hiveOk && jar.hive_account === hiveUser
  );
  const balances: Partial<Record<JarCurrency, B>> = {};
  if (hiveOk && data.balances?.HBD) balances.HBD = data.balances.HBD;
  if (evmOk && data.balances?.USDC) balances.USDC = data.balances.USDC;
  return {
    jars,
    balances,
    hiveOk,
    evmOk,
    staleHive: !!data.account && !hiveOk,
    staleEvm: !!data.evm_address && !evmOk,
  };
}

/** A jar amount (3 decimals) in USDC base units (6 decimals). */
export function toUsdcUnits(amount: number): bigint {
  return parseUnits(amount.toFixed(JAR_DECIMALS), USDC_DECIMALS);
}

/**
 * USDC base units floored to the jar precision, so "max" never offers more
 * than is really there (rounding up would fail the vault call or the API's
 * balance check).
 */
export function usdcUnitsToJarAmount(units: bigint | undefined): number {
  if (units == null || units <= 0n) return 0;
  const step = 10n ** BigInt(USDC_DECIMALS - JAR_DECIMALS);
  return Number(formatUnits((units / step) * step, USDC_DECIMALS));
}
