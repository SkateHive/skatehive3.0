"use client";

import { useState, useMemo } from "react";
import {
  Box,
  Text,
  Avatar,
  Badge,
  Image,
  Link,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Select,
  Button,
  VStack,
  HStack,
  useBreakpointValue,
  useDisclosure,
} from "@chakra-ui/react";
import RulesModal from "./RulesModal";
import AirdropModal from "@/components/airdrop/AirdropModal";
import React from "react";
import useIsMobile from "@/hooks/useIsMobile";
import { EnsName as Name } from "@/components/shared/EnsIdentity";
import { SkaterData } from "@/types/leaderboard";
import { ETH_ADDRESSES } from "@/config/app.config";
import { useTranslations } from "@/contexts/LocaleContext";
import {
  SORT_OPTIONS,
  SORT_GROUPS,
  getSortConfig,
  type SortOption,
} from "./sortOptions";

interface Props {
  skatersData: SkaterData[];
}


/** The translate function returned by useTranslations. */
type Translate = (key: string) => string;

interface LeaderboardColumn {
  key: string;
  label: React.ReactNode;
  value: (skater: SkaterData) => React.ReactNode;
}

const getRankIcon = (
  rank: number,
  sortBy: SortOption,
  skater: SkaterData
) => {
  // For binary filters, show checkmark/X instead of rankings
  if (sortBy === "witness") {
    return skater.has_voted_in_witness ? (
      <Text fontSize="lg" color="green.400">
        ✅
      </Text>
    ) : (
      <Text fontSize="lg" color="red.400">
        ❌
      </Text>
    );
  }

  if (sortBy === "eth") {
    const hasEthAddress =
      skater.eth_address &&
      skater.eth_address !== ETH_ADDRESSES.ZERO;
    return hasEthAddress ? (
      <Text fontSize="lg" color="green.400">
        ✅
      </Text>
    ) : (
      <Text fontSize="lg" color="red.400">
        ❌
      </Text>
    );
  }

  // For all other categories, show normal trophy rankings
  if (rank === 1) return <Text fontSize="xl">🏆</Text>;
  if (rank === 2) return <Text fontSize="xl">🥈</Text>;
  if (rank === 3) return <Text fontSize="xl">🥉</Text>;
  return (
    <Badge colorScheme="primary" fontSize="sm" fontWeight="bold" px={2}>
      {rank}
    </Badge>
  );
};


const formatNumber = (num: number) => {
  if (num == null || isNaN(num)) return "-";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toFixed(2);
};


const getTimeSince = (dateString: string, t: Translate) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffInDays < 1) return t('leaderboard.today');
  if (diffInDays === 1) return "1d";
  if (diffInDays < 30) return `${diffInDays}d`;
  if (diffInDays < 365) return `${Math.floor(diffInDays / 30)}mo`;
  return `${Math.floor(diffInDays / 365)}y`;
};


// Memoized component for ETH address to prevent unnecessary re-renders
const EthAddress = React.memo(({ address }: { address: string }) => {
  return (
    <HStack spacing={1}>
      <Image src="/images/ethvector.svg" alt="ETH" h="10px" w="10px" />
      <Name
        address={address as `0x${string}`}
        style={{
          fontSize: "10px",
          color: "#00ff88", // Bright green for better contrast
          fontWeight: "500",
        }}
      />
    </HStack>
  );
});
EthAddress.displayName = "EthAddress";


// Memoized skater row component
// Simplified columns for mobile
const mobileColumns: LeaderboardColumn[] = [
  {
    key: "points",
    label: "Points",
    value: (skater: SkaterData) => Math.round(skater.points),
  },
  {
    key: "power",
    label: "Power",
    value: (skater: SkaterData) =>
      formatNumber(skater.hp_balance + skater.max_voting_power_usd),
  },
  {
    key: "posts",
    label: "Posts Score",
    value: (skater: SkaterData) => skater.posts_score,
  },
];

