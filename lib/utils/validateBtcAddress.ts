/**
 * Lightweight Bitcoin address validation for self-claimed profile addresses.
 *
 * This is a format check, NOT proof of ownership — SkateHive stores the BTC
 * address the user types (Hive metadata + userbase DB) without a signature
 * challenge. The goal is to reject obvious mistakes (EVM addresses, typos),
 * not to guarantee the address is spendable.
 *
 * Supported formats:
 *   - Legacy P2PKH  — base58, starts with `1`
 *   - P2SH          — base58, starts with `3`
 *   - SegWit/Taproot — bech32 / bech32m, starts with `bc1`
 */

// base58 alphabet excludes 0, O, I, l
const BASE58_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,39}$/;
// bech32 data part is [a-z0-9]; lenient on length (P2WPKH ~42, taproot ~62 chars)
const BECH32_RE = /^bc1[a-z0-9]{8,87}$/;

/**
 * Normalize an address for storage/validation. Bech32 addresses are
 * case-insensitive (but must not be mixed-case per spec); users almost always
 * paste lowercase, so we lowercase a `bc1`/`BC1` prefix. Base58 is
 * case-sensitive and is left untouched.
 */
export function normalizeBtcAddress(input: string): string {
  const trimmed = (input || "").trim();
  if (/^bc1/i.test(trimmed)) return trimmed.toLowerCase();
  return trimmed;
}

export function validateBtcAddress(input: string): boolean {
  const addr = normalizeBtcAddress(input);
  if (!addr) return false;
  return BASE58_RE.test(addr) || BECH32_RE.test(addr);
}
