import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  VStack,
  HStack,
  Avatar,
  Text,
  Box,
  useColorModeValue,
  Link,
  Button,
} from "@chakra-ui/react";
import { getPayoutValue } from "@/lib/hive/client-functions";
import { useTranslations } from "@/lib/i18n/hooks";
import HiveClient from "@/lib/hive/hiveclient";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface Vote {
  voter: string;
  weight?: number | string;
  percent?: number | string;
  rshares?: number;
}

interface VoteListPopoverProps {
  trigger: React.ReactNode;
  votes: Vote[];
  post: any;
}

const VoteListPopover = ({ trigger, votes, post }: VoteListPopoverProps) => {
  const t = useTranslations('blog');
  const [votePercents, setVotePercents] = useState<Record<string, number>>({});
  const pendingRequestRef = useRef(false);

  const fetchVotePercents = useCallback(async () => {
    if (!post?.author || !post?.permlink || pendingRequestRef.current) return;

    pendingRequestRef.current = true;
    try {
      const result = await HiveClient.call("condenser_api", "get_content", [
        post.author,
        post.permlink,
      ]);
      const apiVotes = result?.active_votes ?? [];
      const percents: Record<string, number> = {};

      apiVotes.forEach((vote: any) => {
        if (typeof vote?.voter !== "string") return;
        const rawPercent = Number(vote?.percent);
        if (!Number.isNaN(rawPercent)) {
          percents[vote.voter.toLowerCase()] = rawPercent / 100;
        }
      });

      setVotePercents(percents);
    } catch (error) {
      // Ignore fetch errors; fallback to local values
    } finally {
      pendingRequestRef.current = false;
    }
  }, [post?.author, post?.permlink]);

  // Fetch only when popover is opened, not on mount
  const [hasOpened, setHasOpened] = useState(false);
  useEffect(() => {
    if (hasOpened) {
      fetchVotePercents();
    }
  }, [hasOpened, fetchVotePercents]);

  // Deduplicate votes by voter (keep the last occurrence)
  const uniqueVotesMap = new Map();
  votes.forEach((vote) => {
    uniqueVotesMap.set(vote.voter, vote);
  });
  const uniqueVotes = Array.from(uniqueVotesMap.values());

  // Sort by rshares (raw value) descending, fallback to weight if rshares is missing
  const sortedVotes = [...uniqueVotes].sort((a, b) => {
    const aValue = typeof a.rshares === "number" ? a.rshares : a.weight || 0;
    const bValue = typeof b.rshares === "number" ? b.rshares : b.weight || 0;
    return bValue - aValue;
  });

  // Calculate total rshares for the post
  const totalRshares = uniqueVotes.reduce((sum, v) => sum + (typeof v.rshares === "number" ? v.rshares : 0), 0);
  // Get payout value for the post
  const payout = parseFloat(getPayoutValue(post));

  // Use theme colors
  const hoverBg = useColorModeValue("gray.100", "gray.800");
  const valueColor = useColorModeValue("green.600", "green.300");
  const emptyColor = useColorModeValue("gray.500", "gray.400");
  return (
    <Popover placement="auto" isLazy onOpen={() => setHasOpened(true)}>
      <PopoverTrigger>{trigger}</PopoverTrigger>
      <PopoverContent w="320px" maxH="300px" overflowY="auto" bg={"background"}>
        <PopoverHeader fontWeight="bold">Voters</PopoverHeader>
        <PopoverBody>
          <VStack
            align="stretch"
            spacing={1}
            sx={{
              scrollbarWidth: 'none', // Firefox
              '::-webkit-scrollbar': { display: 'none' }, // Chrome/Safari
            }}
          >
            {sortedVotes.length === 0 && (
              <Text color={emptyColor}>{t('noVotesYet')}</Text>
            )}
            {sortedVotes.map((vote, idx) => {
                const rshares = typeof vote.rshares === "number" ? vote.rshares : 0;
                const weightValue = typeof vote.weight === "number"
                  ? vote.weight
                  : typeof vote.weight === "string"
                  ? Number(vote.weight)
                  : undefined;
                const percentValue = typeof vote.percent === "number"
                  ? vote.percent
                  : typeof vote.percent === "string"
                  ? Number(vote.percent)
                  : undefined;

                // Estimate dollar value
                const dollarValue = totalRshares > 0 ? (rshares / totalRshares) * payout : 0;

                const percentCandidate =
                  typeof percentValue === "number" && !Number.isNaN(percentValue)
                    ? percentValue
                    : null;
                const weightCandidate =
                  typeof weightValue === "number" && !Number.isNaN(weightValue)
                    ? weightValue
                    : null;

                const normalizedPercent = (value: number | null) => {
                  if (value === null) return null;
                  const absValue = Math.abs(value);
                  if (absValue <= 100) {
                    return value;
                  }
                  if (absValue <= 10000) {
                    return value / 100;
                  }
                  return null;
                };

                const directPercent =
                  normalizedPercent(percentCandidate) ??
                  normalizedPercent(weightCandidate);

                const apiPercent = votePercents[vote.voter?.toLowerCase()];

                const displayPercentValue =
                  typeof apiPercent === "number"
                    ? apiPercent
                    : directPercent;

                const displayPercent =
                  typeof displayPercentValue === "number"
                    ? `${displayPercentValue.toFixed(2)}%`
                    : "N/A";

                return (
                  <HStack key={vote.voter + idx} spacing={1} p={0.5} borderRadius="md" _hover={{ bg: hoverBg }} minH="32px">
                    <Link
                      href={`/user/${vote.voter}`}
                      display="flex"
                      alignItems="center"
                      flex={1}
                      minW={0}
                      _hover={{ textDecoration: "underline" }}
                    >
                      <Avatar size="sm" name={vote.voter} src={`https://images.hive.blog/u/${vote.voter}/avatar/sm`} mr={1} />
                      <Text fontWeight="medium" fontSize="sm" isTruncated>{vote.voter}</Text>
                      <Text ml={2} fontSize="xs" color="gray.500" isTruncated>
                        ({displayPercent})
                      </Text>
                    </Link>
                    <Text fontFamily="mono" color={valueColor} fontSize="sm">
                      ${dollarValue.toFixed(4)}
                    </Text>
                  </HStack>
                );
            })}
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
};

export default VoteListPopover; 