// Full columns for desktop
const desktopColumns: LeaderboardColumn[] = [
  {
    key: "points",
    label: "🏆 Points",
    value: (skater: SkaterData) => Math.round(skater.points),
  },
  {
    key: "power",
    label: (
      <HStack spacing={1} justify="center">
        <Image src="/images/hp_logo.png" alt="" h="18px" display="inline" />
        <Text as="span">HP</Text>
      </HStack>
    ),
    value: (skater: SkaterData) =>
      formatNumber(skater.hp_balance + skater.max_voting_power_usd),
  },
  {
    key: "voting_mana",
    label: "Voting Mana",
    value: (skater: SkaterData) =>
      skater.max_voting_power_usd != null
        ? `$${skater.max_voting_power_usd.toFixed(2)}`
        : "-",
  },
  {
    key: "posts",
    label: "Posts Score",
    value: (skater: SkaterData) => skater.posts_score,
  },
  {
    key: "nfts",
    label: "SKTHV NFTs",
    value: (skater: SkaterData) => skater.skatehive_nft_balance,
  },
  {
    key: "gnars_balance",
    label: "Gnars NFTs",
    value: (skater: SkaterData) => skater.gnars_balance,
  },
  {
    key: "gnars",
    label: "Gnars Votes",
    value: (skater: SkaterData) => skater.gnars_votes,
  },
  {
    key: "hbd",
    label: (
      <HStack spacing={1} justify="center">
        <Image
          src="/images/hbd_savings.png"
          alt=""
          h="18px"
          display="inline"
        />
        <Text as="span">HBD</Text>
      </HStack>
    ),
    value: (skater: SkaterData) =>
      formatNumber(skater.hbd_balance + skater.hbd_savings_balance),
  },
  {
    key: "hive",
    label: "Hive",
    value: (skater: SkaterData) => formatNumber(skater.hive_balance),
  },
  {
    key: "donations",
    label: "Giveth",
    value: (skater: SkaterData) => formatNumber(skater.giveth_donations_usd),
  },
  {
    key: "witness",
    label: "Witness",
    value: (skater: SkaterData) =>
      skater.has_voted_in_witness ? "✅" : "❌",
  },
];

interface SkaterRowProps {
  skater: SkaterData;
  rank: number;
  columns: LeaderboardColumn[];
  isMobile: boolean;
  sortBy: SortOption;
  t: Translate;
}

const SkaterRow = React.memo(
  ({ skater, rank, columns, isMobile, sortBy, t }: SkaterRowProps) => {
    return (
      <Tr _hover={{ bg: "muted" }} transition="background 0.2s">
        <Td
          borderColor="border"
          position="sticky"
          left={0}
          bg="background"
          zIndex={1}
          minW={isMobile ? "120px" : "200px"}
          _groupHover={{ bg: "muted" }}
        >
          <HStack spacing={2}>
            <Box minW="30px">{getRankIcon(rank, sortBy, skater)}</Box>
            <Avatar
              src={`https://images.hive.blog/u/${skater.hive_author}/avatar/small`}
              name={skater.hive_author}
              size={isMobile ? "xs" : "sm"}
            />
            <VStack spacing={0} align="start" minW={0}>
              <Text
                as={Link}
                href={`https://www.skatehive.app/user/${skater.hive_author}`}
                color="primary"
                fontWeight="bold"
                fontSize={isMobile ? "xs" : "sm"}
                isTruncated
                maxW={isMobile ? "100px" : "190px"}
                target="_blank"
                rel="noopener noreferrer"
                _hover={{ color: "accent" }}
              >
                {skater.hive_author}
              </Text>
              {!isMobile &&
                skater.eth_address &&
                skater.eth_address !==
                ETH_ADDRESSES.ZERO && (
                  <EthAddress address={skater.eth_address} />
                )}
              {!isMobile && (
                <Text color="#888888" fontSize="2xs" fontWeight="medium">
                  {t('leaderboard.last')} {getTimeSince(skater.last_post, t)}
                </Text>
              )}
            </VStack>
          </HStack>
        </Td>
        {columns.map((col) => {
          const isSorted = col.key === sortBy;
          return (
            <Td
              key={col.key}
              borderColor="border"
              textAlign="center"
              fontSize={isMobile ? "xs" : "sm"}
              color={isSorted ? "#00ff88" : "text"}
              fontWeight={isSorted ? "bold" : "medium"}
              bg={isSorted ? "rgba(0, 255, 136, 0.1)" : "transparent"}
            >
              {col.value(skater)}
            </Td>
          );
        })}
      </Tr>
    );
  }
);
SkaterRow.displayName = "SkaterRow";


