import {
  createPublicClient,
  formatUnits,
  http,
  recoverMessageAddress,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";
import { ERC4626_ABI, MORPHO_USDC_VAULT, USDC_DECIMALS } from "@/lib/evm/earn";

/**
 * Server-side Base reads for USDC cofrinhos. Everything here is read from the
 * chain on every call; nothing the client sends is trusted as a balance.
 */

function baseClient() {
  const key = process.env.ALCHEMY_API_KEY || process.env.NEXT_PUBLIC_ALCHEMY_KEY;
  return createPublicClient({
    chain: base,
    transport: http(key ? `https://base-mainnet.g.alchemy.com/v2/${key}` : undefined),
  });
}

type OnChainVerify = (address: Address, message: string, signature: Hex) => Promise<boolean>;

/** ERC-1271 / ERC-6492 check on Base (smart wallets, e.g. Coinbase Smart Wallet). */
const verifyOnBase: OnChainVerify = (address, message, signature) =>
  baseClient().verifyMessage({ address, message, signature });

/**
 * Verify that `signature` over `message` was made by `address`.
 * A plain wallet (EOA) is checked locally by recovering the signer, with no
 * network call. Anything else falls back to the on-chain check on Base, the
 * chain the USDC position lives on, which covers deployed smart wallets
 * (ERC-1271) and not-yet-deployed ones (ERC-6492).
 * `onChainVerify` is injectable for tests.
 */
export async function verifyEvmSignature(
  address: string,
  message: string,
  signature: string,
  onChainVerify: OnChainVerify = verifyOnBase
): Promise<boolean> {
  if (!/^0x([0-9a-fA-F]{2})+$/.test(signature)) return false;
  try {
    const recovered = await recoverMessageAddress({ message, signature: signature as Hex });
    if (recovered.toLowerCase() === address.toLowerCase()) return true;
  } catch {
    // Not a recoverable 65-byte ECDSA signature: may be a smart-wallet one.
  }
  try {
    return await onChainVerify(address as Address, message, signature as Hex);
  } catch {
    return false;
  }
}

/** Floor to 3 decimals (the jar precision) so rounding never adds money. */
export function floor3(n: number): number {
  return Math.floor((n + Number.EPSILON) * 1000) / 1000;
}

/**
 * The address's USDC in the Earn vault (shares -> assets), floored to the
 * jar precision. Throws when the chain can't be read; callers fail closed.
 */
export async function getOnChainUsdcSavings(address: string): Promise<number> {
  const client = baseClient();
  const vault = MORPHO_USDC_VAULT.address;
  const shares = await client.readContract({
    address: vault,
    abi: ERC4626_ABI,
    functionName: "balanceOf",
    args: [address as Address],
  });
  if (shares === 0n) return 0;
  const assets = await client.readContract({
    address: vault,
    abi: ERC4626_ABI,
    functionName: "convertToAssets",
    args: [shares],
  });
  return floor3(Number(formatUnits(assets, USDC_DECIMALS)));
}
