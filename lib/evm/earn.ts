/**
 * Wallet "Earn": put idle EVM balances to work without leaving SkateHive.
 *
 *  - USDC → one curated Morpho vault on Base (ERC4626). Deposit = approve +
 *    deposit(assets, receiver); exit = redeem(shares) for "max", otherwise
 *    withdraw(assets) so no share dust is left behind.
 *  - ETH  → Lido stETH on mainnet (see lib/evm/lido.ts). Exit is a swap
 *    stETH → ETH in the Swap panel; the Lido withdrawal queue is out of scope.
 *
 * The position is read straight from the vault (balanceOf → convertToAssets),
 * never inferred from deposits. The vault share token (gtUSDCp) is also an
 * ERC20 the portfolio already lists, so this is NOT added to DeFi totals —
 * that would double-count it.
 *
 * Vault verified on-chain 2026-10-14: asset() = native USDC on Base, share
 * decimals 18, 1 share ≈ 1.115 USDC, ~$414M TVL. Picked as the largest-yield
 * of the large curated USDC vaults on Base (Morpho API, listed vaults).
 */
import { base } from "viem/chains";

export const EARN_CHAIN_ID = base.id;
export const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
export const USDC_DECIMALS = 6;

export const MORPHO_USDC_VAULT = {
  address: "0xeE8F4eC5672F09119b96Ab6fB59C27E1b7e44b61" as const,
  name: "Gauntlet USDC Prime",
  url: "https://app.morpho.org/base/vault/0xeE8F4eC5672F09119b96Ab6fB59C27E1b7e44b61",
};

export const LIDO_URL = "https://stake.lido.fi";

export const ERC20_EARN_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

export const ERC4626_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "convertToAssets", type: "function", stateMutability: "view", inputs: [{ name: "shares", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { name: "maxWithdraw", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "deposit", type: "function", stateMutability: "nonpayable", inputs: [{ name: "assets", type: "uint256" }, { name: "receiver", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "withdraw", type: "function", stateMutability: "nonpayable", inputs: [{ name: "assets", type: "uint256" }, { name: "receiver", type: "address" }, { name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "redeem", type: "function", stateMutability: "nonpayable", inputs: [{ name: "shares", type: "uint256" }, { name: "receiver", type: "address" }, { name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

/** Net APY of the vault as a fraction (0.047 = 4.7%), or null when unavailable. */
export async function fetchMorphoVaultApy(address: string, chainId: number = EARN_CHAIN_ID): Promise<number | null> {
  try {
    const res = await fetch("https://api.morpho.org/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: "query($a:String!,$c:Int!){vaultByAddress(address:$a,chainId:$c){state{netApy}}}",
        variables: { a: address, c: chainId },
      }),
    });
    const json = await res.json();
    const apy = json?.data?.vaultByAddress?.state?.netApy;
    return typeof apy === "number" && Number.isFinite(apy) ? apy : null;
  } catch {
    return null;
  }
}

/** Lido stETH 7-day SMA APR as a fraction, or null when unavailable. */
export async function fetchLidoApr(): Promise<number | null> {
  try {
    const res = await fetch("https://eth-api.lido.fi/v1/protocol/steth/apr/sma");
    const json = await res.json();
    const apr = Number(json?.data?.smaApr);
    return Number.isFinite(apr) && apr > 0 ? apr / 100 : null;
  } catch {
    return null;
  }
}
