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

export interface VaultActivity {
  type: "Deposit" | "Withdraw";
  assets: bigint;
  shares: bigint;
  timestamp: number;
  txHash: string;
}

/**
 * The user's deposits/withdrawals in a vault (Morpho indexer), newest first,
 * plus the net principal (deposited − withdrawn). "Earned" is the live
 * on-chain value minus this principal. Pages through the whole history (a
 * truncated list would turn missing deposits into fake earnings). Returns
 * null when the API fails — unknown is shown as unknown, never as 0 earned.
 *
 * Not covered: vault shares transferred between wallets (no Deposit event),
 * which would count as earnings for the receiver.
 */
export async function fetchMorphoVaultActivity(
  user: string,
  vault: string,
  chainId: number = EARN_CHAIN_ID,
  signal?: AbortSignal,
): Promise<{ principal: bigint; items: VaultActivity[] } | null> {
  const PAGE = 100;
  try {
    const seen = new Set<string>();
    const items: VaultActivity[] = [];
    let before: number | null = null;
    for (let page = 0; page < 20; page++) {
      const res: Response = await fetch("https://api.morpho.org/graphql", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal,
        body: JSON.stringify({
          query:
            "query($u:[String!],$v:[String!],$c:[Int!],$b:Int){vaultV1Transactions(first:100,orderBy:Time,orderDirection:Desc,where:{userAddress_in:$u,vaultAddress_in:$v,chainId_in:$c,type_in:[Deposit,Withdraw],timestamp_lte:$b}){items{txHash logIndex timestamp type assets shares}}}",
          variables: { u: [user], v: [vault], c: [chainId], b: before },
        }),
      });
      const json: { data?: { vaultV1Transactions?: { items?: unknown } } } = await res.json();
      const raw = json?.data?.vaultV1Transactions?.items;
      if (!Array.isArray(raw)) return null;
      for (const t of raw as { txHash: string; logIndex: number; timestamp: number; type: "Deposit" | "Withdraw"; assets: string | number; shares: string | number }[]) {
        // Pages overlap on the boundary timestamp — dedupe by log position.
        const key = `${t.txHash}:${t.logIndex}`;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({ type: t.type, assets: BigInt(t.assets), shares: BigInt(t.shares), timestamp: Number(t.timestamp), txHash: t.txHash });
      }
      if (raw.length < PAGE) break;
      before = Number(raw[raw.length - 1].timestamp);
    }
    const principal = items.reduce((s, t) => (t.type === "Deposit" ? s + t.assets : s - t.assets), 0n);
    return { principal, items };
  } catch {
    return null;
  }
}

export const BASESCAN_TX = (hash: string) => `https://basescan.org/tx/${hash}`;

/** Daily share price (assets per share, as a float) since `start`, oldest first. */
export async function fetchMorphoSharePrices(
  vault: string,
  start: number,
  chainId: number = EARN_CHAIN_ID,
  signal?: AbortSignal,
): Promise<{ t: number; price: number }[] | null> {
  try {
    const res = await fetch("https://api.morpho.org/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal,
      body: JSON.stringify({
        query:
          "query($a:String!,$c:Int!,$s:Int!,$e:Int!){vaultByAddress(address:$a,chainId:$c){historicalState{sharePriceNumber(options:{startTimestamp:$s,endTimestamp:$e,interval:DAY}){x y}}}}",
        // one day back so the first deposit day has a price
        variables: { a: vault, c: chainId, s: start - 86_400, e: Math.floor(Date.now() / 1000) },
      }),
    });
    const json = await res.json();
    const raw = json?.data?.vaultByAddress?.historicalState?.sharePriceNumber;
    if (!Array.isArray(raw)) return null;
    return raw
      .filter((p: { x: number; y: number | null }) => typeof p.y === "number")
      .map((p: { x: number; y: number }) => ({ t: p.x, price: p.y }))
      .sort((a: { t: number }, b: { t: number }) => a.t - b.t);
  } catch {
    return null;
  }
}
