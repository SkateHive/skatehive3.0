/**
 * Who owns a cofrinho, and in which currency.
 *
 * The owner kind fixes the currency (enforced by the
 * userbase_savings_jars_owner_currency constraint, sql/migrations/0045):
 *   Hive account -> HBD,  backed by the account's HBD savings
 *   EVM address  -> USDC, backed by the address's Morpho USDC position
 *
 * `owner_key` is the single column every query scopes by.
 */

export type JarCurrency = "HBD" | "USDC";

export type JarOwner =
  | { kind: "hive"; account: string }
  | { kind: "evm"; address: string };

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Lowercased 0x address, or null when it is not a 20-byte hex address. */
export function normalizeEvmAddress(value: unknown): string | null {
  const address = String(value ?? "").trim();
  return EVM_ADDRESS_RE.test(address) ? address.toLowerCase() : null;
}

export function hiveOwner(account: string): JarOwner {
  return { kind: "hive", account: account.toLowerCase() };
}

export function evmOwner(address: string): JarOwner {
  return { kind: "evm", address: address.toLowerCase() };
}

/** Matches the generated owner_key column. */
export function ownerKey(owner: JarOwner): string {
  return owner.kind === "hive" ? `hive:${owner.account}` : `evm:${owner.address}`;
}

export function ownerCurrency(owner: JarOwner): JarCurrency {
  return owner.kind === "hive" ? "HBD" : "USDC";
}

/** Owner columns for an insert into the jars / events / challenges tables. */
export function ownerColumns(owner: JarOwner): {
  hive_account: string | null;
  evm_address: string | null;
} {
  return owner.kind === "hive"
    ? { hive_account: owner.account, evm_address: null }
    : { hive_account: null, evm_address: owner.address };
}

/** The owner among `owners` that holds jars in `currency`, if any. */
export function ownerForCurrency(
  owners: JarOwner[],
  currency: JarCurrency
): JarOwner | undefined {
  return owners.find((o) => ownerCurrency(o) === currency);
}

export function parseCurrency(value: unknown): JarCurrency | null {
  if (value === undefined || value === null || value === "") return "HBD";
  const c = String(value).toUpperCase();
  return c === "HBD" || c === "USDC" ? c : null;
}