export default function LeaderboardClient({ skatersData }: Props) {
  const t = useTranslations();
  const [sortBy, setSortBy] = useState<SortOption>("points");
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const {
    isOpen: isAirdropOpen,
    onOpen: onAirdropOpen,
    onClose: onAirdropClose,
  } = useDisclosure();
  const isMobile = useIsMobile();

  // Responsive values
  const headerFontSize = useBreakpointValue({
    base: "2xl",
    md: "4xl",
    lg: "6xl",
  });
  const containerPadding = useBreakpointValue({ base: 2, md: 4 });

  // How many skaters actually clear the penalties.
  const scoreStats = useMemo(
    () => ({
      scored: skatersData.filter((skater) => skater.points > 0).length,
      total: skatersData.length,
    }),
    [skatersData]
  );

  // Five columns sit off-screen at common widths with nothing to hint at them.
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [hasMoreRight, setHasMoreRight] = useState(false);

  const updateScrollHint = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setHasMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  React.useEffect(() => {
    updateScrollHint();
    window.addEventListener("resize", updateScrollHint);
    return () => window.removeEventListener("resize", updateScrollHint);
  }, [updateScrollHint, isMobile]);

  const activeSort = getSortConfig(sortBy);

  // "18 of 1860 skaters have a value here" / "1656 skaters still pending" —
  // so a sparse metric does not read as a ranking of everyone.
  const sortCoverageLabel = useMemo(() => {
    if (activeSort.coverage === "none" || !activeSort.countsSkater) return null;
    const matching = skatersData.filter(activeSort.countsSkater).length;
    const key =
      activeSort.coverage === "pending"
        ? "leaderboard.coveragePending"
        : "leaderboard.coverageHasValue";
    return t(key)
      .replace("{count}", String(matching))
      .replace("{total}", String(skatersData.length));
  }, [skatersData, activeSort, t]);

  const sortedSkaters = useMemo(() => {
    // A sparse metric should not pad the ranking with skaters who have none of
    // it: only 18 skaters hold a Skatehive NFT, so that view is 18 rows, not 50
    // with 32 zeros. The checklists are exempt - they rank by what is missing.
    const eligible =
      activeSort.coverage === "hasValue" && activeSort.countsSkater
        ? skatersData.filter(activeSort.countsSkater)
        : skatersData;

    const sorted = [...eligible].sort((a, b) => {
      switch (sortBy) {
        case "points":
          return b.points - a.points;
        case "power":
          return (
            b.hp_balance +
            b.max_voting_power_usd -
            (a.hp_balance + a.max_voting_power_usd)
          );
        case "posts":
          return b.posts_score - a.posts_score;
        case "nfts":
          return b.skatehive_nft_balance - a.skatehive_nft_balance;
        case "gnars":
          return b.gnars_votes - a.gnars_votes;
        case "donations":
          return b.giveth_donations_usd - a.giveth_donations_usd;
        case "hive":
          return b.hive_balance - a.hive_balance;
        case "eth":
          // Sort by post count first, then by ETH address presence
          // This shows active users who haven't connected ETH
          const aHasEth =
            a.eth_address &&
            a.eth_address !== ETH_ADDRESSES.ZERO;
          const bHasEth =
            b.eth_address &&
            b.eth_address !== ETH_ADDRESSES.ZERO;

          if (aHasEth === bHasEth) {
            return b.posts_score - a.posts_score; // Same ETH status, sort by activity
          }
          return aHasEth ? 1 : -1; // Users without ETH rank higher
        case "gnars_balance":
          return b.gnars_balance - a.gnars_balance;
        case "witness":
          // Sort by post count first, then by witness vote presence
          // This shows active users who haven't voted for witness
          if (a.has_voted_in_witness === b.has_voted_in_witness) {
            return b.posts_score - a.posts_score; // Same witness status, sort by activity
          }
          return a.has_voted_in_witness ? 1 : -1; // Users without witness vote rank higher
        case "last_updated":
          return (
            new Date(b.last_updated).getTime() -
            new Date(a.last_updated).getTime()
          );
        default:
          return 0;
      }
    });
    return sorted.slice(0, 50); // Top 50
  }, [skatersData, sortBy, activeSort]);


  const columns = isMobile ? mobileColumns : desktopColumns;
  return (
    <VStack
      spacing={0}
      h="100vh"
      bg="background"
      color="text"
      overflow="hidden"
    >
      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
        scoredCount={scoreStats.scored}
        totalCount={scoreStats.total}
      />

      {/* Header */}
      <Box
        w="full"
        px={containerPadding}
        py={4}
        bg="background"
        borderBottom="1px solid"
        borderColor="border"
      >
        <VStack spacing={3}>
          <Text
            fontSize={headerFontSize}
            fontWeight="extrabold"
            color="primary"
            textAlign="center"
            fontFamily="heading"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            {t('leaderboard.title')}
          </Text>

          <Text
            color="text"
            fontSize={{ base: "xs", md: "sm" }}
            textAlign="center"
          >
            {t('leaderboard.skatersCount').replace('{count}', String(skatersData.length))}
          </Text>

          {/* Controls */}
          <HStack spacing={4} w="full" justify="center" flexWrap="wrap">
            <HStack spacing={2}>
              <Text fontSize="sm" fontWeight="bold" color="text">
                {t('leaderboard.sortBy')}
              </Text>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                size="sm"
                w="auto"
                minW="180px"
                bg="background"
                borderColor="border"
                color="text"
                _hover={{ borderColor: "primary" }}
                _focus={{ borderColor: "primary", boxShadow: "outline" }}
              >
                {SORT_GROUPS.map(({ group, labelKey }) => {
                  const options = SORT_OPTIONS.filter(
                    (option) => option.group === group
                  );
                  if (options.length === 0) return null;
                  return (
                    <optgroup
                      key={group}
                      label={t(`leaderboard.${labelKey}`)}
                    >
                      {options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {t(`leaderboard.${option.labelKey}`)}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </Select>
            </HStack>

            <Button
              onClick={() => setIsRulesOpen(true)}
              size="sm"
              variant="outline"
              borderColor="border"
              color="text"
              _hover={{ borderColor: "primary", color: "primary" }}
            >
              {t('leaderboard.rules')}
            </Button>

            <Button
              onClick={onAirdropOpen}
              size="sm"
              colorScheme="green"
              bg="primary"
              color="background"
              _hover={{ bg: "accent" }}
              leftIcon={<Text>🎯</Text>}
            >
              {t('leaderboard.airdrop')}
            </Button>
          </HStack>

          {/* What the selected sort actually does, and who it covers */}
          <VStack spacing={0} maxW="640px" px={2}>
            <Text
              fontSize={{ base: "xs", md: "sm" }}
              color="text"
              textAlign="center"
            >
              {t(`leaderboard.${activeSort.descriptionKey}`)}
            </Text>
            {sortCoverageLabel && (
              <Text fontSize="2xs" color="dim" textAlign="center" mt={1}>
                {sortCoverageLabel}
              </Text>
            )}
          </VStack>
        </VStack>
      </Box>

      {/* Table Container */}
      <Box flex="1" w="full" overflow="hidden" position="relative">
        {/* Fade marking the columns still off to the right */}
        {hasMoreRight && (
          <Box
            position="absolute"
            top={0}
            right={0}
            bottom={0}
            w="48px"
            pointerEvents="none"
            zIndex={4}
            bgGradient="linear(to-r, transparent, background)"
          />
        )}
        <TableContainer
          ref={scrollRef}
          onScroll={updateScrollHint}
          h="full"
          overflowY="auto"
          overflowX="auto"
          sx={{
            "&::-webkit-scrollbar": {
              width: "8px",
              height: "8px",
            },
            "&::-webkit-scrollbar-track": {
              bg: "muted",
            },
            "&::-webkit-scrollbar-thumb": {
              bg: "border",
              borderRadius: "full",
            },
            "&::-webkit-scrollbar-thumb:hover": {
              bg: "primary",
            },
          }}
        >
          <Table variant="simple" size={isMobile ? "sm" : "md"}>
            <Thead position="sticky" top={0} bg="background" zIndex={2}>
              <Tr>
                <Th
                  color="primary"
                  fontWeight="bold"
                  borderColor="border"
                  position="sticky"
                  left={0}
                  bg="background"
                  zIndex={3}
                  minW={isMobile ? "120px" : "200px"}
                >
                  {t('leaderboard.skater')}
                </Th>
                {columns.map((col) => {
                  const isSorted = col.key === sortBy;
                  return (
                    <Th
                      key={col.key}
                      color={isSorted ? "#00ff88" : "primary"}
                      fontWeight="bold"
                      borderColor="border"
                      textAlign="center"
                      minW={isMobile ? "60px" : "80px"}
                      bg={isSorted ? "rgba(0, 255, 136, 0.1)" : "transparent"}
                      aria-sort={isSorted ? "descending" : undefined}
                    >
                      {col.label}
                      {isSorted && (
                        <Text as="span" ml={1} aria-hidden="true">
                          ▼
                        </Text>
                      )}
                    </Th>
                  );
                })}
              </Tr>
            </Thead>
            <Tbody>
              {sortedSkaters.map((skater, index) => {
                const rank = index + 1;
                return (
                  <SkaterRow
                    key={skater.id}
                    skater={skater}
                    rank={rank}
                    columns={columns}
                    isMobile={isMobile}
                    sortBy={sortBy}
                    t={t}
                  />
                );
              })}
            </Tbody>
          </Table>
        </TableContainer>
      </Box>

      {/* Airdrop Modal */}
      <AirdropModal
        isOpen={isAirdropOpen}
        onClose={onAirdropClose}
        leaderboardData={skatersData}
      />
    </VStack>
  );
}
