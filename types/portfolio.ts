export interface Token {
  address: string;
  balance: number;
  balanceRaw: string;
  balanceUSD: number;
  canExchange: boolean;
  coingeckoId: string;
  createdAt: string;
  dailyVolume?: number;
  decimals: number;
  externallyVerified: boolean;
  hide: boolean;
  holdersEnabled: boolean;
  id: string;
  label: string | null;
  marketCap?: number;
  name: string;
  networkId: number;
  price: number;
  priceUpdatedAt: string;
  status: string;
  symbol: string;
  totalSupply: string;
  updatedAt: string;
  verified: boolean;
}

export interface TokenDetail {
  address: string;
  assetCaip: string;
  key: string;
  network: string;
  token: Token;
  updatedAt: string;
  source?: 'ethereum' | 'farcaster' | 'verified'; // Added to track token source
  sourceAddress?: string; // Added to track which address this token came from
}

export interface PortfolioData {
  nftUsdNetWorth: Record<string, string>;
  nfts: TokenDetail[];
  tokens: TokenDetail[];
  totalBalanceUSDApp: number;
  totalBalanceUsdTokens: number;
  totalNetWorth: number;
}

export type NFT = {
  lastSaleEth: string;
  rarityRank: number;
  token: {
    estimatedValueEth: string;
    lastSale: {
      price: string;
    };
    medias: {
      originalUrl: string;
    }[];
    collection: {
      floorPriceEth: string;
      name: string;
      address: string;
    };
    floorPriceEth: string;
    lastSaleEth: string;
    lastOffer?: {
      price: string;
    };
  };
};

export interface BlockchainInfo {
  color: string;
  logo: string;
  alias?: string;
}

export const blockchainDictionary: Record<string, BlockchainInfo> = {
  arbitrum: {
    color: "#28A0F0",
    logo: "/logos/arbitrum_logo.png",
  },
  base: {
    color: "#0052FF",
    logo: "/logos/base_logo.png",
  },
  "binance-smart-chain": {
    color: "#F0B90B",
    logo: "/logos/binance_smart_chain_logo.png",
    alias: "BSC",
  },
  ethereum: {
    color: "#627EEA",
    logo: "/logos/ethereum_logo.png",
  },
  fantom: {
    color: "#13B5EC",
    logo: "/logos/fantom_logo.png",
  },
  gnosis: {
    color: "#32CD32",
    logo: "/logos/gnosis_logo.png",
  },
  optimism: {
    color: "#FF0420",
    logo: "/logos/optimism_logo.png",
  },
  polygon: {
    color: "#8247E5",
    logo: "/logos/polygon_logo.png",
  },
  degen: {
    color: "#A855F7",
    logo: "/logos/degen.png",
  },
  celo: {
    color: "#FCDC00",
    logo: "/logos/celo_logo.png",
  },
  zora: {
    color: "#000000",
    logo: "/logos/Zorb.png",
  },
  zero: {
    color: "#000000",
    logo: "/logos/skatehive-logo-rounded.png",
  },
  hive: {
    color: "#E31337",
    logo: "/logos/hiveLogo.png",
    alias: "Hive",
  },
};

// Legacy types for backward compatibility
export interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  price?: number;
  value?: number;
  contractAddress?: string;
  logoURI?: string;
}

export interface PortfolioResponse {
  success: boolean;
  data: PortfolioData;
  error?: string;
}
