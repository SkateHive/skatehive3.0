import { NextRequest, NextResponse } from 'next/server';

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
    return data.ownedNfts.map((nft: any) => ({
      tokenId: nft.tokenId || '0',
      rarityRank: null,
      token: {
        name: nft.name || nft.title || '',
        medias: nft.image?.cachedUrl ? [{ url: nft.image.cachedUrl }] : [],
        estimatedValueEth: '0',
        collection: {
          name: nft.contract?.name || nft.contract?.openSeaMetadata?.collectionName || 'Unknown Collection',
          address: nft.contract?.address?.toLowerCase() || '',
          network: 'base',
          floorPriceEth: nft.contract?.openSeaMetadata?.floorPrice?.toString() || '0',
        },
      },
    }));
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

  try {
    const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_KEY;

    // Fetch from KeepKey (tokens + other chains)
    const apiUrl = `https://api.keepkey.info/api/v1/zapper/portfolio/${address}`;
    
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
      const textResponse = await response.text();
      throw new Error('API did not return JSON data');
    }

    const rawData = await response.json();

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

    const ethPriceUsd = combinedTokens.reduce((price: number, token: any) => {
      if (price > 0) return price;
      const symbol = (token.symbol || token.ticker || "").toLowerCase();
      const tokenPrice = Number(token.priceUsd ?? token.price ?? 0);
      return symbol === "eth" && tokenPrice > 0 ? tokenPrice : 0;
    }, 0);

    // Merge KeepKey NFTs with Basescan NFTs
    const rawNfts = Array.isArray(rawData.nfts) ? rawData.nfts : [];
    const allNfts = [...rawNfts, ...baseNFTs];
    
    const transformedNfts = allNfts.map((nft: any) => {
      const estimatedUsd = Number(nft.estimatedValue?.valueUsd ?? 0);
      const estimatedEth = ethPriceUsd > 0 ? estimatedUsd / ethPriceUsd : 0;
      const estimatedEthString = estimatedEth.toString();

      return {
        tokenId: nft.tokenId,
        rarityRank: nft.rarityRank,
        token: {
          name: nft.name || "",
          medias: [],
          estimatedValueEth: estimatedEthString,
          collection: {
            name: nft.collection?.name || "Unknown Collection",
            address: nft.collection?.address || "",
            network: nft.collection?.network || "",
            floorPriceEth: estimatedEthString,
          },
        },
      };
    });

    const totalBalanceUsdTokens = Number(
      rawData.totalBalanceUsdTokens ??
        transformedTokens.reduce(
          (sum: number, token: any) => sum + (token.token.balanceUSD || 0),
          0
        )
    );
    const totalBalanceUSDApp = Number(rawData.totalBalanceUSDApp ?? 0);
    const totalNetWorth = Number(
      rawData.totalNetWorth ?? totalBalanceUsdTokens + totalBalanceUSDApp
    );

    const transformedData = {
      totalNetWorth,
      totalBalanceUsdTokens,
      totalBalanceUSDApp,
      nftUsdNetWorth: rawData.nftUsdNetWorth || { [addressLower]: "0" },
      tokens: transformedTokens,
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
