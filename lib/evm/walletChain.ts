/**
 * Chain-bound wallet sessions.
 *
 * A Safe connected through WalletConnect (and the Safe app connector) is bound
 * to ONE chain for the whole session — `wallet_switchEthereumChain` cannot
 * move it. wagmi's WalletConnect connector awaits a `chainChanged` that never
 * comes, so any automatic switch hangs the connect/UI ("unstable, must
 * reconnect"). Never switch those programmatically; tell the user to open the
 * Safe on the target chain and reconnect instead.
 */
import type { Connector } from "wagmi";
import { getSwapChain } from "@/lib/evm/swapTokens";

export function isChainBoundWallet(connector?: Connector | null): boolean {
  if (!connector) return false;
  return connector.id === "walletConnect" || connector.id === "safe" || /safe/i.test(connector.name ?? "");
}

export function chainBoundSwitchMessage(targetChainId: number): string {
  const name = getSwapChain(targetChainId)?.name ?? `chain ${targetChainId}`;
  return `This wallet session is bound to its current network (Safe / WalletConnect). Open the Safe on ${name} and reconnect to use it there.`;
}
