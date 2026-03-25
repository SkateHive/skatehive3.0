import { Box, Image, Text } from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { TokenDetail, blockchainDictionary } from "../../../types/portfolio";
import { getTokenLogoSync } from "../../../lib/utils/portfolioUtils";
import { getZoraToken } from "../../../lib/utils/zoraEnrichment";

// Simple in-memory cache so we don't re-fetch the same Zora coin on every render
const zoraImageCache = new Map<string, string | null>();

interface TokenLogoProps {
  token: TokenDetail;
  size: string;
  showNetworkBadge?: boolean;
  networkBadgeSize?: string;
}

/** Map network name → EVM chain ID for DefiLlama icons */
const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  base: 8453,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  gnosis: 100,
  celo: 42220,
  avalanche: 43114,
  "binance-smart-chain": 56,
  bsc: 56,
  degen: 666666666,
  zora: 7777777,
};

/** Map network name → Trust Wallet assets chain folder */
const TRUST_WALLET_CHAINS: Record<string, string> = {
  ethereum: "ethereum",
  base: "base",
  polygon: "polygon",
  arbitrum: "arbitrum",
  optimism: "optimism",
  gnosis: "xdai",
  celo: "celo",
  avalanche: "avalanchec",
  "binance-smart-chain": "smartchain",
  bsc: "smartchain",
};

function buildLogoSources(token: TokenDetail): string[] {
  const address = token.token.address?.toLowerCase();
  const network = token.network?.toLowerCase();
  const symbol = token.token.symbol?.toLowerCase();

  // Local known logos — always tried first
  const knownLogos: Record<string, string> = {
    hive: "/logos/hiveLogo.png",
    hp: "/logos/hiveLogo.png",
    hbd: "/logos/hbd_logo.png",
    hbds: "/logos/hbd_logo.png",
    eth: "/logos/ethereum_logo.png",
    weth: "/logos/ethereum_logo.png",
    matic: "/logos/polygon_logo.png",
    pol: "/logos/polygon_logo.png",
    degen: "/logos/degen.png",
    higher: "/logos/higher.png",
    nog: "/logos/nog.png",
  };

  if (knownLogos[symbol]) {
    return [knownLogos[symbol]];
  }

  if (!address || address === "0x0000000000000000000000000000000000000000") {
    return [];
  }

  const sources: string[] = [];

  // 1. Zora enrichment cache — highest quality official images
  const zoraEnriched = getZoraToken(address);
  if (zoraEnriched?.logo) {
    sources.push(zoraEnriched.logo);
  }

  // 2. GeckoTerminal cache (sync, already fetched via portfolioUtils)
  const networkInfo =
    blockchainDictionary[network] || blockchainDictionary[token.network];
  const cached = getTokenLogoSync(token.token, networkInfo, token.network);
  if (cached && cached !== "missing.png" && cached !== "") {
    sources.push(cached);
  }

  // 2. Trust Wallet Assets CDN
  const twChain = TRUST_WALLET_CHAINS[network];
  if (twChain) {
    sources.push(
      `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${twChain}/assets/${address}/logo.png`,
    );
  }

  // 3. DefiLlama token icons
  const chainId = CHAIN_IDS[network];
  if (chainId) {
    sources.push(
      `https://token-icons.llamao.fi/icons/tokens/${chainId}/${address}?h=64&w=64`,
    );
  }

  // 4. 1inch token images
  if (chainId) {
    sources.push(`https://tokens.1inch.io/v1.2/${chainId}/${address}.png`);
  }

  return sources;
}

interface TokenImageProps {
  sources: string[];
  size: string;
  alt: string;
  borderRadius: string;
  fallback: React.ReactElement;
}

function TokenImage({
  sources,
  size,
  alt,
  borderRadius,
  fallback,
}: TokenImageProps) {
  const [srcIndex, setSrcIndex] = useState(0);

  useEffect(() => {
    setSrcIndex(0);
  }, [sources]);

  if (sources.length === 0 || srcIndex >= sources.length) {
    return fallback;
  }

  return (
    <Image
      src={sources[srcIndex]}
      alt={alt}
      w={size}
      h={size}
      borderRadius={borderRadius}
      objectFit="contain"
      flexShrink={0}
      bg="transparent"
      onError={() => setSrcIndex((i) => i + 1)}
      fallback={srcIndex >= sources.length - 1 ? fallback : undefined}
    />
  );
}

export default function TokenLogo({
  token,
  size,
  showNetworkBadge = false,
  networkBadgeSize = "12px",
}: TokenLogoProps) {
  const networkInfo = blockchainDictionary[token.network];
  const isHiveToken = token.network === "hive";
  const isZoraToken = token.network?.toLowerCase() === "zora";
  const tokenAddress = token.token.address?.toLowerCase();

  const [zoraImage, setZoraImage] = useState<string | null>(() => {
    if (!isZoraToken || !tokenAddress) return null;
    return zoraImageCache.get(tokenAddress) ?? null;
  });

  useEffect(() => {
    if (!isZoraToken || !tokenAddress) return;
    if (zoraImageCache.has(tokenAddress)) {
      const cached = zoraImageCache.get(tokenAddress) ?? null;
      setZoraImage(cached);
      return;
    }
    fetch(`/api/zora/coin?address=${tokenAddress}&chainId=7777777`)
      .then((r) => r.json())
      .then((data) => {
        const img: string | null = data.image ?? null;
        zoraImageCache.set(tokenAddress, img);
        if (img) setZoraImage(img);
      })
      .catch(() => {
        zoraImageCache.set(tokenAddress, null);
      });
  }, [isZoraToken, tokenAddress]);

  const baseSources = buildLogoSources(token);
  const sources = zoraImage ? [zoraImage, ...baseSources] : baseSources;

  const fallbackElement = (
    <Box
      w={size}
      h={size}
      borderRadius="full"
      bg="panel"
      display="flex"
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
      border="1px solid"
      borderColor="border"
    >
      <Text
        fontSize={size === "40px" ? "lg" : size === "32px" ? "md" : "xs"}
        fontWeight="bold"
        color="text"
      >
        {token.token.symbol.charAt(0).toUpperCase()}
      </Text>
    </Box>
  );

  const tokenLogo = (
    <TokenImage
      sources={sources}
      size={size}
      alt={token.token.symbol}
      borderRadius={isHiveToken ? "none" : "full"}
      fallback={fallbackElement}
    />
  );

  if (!showNetworkBadge || isHiveToken) {
    return <Box flexShrink={0}>{tokenLogo}</Box>;
  }

  return (
    <Box position="relative" display="inline-block" flexShrink={0}>
      {tokenLogo}
      {networkInfo?.logo && (
        <Image
          src={networkInfo.logo}
          alt={networkInfo?.alias || token.network}
          w={networkBadgeSize}
          h={networkBadgeSize}
          borderRadius="full"
          position="absolute"
          bottom="-1px"
          right="-1px"
          border="2px solid"
          borderColor="background"
          bg="background"
          objectFit="cover"
          flexShrink={0}
        />
      )}
    </Box>
  );
}
