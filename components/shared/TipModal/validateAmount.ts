// Strict on purpose: parseFloat("1abc") is 1, which would slip past a loose
// check and reach viem's parseUnits (Base tab) with the untouched string —
// parseUnits throws on anything that isn't a clean decimal, uncaught.
const AMOUNT_PATTERN = /^\d+(\.\d+)?$/;

export function isValidAmount(value: string): boolean {
  const trimmed = value.trim();
  if (!AMOUNT_PATTERN.test(trimmed)) return false;
  return parseFloat(trimmed) > 0;
}
