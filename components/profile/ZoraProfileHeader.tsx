"use client";
import React, { memo, useState, useEffect, useMemo } from "react";
import {
  Box,
  Text,
  Flex,
  Spinner,
  HStack,
  Link,
} from "@chakra-ui/react";
import { ProfileData } from "./ProfilePage";
import {
  useZoraProfileCoin,
  ZoraProfileData,
} from "@/hooks/useZoraProfileCoin";
import TradeProfileCoinButton from "./TradeProfileCoinButton";
import ProfileHeaderWrapper from "./ProfileHeaderWrapper";
import IdentityBlock from "./IdentityBlock";

interface ZoraProfileHeaderProps {
  profileData: ProfileData;
  username: string;
}

const ZoraProfileHeader = function ZoraProfileHeader({
  profileData,
  username,
}: ZoraProfileHeaderProps) {
  const [cachedZoraData, setCachedZoraData] = useState<ZoraProfileData | null>(
    null
  );
  const [zoraDataFetched, setZoraDataFetched] = useState(false);
  const [avatarLoaded, setAvatarLoaded] = useState(false);

  // Fetch Zora data when ethereum address is available
  const {
    profileData: zoraProfileData,
    loading: zoraLoading,
    error: zoraError,
  } = useZoraProfileCoin(profileData.ethereum_address);

  // Helper function to format market cap - memoized
  const formatMarketCap = useMemo(() => {
    return (marketCap: string | undefined): string => {
      if (!marketCap) return "N/A";

      const num = parseFloat(marketCap);
      if (isNaN(num)) return "N/A";

      if (num >= 1000000000) {
        return `$${(num / 1000000000).toFixed(1)}B`;
      } else if (num >= 1000000) {
        return `$${(num / 1000000).toFixed(1)}M`;
      } else if (num >= 1000) {
        return `$${(num / 1000).toFixed(1)}K`;
      } else if (num >= 1) {
        return `$${num.toFixed(2)}`;
      } else {
        return `$${num.toFixed(4)}`;
      }
    };
  }, []);

  // Helper function to generate Zora profile URL - memoized
  const getZoraProfileUrl = useMemo(() => {
    return (handle: string | undefined): string | undefined => {
      if (!handle) return undefined;
      return `https://zora.co/@${handle}`;
    };
  }, []);

  // Memoize the formatted market cap value
  const formattedMarketCap = useMemo(() => {
    if (!cachedZoraData?.coinData?.marketCap) return "N/A";

    const num = parseFloat(cachedZoraData.coinData.marketCap);
    if (isNaN(num)) return "N/A";

    // Only format if over 1 million, otherwise show full amount
    if (num >= 1000000) {
      return formatMarketCap(cachedZoraData.coinData.marketCap);
    } else {
      return `$${num.toFixed(2)}`;
    }
  }, [cachedZoraData?.coinData?.marketCap, formatMarketCap]);

  // Memoize the Zora profile URL
  const zoraProfileUrl = useMemo(() => {
    return getZoraProfileUrl(cachedZoraData?.handle);
  }, [cachedZoraData?.handle, getZoraProfileUrl]);

  // Calculate market cap percentage change - memoized
  const marketCapChange = useMemo(() => {
    if (
      !cachedZoraData?.coinData?.marketCap ||
      !cachedZoraData?.coinData?.marketCapDelta24h
    ) {
      return { percentage: 0, isPositive: false, display: "0.00%" };
    }

    const currentMarketCap = parseFloat(cachedZoraData.coinData.marketCap);
    const delta24h = parseFloat(cachedZoraData.coinData.marketCapDelta24h);

    if (isNaN(currentMarketCap) || isNaN(delta24h)) {
      return { percentage: 0, isPositive: false, display: "0.00%" };
    }

    // Calculate the previous market cap (current - delta)
    const previousMarketCap = currentMarketCap - delta24h;

    if (previousMarketCap === 0 || previousMarketCap < 0) {
      return { percentage: 0, isPositive: false, display: "0.00%" };
    }

    // Calculate percentage change: (delta / previous) * 100
    const percentageChange = (delta24h / previousMarketCap) * 100;
    const isPositive = delta24h >= 0;
    const display = `${isPositive ? "+" : ""}${percentageChange.toFixed(2)}%`;

    return { percentage: percentageChange, isPositive, display };
  }, [
    cachedZoraData?.coinData?.marketCap,
    cachedZoraData?.coinData?.marketCapDelta24h,
  ]);

  // Reset Zora cache when identity changes
  useEffect(() => {
    setCachedZoraData(null);
    setZoraDataFetched(false);
    setAvatarLoaded(false);
  }, [username, profileData.ethereum_address]);

  // Cache the Zora data once it's loaded
  useEffect(() => {
    if (zoraProfileData && !zoraLoading && !zoraError) {
      setCachedZoraData(zoraProfileData);
      setZoraDataFetched(true);
    }
  }, [zoraProfileData, zoraLoading, zoraError]);

  // Preload avatar image to prevent flickering
  useEffect(() => {
    if (cachedZoraData?.avatar && !avatarLoaded) {
      const img = new Image();
      img.onload = () => setAvatarLoaded(true);
      img.onerror = () => setAvatarLoaded(true); // Still set to true to prevent infinite loading
      img.src = cachedZoraData.avatar;
    }
  }, [cachedZoraData?.avatar, avatarLoaded]);

  // Early return after all hooks are called
  if (!profileData.ethereum_address) {
    return null;
  } // Loading state
  if (zoraLoading) {
    return (
      <Box w="100%">
        <Flex justify="center" align="center" minH="100px">
          <Spinner size="lg" color="primary" />
        </Flex>
      </Box>
    );
  }

  // Error state or no profile data found
  if (zoraError || !cachedZoraData) {
    return (
      <Box w="100%">
        <Flex justify="center" align="center" minH="100px">
          <Text color="gray.400" fontSize="sm">
            No Zora profile found for this wallet
          </Text>
        </Flex>
      </Box>
    );
  }

  // Market cap stats row - positioned like Hive's follower stats
  const statsRow = cachedZoraData.coinData && (
    <Box>
      <HStack spacing={6} fontSize="sm" mb={3}>
        {zoraProfileUrl ? (
          <Link href={zoraProfileUrl} isExternal _hover={{ opacity: 0.8 }}>
            <Text color="white" whiteSpace="nowrap" textShadow="0 2px 4px rgba(0,0,0,0.9)">
              <Text as="span" fontWeight="bold" color="primary" fontSize="2xl">
                {formattedMarketCap}
              </Text>{" "}
              Market Cap
            </Text>
          </Link>
        ) : (
          <Text color="white" whiteSpace="nowrap" textShadow="0 2px 4px rgba(0,0,0,0.9)">
            <Text as="span" fontWeight="bold" color="primary" fontSize="2xl">
              {formattedMarketCap}
            </Text>{" "}
            Market Cap
          </Text>
        )}

        {marketCapChange.display !== "0.00%" && (
          <Text
            color={marketCapChange.isPositive ? "green.400" : "red.400"}
            whiteSpace="nowrap"
            textShadow="0 2px 4px rgba(0,0,0,0.9)"
            fontWeight="medium"
          >
            <Text as="span" fontWeight="bold" fontSize="lg">
              {marketCapChange.display}
            </Text>{" "}
            (24h)
          </Text>
        )}
      </HStack>

      {/* Trade button positioned like power bars */}
      <Box>
        <TradeProfileCoinButton
          coinAddress={cachedZoraData.coinData.address}
          coinData={{
            name: cachedZoraData.coinData.name,
            symbol: cachedZoraData.coinData.symbol,
            image: cachedZoraData.coinData.image,
            marketCap: cachedZoraData.coinData.marketCap,
            uniqueHolders: cachedZoraData.coinData.holderCount,
          }}
        />
      </Box>
    </Box>
  );

  return (
    <ProfileHeaderWrapper
      coverImage={profileData.coverImage}
      username={username}
      identity={
        <IdentityBlock
          avatar={cachedZoraData.avatar}
          displayName={cachedZoraData.displayName || cachedZoraData.handle || username}
          handle={`@${cachedZoraData.handle || username}`}
          externalLink={
            zoraProfileUrl
              ? {
                  url: zoraProfileUrl,
                  label: `View ${cachedZoraData.handle || username} on Zora`,
                }
              : undefined
          }
        />
      }
      stats={statsRow}
    />
  );
};

// Add proper memo comparison function
export default memo(ZoraProfileHeader, (prevProps, nextProps) => {
  return (
    prevProps.username === nextProps.username &&
    prevProps.profileData.ethereum_address ===
      nextProps.profileData.ethereum_address
  );
});
