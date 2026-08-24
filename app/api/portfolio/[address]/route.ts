import { NextRequest, NextResponse } from 'next/server';
import { type Address } from "viem";
import { ETH_ADDRESSES } from "@/config/app.config";
import {
  fetchNativeEthBalances,
  type NativeEthBalance,
} from "@/lib/evm/nativeEthBalances";
import { fetchErc20Balances, type Erc20Balance } from "@/lib/evm/erc20Balances";

const SUPPORTED_NATIVE_ETH_CHAIN_IDS = new Set([1, 8453, 42161]);

interface CoinGeckoPriceResponse {
  ethereum?: {
    usd?: number;
  };
}

async function fetchEthPriceUsd(fallbackPrice: number): Promise<number> {
  if (fallbackPrice > 0) return fallbackPrice;

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { next: { revalidate: 60 } },
    );
    if (!response.ok) return 0;

    const data = (await response.json()) as CoinGeckoPriceResponse;
    return typeof data.ethereum?.usd === "number" ? data.ethereum.usd : 0;
  } catch {
    return 0;
  }
}

function createNativeEthToken(balance: NativeEthBalance, price: number) {
  const now = new Date().toISOString();
  const balanceUSD = balance.balance * price;
  const tokenId = `eip155:${balance.chainId}/slip44:60`;

  return {
    address: ETH_ADDRESSES.ZERO,
    assetCaip: tokenId,
    key: tokenId,
    network: balance.network,
    token: {
      address: ETH_ADDRESSES.ZERO,
      balance: balance.balance,
      balanceRaw: balance.balanceRaw,
      balanceUSD,
      canExchange: false,
      coingeckoId: "ethereum",
      createdAt: now,
      decimals: 18,
      externallyVerified: true,
      hide: false,
      holdersEnabled: false,
      id: tokenId,
      label: null,
      name: "Ethereum",
      networkId: balance.chainId,
      price,
      priceUpdatedAt: now,
      status: "active",
      symbol: "ETH",
      totalSupply: "0",
      updatedAt: now,
      verified: true,
    },
    updatedAt: now,
  };
}

function isSupportedNativeEthToken(token: {
  token: { networkId: number; symbol: string };
}) {
  return (
    token.token.symbol.toUpperCase() === "ETH" &&
    SUPPORTED_NATIVE_ETH_CHAIN_IDS.has(token.token.networkId)
  );
}

