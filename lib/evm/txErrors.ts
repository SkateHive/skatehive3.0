import { UserRejectedRequestError } from "viem";

/** True when the user closed/rejected the wallet prompt (not a real failure). */
export function isUserRejection(e: unknown): boolean {
  if (e instanceof UserRejectedRequestError) return true;
  const text = `${(e as { shortMessage?: string })?.shortMessage ?? ""} ${(e as { message?: string })?.message ?? ""}`.toLowerCase();
  return text.includes("user denied") || text.includes("user rejected");
}

/** viem's shortMessage instead of the raw message that contains hex calldata. */
export function friendlyError(e: unknown): string {
  return (
    (e as { shortMessage?: string })?.shortMessage ||
    (e instanceof Error ? e.message : null) ||
    "Unknown error"
  );
}

/**
 * True when the failure is the RPC transport (node down, rate-limited,
 * timeout) rather than the contract reverting. A transport failure in a
 * pre-flight simulation must not block the user's transaction.
 */
export function isTransportError(e: unknown): boolean {
  const names: string[] = [];
  for (let c: unknown = e; c && names.length < 6; c = (c as { cause?: unknown }).cause) names.push((c as { name?: string }).name ?? "");
  return names.some((n) => /HttpRequestError|TimeoutError|RpcRequestError|TransportError/.test(n));
}
