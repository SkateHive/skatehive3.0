/**
 * LI.FI bridge configuration and response types.
 *
 * The quote/status calls are proxied through our own API routes so the API key
 * stays server-side and the integrator fee is injected consistently. Fees are
 * only added when `LIFI_INTEGRATOR` is configured (see app/api/lifi/*).
 */

export const LIFI_API_URL = "https://li.quest/v1";

/** LI.FI represents a native coin (ETH, etc.) with the zero address. */
export const LIFI_NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";

/** Our swap native placeholder → LI.FI's zero-address native representation. */
export function toLifiToken(address: string): string {
  const a = address.toLowerCase();
  if (a === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") return LIFI_NATIVE_TOKEN;
  return address;
}

export interface LifiFeeCost {
  name: string;
  amountUSD?: string;
  included?: boolean;
  token?: { symbol?: string };
}

export interface LifiGasCost {
  amountUSD?: string;
}

export interface LifiEstimate {
  tool: string;
  approvalAddress: string;
  toAmount: string;
  toAmountMin: string;
  fromAmount: string;
  executionDuration: number;
  fromAmountUSD?: string;
  toAmountUSD?: string;
  feeCosts?: LifiFeeCost[];
  gasCosts?: LifiGasCost[];
}

export interface LifiTxRequest {
  to: string;
  data: string;
  value?: string;
  from?: string;
  chainId: number;
  gasPrice?: string;
  gasLimit?: string;
}

export interface LifiQuote {
  tool: string;
  toolDetails?: { key: string; name: string; logoURI?: string };
  action?: { fromChainId: number; toChainId: number };
  estimate: LifiEstimate;
  transactionRequest?: LifiTxRequest;
  /** Present on error responses. */
  message?: string;
}

export type LifiStatusState = "NOT_FOUND" | "INVALID" | "PENDING" | "DONE" | "FAILED";

export interface LifiStatus {
  status: LifiStatusState;
  substatus?: string;
  substatusMessage?: string;
  /** Receiving-side tx once complete. */
  receiving?: { txHash?: string; chainId?: number };
}