// Fetch NFTs from Alchemy API (Base chain only)
async function fetchAlchemyNFTs(address: string, apiKey: string) {
  try {
    const url = `https://base-mainnet.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner?owner=${address}&withMetadata=true&pageSize=100`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Alchemy API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (!data.ownedNfts || !Array.isArray(data.ownedNfts)) {
      return [];
    }

    // Transform Alchemy NFT format to KeepKey format
    return data.ownedNfts.map((nft: any) => {
      // pngUrl/thumbnailUrl = Alchemy CDN render (always a proper image)
      // cachedUrl = Alchemy cache (may expire or return api.zora.co renderer)
      // raw metadata image = direct IPFS/HTTP URL from token metadata
      // originalUrl = last resort (may be api.zora.co renderer or IPFS)
      const rawImage = nft.raw?.metadata?.image || '';
      const isZoraRenderer = (url: string) => url.includes('api.zora.co');
      const imageUrl =
        nft.image?.pngUrl ||
        nft.image?.thumbnailUrl ||
        (nft.image?.cachedUrl && !isZoraRenderer(nft.image.cachedUrl) ? nft.image.cachedUrl : '') ||
        (!isZoraRenderer(rawImage) ? rawImage : '') ||
        nft.image?.cachedUrl ||
        rawImage ||
        nft.image?.originalUrl ||
        '';

      return {
      tokenId: nft.tokenId || '0',
      rarityRank: null,
      token: {
        name: nft.name || nft.title || '',
        medias: imageUrl ? [{ url: imageUrl }] : [],
        estimatedValueEth: '0',
        collection: {
          name: nft.contract?.name || nft.contract?.openSeaMetadata?.collectionName || 'Unknown Collection',
          address: nft.contract?.address?.toLowerCase() || '',
          network: 'base',
          floorPriceEth: nft.contract?.openSeaMetadata?.floorPrice?.toString() || '0',
        },
      },
    };
    });
  } catch (error) {
    console.error('Error fetching Base NFTs from Alchemy:', error);
    return [];
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!address) {
    return NextResponse.json(
      { message: 'Address is required' },
      { status: 400 }
    );
  }

  // Validate: must be a 0x EVM address (42 chars) or a valid Hive username (3-16 chars, a-z0-9.-_)
  const isEvmAddress = /^0x[0-9a-fA-F]{40}$/.test(address);
  const isHiveUsername = /^[a-z][a-z0-9\-\.]{2,15}$/.test(address);
  if (!isEvmAddress && !isHiveUsername) {
    return NextResponse.json({ error: "Invalid address format" }, { status: 400 });
  }

  try {
    const alchemyApiKey =
      process.env.ALCHEMY_API_KEY || process.env.NEXT_PUBLIC_ALCHEMY_KEY;

    const nativeBalancesPromise = isEvmAddress
      ? fetchNativeEthBalances(address as Address, alchemyApiKey)
      : Promise.resolve([]);

    // Fetch from KeepKey (tokens + other chains)
    const apiUrl = `https://api.keepkey.info/api/v1/zapper/portfolio/${address}`;
    let rawData: Record<string, unknown> = {};

    try {
      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; SkateHive/1.0)'
        }
      });

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('API did not return JSON data');
      }

      const data: unknown = await response.json();
      if (data && typeof data === "object" && !Array.isArray(data)) {
        rawData = data as Record<string, unknown>;
      }
    } catch (error) {
      console.error("[Portfolio API] KeepKey lookup failed:", error);
    }

    // Fetch Base NFTs from Alchemy if API key is available
    let baseNFTs: any[] = [];
    if (alchemyApiKey) {
      console.log(`[Portfolio API] Fetching Base NFTs for ${address} via Alchemy`);
      baseNFTs = await fetchAlchemyNFTs(address, alchemyApiKey);
      console.log(`[Portfolio API] Alchemy returned ${baseNFTs.length} NFTs`);
    } else {
      console.warn('[Portfolio API] NEXT_PUBLIC_ALCHEMY_KEY not found in env');
    }

    const addressLower = address.toLowerCase();
    const rawBalances = Array.isArray(rawData.balances) ? rawData.balances : [];
    const rawTokens = Array.isArray(rawData.tokens) ? rawData.tokens : [];
    const combinedTokens = [...rawBalances, ...rawTokens];

    const parseNetworkId = (networkId: unknown): number => {
      if (typeof networkId === "number") {
        return networkId;
      }

      if (typeof networkId === "string") {
        const parts = networkId.split(":");
        const lastPart = parts[parts.length - 1];
        const parsed = parseInt(lastPart, 10);
        return Number.isNaN(parsed) ? 1 : parsed;
      }

      return 1;
    };

    const transformedTokens = combinedTokens.map((token: any, index: number) => {
      const tokenAddress = token.tokenAddress || token.address || "";
      const network = token.chain || token.network || "ethereum";
      const tokenId = token.key || token.id || `${network}-${tokenAddress}-${index}`;
      const balance = Number(token.balance || 0);
      const balanceUSD = Number(token.valueUsd ?? token.balanceUSD ?? 0);
      const price = Number(token.priceUsd ?? token.price ?? 0);
      const decimals = Number(token.decimals ?? 18);
      const symbol = token.symbol || token.ticker || "UNKNOWN";
      const name = token.name || symbol;
      const now = new Date().toISOString();

      return {
        address: tokenAddress,
        assetCaip: token.caip || token.assetCaip || "",
        key: tokenId,
        network,
        token: {
          address: tokenAddress,
          balance,
          balanceRaw: token.balanceRaw || "0",
          balanceUSD,
          canExchange: false,
          coingeckoId: "",
          createdAt: now,
          decimals,
          externallyVerified: false,
          hide: false,
          holdersEnabled: false,
          id: tokenId,
          label: null,
          name,
          networkId: parseNetworkId(token.networkId),
          price,
          priceUpdatedAt: now,
          status: "active",
          symbol,
          totalSupply: "0",
          updatedAt: now,
          verified: false,
        },
        updatedAt: now,
      };
    });

    const indexedEthPriceUsd = combinedTokens.reduce((price: number, token: any) => {
      if (price > 0) return price;
      const symbol = (token.symbol || token.ticker || "").toLowerCase();
      const tokenPrice = Number(token.priceUsd ?? token.price ?? 0);
      return symbol === "eth" && tokenPrice > 0 ? tokenPrice : 0;
    }, 0);
    const nativeBalances = await nativeBalancesPromise;
    const ethPriceUsd = nativeBalances.some((balance) => balance.balance > 0)
      ? await fetchEthPriceUsd(indexedEthPriceUsd)
      : indexedEthPriceUsd;
    const nativeEthTokens = nativeBalances
      .filter((balance) => balance.balance > 0)
      .map((balance) => createNativeEthToken(balance, ethPriceUsd));
    const indexedNativeEthUsd = transformedTokens
      .filter(isSupportedNativeEthToken)
      .reduce(
        (sum: number, token: { token: { balanceUSD: number } }) =>
          sum + token.token.balanceUSD,
        0,
      );
    // ── ERC-20 from the chain (Alchemy), merged over the upstream ──────────
    // Same idea as the native-ETH override above: the upstream is stale and
    // has no mainnet ERC-20 coverage (it missed 1.01 stETH ≈ $2.4k on the
    // treasury Safe). Rules: on-chain wins per (chain, contract); upstream-only
    // tokens are kept; a failed chain keeps upstream untouched for that chain.
    const normalizeNetworkName = (raw: unknown): string => {
      const n = String(raw ?? "").toLowerCase();
      if (n === "eth" || n === "mainnet" || n.includes("ethereum")) return "ethereum";
      if (n.includes("arbitrum")) return "arbitrum";
      if (n.includes("base")) return "base";
      return n;
    };
    const erc20Results = isEvmAddress
      ? await fetchErc20Balances(address as Address, alchemyApiKey, ethPriceUsd)
      : [];
    const erc20ToToken = (t: Erc20Balance) => {
      const now = new Date().toISOString();
      const id = `${t.network}-${t.address}`;
      return {
        address: t.address,
        assetCaip: `eip155:${t.chainId}/erc20:${t.address}`,
        key: id,
        network: t.network,
        token: {
          address: t.address,
          balance: t.balance,
          balanceRaw: t.balanceRaw,
          balanceUSD: t.balanceUSD,
          canExchange: false,
          coingeckoId: "",
          createdAt: now,
          decimals: t.decimals,
          externallyVerified: false,
          hide: false,
          holdersEnabled: false,
          id,
          label: null,
          name: t.name,
          networkId: t.chainId,
          price: t.price,
          priceUpdatedAt: now,
          status: "active",
          symbol: t.symbol,
          totalSupply: "0",
          updatedAt: now,
          verified: false,
          ...(t.logo ? { imageUrlV2: t.logo } : {}),
        },
        updatedAt: now,
      };
    };
    const upstreamErc20 = transformedTokens.filter(
      (token: Parameters<typeof isSupportedNativeEthToken>[0]) =>
        !isSupportedNativeEthToken(token),
    );
    const tokenKey = (network: unknown, addr: unknown) => `${normalizeNetworkName(network)}:${String(addr ?? "").toLowerCase()}`;
    const byKey = new Map<string, any>();
    for (const token of upstreamErc20) byKey.set(tokenKey(token.network, token.address), token);
    let onChainOverrides = 0;
    let onChainNew = 0;
    for (const result of erc20Results) {
      if (!result.ok) continue; // keep upstream for that chain, and never as zero
      for (const t of result.tokens) {
        const k = tokenKey(t.network, t.address);
        const upstream = byKey.get(k);
        if (upstream) onChainOverrides++; else onChainNew++;
        // Balance always from chain. Price: CoinGecko when it answered; else
        // the upstream's price for the same (chain, contract) — a stale price
        // beats USD 0, which would hide a real holding behind the dust filter.
        const price = t.price > 0 ? t.price : Number(upstream?.token?.price ?? 0);
        byKey.set(k, erc20ToToken({ ...t, price, balanceUSD: t.balance * price }));
      }
    }
    console.info(
      `[Portfolio API] ERC-20 merge for ${address}: upstream=${upstreamErc20.length} ` +
        erc20Results.map((r) => `${r.network}:${r.ok ? r.tokens.length : "FAILED"}`).join(",") +
        ` → overrides=${onChainOverrides} new=${onChainNew}`,
    );
    const mergedTokens = [...byKey.values(), ...nativeEthTokens];
    const nativeEthUsd = nativeEthTokens.reduce(
      (sum, token) => sum + token.token.balanceUSD,
      0,
    );

    // Merge KeepKey NFTs with Basescan NFTs
    const rawNfts = Array.isArray(rawData.nfts) ? rawData.nfts : [];
    const allNfts = [...rawNfts, ...baseNFTs];
    
    const transformedNfts = allNfts.map((nft: any) => {
      // Alchemy NFTs are already shaped as { token: { medias, ... } }
      // KeepKey NFTs may have medias at root or inside token
      const medias: { url: string }[] =
        nft.token?.medias ||
        nft.medias ||
        (nft.image?.cachedUrl ? [{ url: nft.image.cachedUrl }] : []) ||
        [];

      const estimatedUsd = Number(nft.estimatedValue?.valueUsd ?? 0);
      const estimatedEthFromToken = Number(nft.token?.estimatedValueEth ?? 0);
      const estimatedEth = estimatedUsd > 0 && ethPriceUsd > 0 
        ? estimatedUsd / ethPriceUsd 
        : estimatedEthFromToken;
      const estimatedEthString = estimatedEth.toString();

      const collectionSrc = nft.collection || nft.token?.collection || {};
      const floorEth = nft.token?.collection?.floorPriceEth || collectionSrc.floorPriceEth || estimatedEthString;

      // Normalize raw network strings → simple lowercase names Zapper/OpenSea understand
      const rawNetwork = collectionSrc.network || nft.token?.collection?.network || "";
      const normalizeNetwork = (raw: string) => {
        const n = raw.toLowerCase();
        if (n.includes("base")) return "base";
        if (n.includes("arbitrum")) return "arbitrum";
        if (n.includes("optimism")) return "optimism";
        if (n.includes("polygon")) return "polygon";
        if (n.includes("ethereum") || n.includes("eth")) return "ethereum";
        return raw.toLowerCase();
      };

      return {
        tokenId: nft.tokenId,
        rarityRank: nft.rarityRank,
        token: {
          name: nft.token?.name || nft.name || "",
          medias,
          estimatedValueEth: estimatedEthString,
          collection: {
            name: collectionSrc.name || nft.token?.collection?.name || "Unknown Collection",
            address: collectionSrc.address || nft.token?.collection?.address || "",
            network: normalizeNetwork(rawNetwork),
            floorPriceEth: floorEth,
          },
        },
      };
    });

    const indexedTokenTotal = Number(
      rawData.totalBalanceUsdTokens ??
        transformedTokens.reduce(
          (sum: number, token: any) => sum + (token.token.balanceUSD || 0),
          0
        )
    );
    // Token total = what the list actually shows (on-chain native + merged
    // ERC-20), not the upstream's stale figure.
    const totalBalanceUsdTokens = Math.max(
      0,
      mergedTokens.reduce((sum: number, token: any) => sum + (Number(token.token?.balanceUSD) || 0), 0),
    );
    const totalBalanceUSDApp = Number(rawData.totalBalanceUSDApp ?? 0);
    const indexedNetWorth = Number(
      rawData.totalNetWorth ?? indexedTokenTotal + totalBalanceUSDApp,
    );
    const totalNetWorth = Math.max(
      0,
      indexedNetWorth - indexedTokenTotal + totalBalanceUsdTokens,
    );

    const transformedData = {
      totalNetWorth,
      totalBalanceUsdTokens,
      totalBalanceUSDApp,
      nftUsdNetWorth: rawData.nftUsdNetWorth || { [addressLower]: "0" },
      tokens: mergedTokens,
      nfts: transformedNfts,
    };

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Error fetching portfolio:', error);

    // Return properly formatted mock data for development purposes
    const mockData = {
      totalNetWorth: 0,
      totalBalanceUsdTokens: 0,
      totalBalanceUSDApp: 0,
      nftUsdNetWorth: {},
      tokens: [],
      nfts: [],
    };
    
    return NextResponse.json(mockData);
  }
}
