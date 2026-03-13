"use client";

import {
  Box,
  Container,
  Text,
  Avatar,
  Flex,
  Button,
  Link,
  HStack,
  VStack,
  SimpleGrid,
  GridItem,
  Icon,
  Tooltip,
  useDisclosure,
} from "@chakra-ui/react";
import React, { useMemo, useState, useEffect } from "react";
import NextLink from "next/link";
import { Discussion } from "@hiveio/dhive";
import { getPostDate } from "@/lib/utils/GetPostDate";
import { useComments } from "@/hooks/useComments";
import { parse, isAfter, isValid } from "date-fns";
import { FaHive, FaCalendar, FaArrowLeft, FaBolt, FaTrophy, FaUsers } from "react-icons/fa";
import HiveMarkdown from "@/components/shared/HiveMarkdown";
import SnapList from "@/components/homepage/SnapList";
import SnapComposer from "@/components/homepage/SnapComposer";
import useHiveVote from "@/hooks/useHiveVote";
import useVoteWeight from "@/hooks/useVoteWeight";
import useSoftVoteOverlay from "@/hooks/useSoftVoteOverlay";
import BountyRewarder from "./BountyRewarder";

interface BountyDetailProps {
  post: Discussion;
}

const getDeadlineFromBody = (body: string): Date | null => {
  const deadlineMatch = body.match(/Deadline:\s*([^\n]+)/);
  if (deadlineMatch && deadlineMatch[1]) {
    let date = parse(deadlineMatch[1], "MM-dd-yyyy", new Date());
    if (!isValid(date)) {
      date = parse(deadlineMatch[1], "M/d/yyyy", new Date());
    }
    return isValid(date) ? date : null;
  }
  return null;
};

const BountyDetail: React.FC<BountyDetailProps> = ({ post }) => {
  const { author, created, body, title: postTitle } = post;
  const postDate = getPostDate(created);
  const { comments, isLoading, addComment } = useComments(
    post.author,
    post.permlink,
    true
  );
  const [newComment, setNewComment] = useState<Discussion | null>(null);

  const { vote, effectiveUser, canVote } = useHiveVote();
  const userVoteWeight = useVoteWeight(effectiveUser || "");
  const [sliderValue, setSliderValue] = useState(userVoteWeight);
  const [activeVotes, setActiveVotes] = useState(post.active_votes || []);
  const softVote = useSoftVoteOverlay(post.author, post.permlink);
  const hasSoftVote =
    !!softVote && softVote.status !== "failed" && softVote.weight > 0;
  const [voted, setVoted] = useState(
    hasSoftVote ||
      post.active_votes?.some(
        (item) => item.voter.toLowerCase() === effectiveUser?.toLowerCase()
      )
  );

  useEffect(() => {
    setSliderValue(userVoteWeight);
  }, [userVoteWeight]);

  useEffect(() => {
    setActiveVotes(post.active_votes || []);
    setVoted(
      hasSoftVote ||
        post.active_votes?.some(
          (item) => item.voter.toLowerCase() === effectiveUser?.toLowerCase()
        ) ||
        false
    );
  }, [post, effectiveUser, hasSoftVote]);

  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const hasClaimed = useMemo(
    () => activeVotes.some((v) => v.voter?.toLowerCase() === effectiveUser?.toLowerCase()),
    [activeVotes, effectiveUser]
  );

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [hasRewarded, setHasRewarded] = useState(false);

  // Detect if bounty was already rewarded by checking replies for the reward marker
  useEffect(() => {
    if (comments && comments.length > 0) {
      const rewardReply = comments.find(
        (c: any) =>
          c.author === post.author &&
          c.body?.includes('\u{1F3C6} Bounty Winners! \u{1F3C6}')
      );
      if (rewardReply) setHasRewarded(true);
    }
  }, [comments, post.author]);

  const challengeName = useMemo(() => {
    const match = body.match(/Trick\/Challenge:\s*(.*)/);
    return match && match[1]
      ? match[1].trim()
      : postTitle || "Bounty Submission";
  }, [body, postTitle]);

  const rules = useMemo(() => {
    const match = body.match(/Bounty Rules:\s*([\s\S]*?)(?:\n|$)/);
    return match && match[1] ? match[1].trim() : "";
  }, [body]);

  const reward = useMemo(() => {
    const match = body.match(/Reward:\s*([^\n]*)/);
    return match && match[1] ? match[1].trim() : "N/A";
  }, [body]);

  const deadline = getDeadlineFromBody(body);
  const now = new Date();
  const isActive = deadline ? isAfter(deadline, now) : true;
  const statusColor = isActive ? "success" : "error";
  const statusLabel = isActive ? "OPEN" : "CLOSED";

  const forceReward = useMemo(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return (
      params.get("forceReward") === "1" ||
      localStorage.getItem("SKATEHIVE_FORCE_BOUNTY_REWARD") === "true"
    );
  }, []);

  const uniqueCommenters = useMemo(() => {
    if (!comments) return [];
    const commenters = comments
      .map((c) => c.author)
      .filter((a) => a !== post.author);
    return Array.from(new Set(commenters));
  }, [comments, post.author]);

  const rewardInfo = useMemo(() => {
    const match = body.match(/Reward:\s*([0-9.]+)\s*(HIVE|HBD)?/i);
    if (match) {
      return {
        amount: parseFloat(match[1]),
        currency: match[2] ? match[2].toUpperCase() : "HIVE",
      };
    }
    return { amount: 0, currency: "HIVE" };
  }, [body]);

  async function handleClaimBounty() {
    if (!canVote) {
      setClaimError("You must be logged in to claim a bounty.");
      return;
    }
    setIsClaiming(true);
    setClaimError(null);
    try {
      const result = await vote(post.author, post.permlink, 10000);
      if (result.success) {
        if (effectiveUser) {
          setActiveVotes((prev) => [
            ...prev,
            { voter: effectiveUser, percent: 10000 },
          ]);
        }
      } else {
        setClaimError("Failed to claim bounty.");
      }
    } catch (err: any) {
      setClaimError(err.message || "An error occurred while claiming.");
    } finally {
      setIsClaiming(false);
    }
  }

  const claimedUsers = useMemo(() => {
    if (!activeVotes) return [];
    const seen = new Set();
    const filtered = activeVotes
      .filter((v) => v.voter && v.voter !== post.author)
      .filter((v) => {
        if (seen.has(v.voter)) return false;
        seen.add(v.voter);
        return true;
      });
    return filtered.sort((a, b) => {
      const ta = a.time ? new Date(a.time).getTime() : 0;
      const tb = b.time ? new Date(b.time).getTime() : 0;
      return tb - ta;
    });
  }, [activeVotes, post.author]);

  const deadlineStr = deadline
    ? deadline.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase()
    : null;

  const createdStr = postDate
    ? String(postDate).toUpperCase()
    : null;

  return (
    <Box bg="background" minH="100vh">
      <Container maxW="container.lg" py={{ base: 4, md: 6 }}>
        {/* ── Header bar ──────────────────────── */}
        <Box
          border="1px solid"
          borderColor="primary"
          bg="muted"
          px={{ base: 3, md: 6 }}
          py={3}
          mb={6}
        >
          <HStack justify="space-between" align="center">
            <HStack spacing={2} align="center">
              <Link
                as={NextLink}
                href="/bounties"
                color="dim"
                _hover={{ color: "primary" }}
                fontFamily="mono"
                fontSize="xs"
                fontWeight="bold"
                textTransform="uppercase"
              >
                BOUNTIES
              </Link>
              <Text color="dim" fontFamily="mono" fontSize="xs">/</Text>
              <Text
                color="primary"
                fontFamily="mono"
                fontSize="xs"
                fontWeight="bold"
                noOfLines={1}
                maxW={{ base: "180px", md: "400px" }}
              >
                {challengeName.toUpperCase()}
              </Text>
            </HStack>
            <HStack spacing={2}>
              <Icon as={FaHive} boxSize="14px" color="#E31337" />
              <Text fontSize="xs" fontFamily="mono" color="dim" fontWeight="bold">
                HIVE
              </Text>
            </HStack>
          </HStack>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 3 }} gap={6}>
          {/* ── Main content ──────────────────── */}
          <GridItem colSpan={{ base: 1, md: 2 }}>
            <VStack align="stretch" spacing={5}>
              {/* Status + meta badges */}
              <HStack spacing={3} flexWrap="wrap">
                <Box border="1px solid" borderColor={statusColor} px={2.5} py={0.5}>
                  <Text
                    fontSize="2xs"
                    fontWeight="bold"
                    fontFamily="mono"
                    color={statusColor}
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    {statusLabel}
                  </Text>
                </Box>
                {deadlineStr && (
                  <HStack spacing={1}>
                    <Icon as={FaCalendar} boxSize="10px" color="dim" />
                    <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold">
                      DEADLINE: {deadlineStr}
                    </Text>
                  </HStack>
                )}
                {createdStr && (
                  <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold">
                    POSTED: {createdStr}
                  </Text>
                )}
              </HStack>

              {/* Description panel */}
              <Box border="1px solid" borderColor="border" bg="muted">
                <Box borderBottom="1px solid" borderColor="primary" px={4} py={2}>
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    fontFamily="mono"
                    color="text"
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    RULES & DESCRIPTION
                  </Text>
                </Box>
                <Box px={4} py={4}>
                  <HiveMarkdown
                    markdown={body
                      .replace(/^Trick\/Challenge:.*$/gim, "")
                      .replace(/^Reward:.*$/gim, "")
                      .replace(/^Deadline:.*$/gim, "")
                      .replace(/^Bounty Rules: ?/gim, "")
                      .trim()}
                  />
                </Box>
              </Box>

              {/* Claimed users */}
              {claimedUsers.length > 0 && (
                <Box border="1px solid" borderColor="border" bg="muted">
                  <Box borderBottom="1px solid" borderColor="primary" px={4} py={2}>
                    <HStack spacing={2} align="center">
                      <Icon as={FaUsers} boxSize="12px" color="dim" />
                      <Text
                        fontSize="xs"
                        fontWeight="bold"
                        fontFamily="mono"
                        color="text"
                        textTransform="uppercase"
                        letterSpacing="wider"
                      >
                        CLAIMED BY ({claimedUsers.length})
                      </Text>
                    </HStack>
                  </Box>
                  <Flex wrap="wrap" gap={3} px={4} py={3}>
                    {claimedUsers.map((v) => (
                      <HStack
                        key={`${v.voter}-${v.time || ""}`}
                        spacing={2}
                        bg="background"
                        border="1px solid"
                        borderColor="border"
                        px={3}
                        py={2}
                        flex="0 0 calc(50% - 6px)"
                        minW="0"
                      >
                        <Avatar
                          size="xs"
                          name={v.voter}
                          src={`https://images.hive.blog/u/${v.voter}/avatar/sm`}
                          borderRadius="none"
                          border="1px solid"
                          borderColor="border"
                        />
                        <Box minW="0" flex="1">
                          <Link
                            as={NextLink}
                            href={`/skater/${v.voter}`}
                            fontFamily="mono"
                            fontSize="xs"
                            fontWeight="bold"
                            color="text"
                            _hover={{ color: "primary" }}
                            noOfLines={1}
                          >
                            @{v.voter}
                          </Link>
                          {v.time && (
                            <Text fontSize="2xs" color="dim" fontFamily="mono" noOfLines={1}>
                              {new Date(v.time).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              }).toUpperCase()}
                            </Text>
                          )}
                        </Box>
                      </HStack>
                    ))}
                  </Flex>
                </Box>
              )}

              {/* Claim button */}
              {isActive && effectiveUser && effectiveUser !== post.author && !hasClaimed && (
                <Button
                  onClick={handleClaimBounty}
                  isLoading={isClaiming}
                  loadingText="CLAIMING..."
                  bg="primary"
                  color="background"
                  borderRadius="none"
                  fontFamily="mono"
                  fontWeight="bold"
                  fontSize="sm"
                  textTransform="uppercase"
                  letterSpacing="wider"
                  _hover={{ bg: "accent", color: "background" }}
                  leftIcon={<Icon as={FaBolt} boxSize="12px" />}
                >
                  CLAIM BOUNTY
                </Button>
              )}
              {isActive && effectiveUser === post.author && (
                <Box
                  border="1px solid"
                  borderColor="border"
                  px={4}
                  py={2}
                  bg="muted"
                >
                  <Text fontSize="xs" color="dim" fontFamily="mono">
                    YOU CANNOT CLAIM YOUR OWN BOUNTY.
                  </Text>
                </Box>
              )}
              {claimError && (
                <Box border="1px solid" borderColor="error" px={4} py={2}>
                  <Text fontSize="xs" color="error" fontFamily="mono" fontWeight="bold">
                    {claimError}
                  </Text>
                </Box>
              )}

              {/* Closed notice */}
              {!isActive && (
                <Box
                  border="1px solid"
                  borderColor="error"
                  px={4}
                  py={3}
                  bg="rgba(255, 0, 0, 0.03)"
                >
                  <Text
                    fontSize="xs"
                    color="error"
                    fontFamily="mono"
                    fontWeight="bold"
                    textTransform="uppercase"
                  >
                    SUBMISSIONS ARE CLOSED FOR THIS BOUNTY.
                  </Text>
                </Box>
              )}

              {/* Reward button for bounty author */}
              {effectiveUser === post.author && !hasRewarded && (!isActive || forceReward) && (
                <VStack spacing={2}>
                  {isActive && forceReward && (
                    <Text fontSize="2xs" color="warning" fontFamily="mono">
                      TEST MODE: REWARDING BEFORE DEADLINE
                    </Text>
                  )}
                  <Button
                    onClick={onOpen}
                    bg="warning"
                    color="background"
                    borderRadius="none"
                    fontFamily="mono"
                    fontWeight="bold"
                    fontSize="sm"
                    textTransform="uppercase"
                    letterSpacing="wider"
                    _hover={{ opacity: 0.9 }}
                    leftIcon={<Icon as={FaTrophy} boxSize="12px" />}
                  >
                    REWARD BOUNTY HUNTERS
                  </Button>
                </VStack>
              )}
            </VStack>
          </GridItem>

          {/* ── Sidebar ────────────────────────── */}
          <GridItem colSpan={1}>
            <VStack align="stretch" spacing={5}>
              {/* Reward box */}
              <Box border="1px solid" borderColor="border" bg="muted">
                <Box borderBottom="1px solid" borderColor="primary" px={4} py={2}>
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    fontFamily="mono"
                    color="text"
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    REWARD
                  </Text>
                </Box>
                <Box px={4} py={4}>
                  <Box
                    border="1px solid"
                    borderColor="primary"
                    px={4}
                    py={3}
                    bg="rgba(167, 255, 0, 0.03)"
                    textAlign="center"
                  >
                    <HStack spacing={2} justify="center" align="center">
                      <Icon as={FaHive} boxSize="18px" color="#E31337" />
                      <Text
                        fontWeight="900"
                        fontSize="2xl"
                        color="primary"
                        fontFamily="mono"
                        lineHeight="1"
                      >
                        {rewardInfo.amount}
                      </Text>
                      <Text fontSize="sm" color="dim" fontWeight="bold" fontFamily="mono">
                        {rewardInfo.currency}
                      </Text>
                    </HStack>
                  </Box>
                </Box>
              </Box>

              {/* Details table */}
              <Box border="1px solid" borderColor="border" bg="muted">
                <Box borderBottom="1px solid" borderColor="primary" px={4} py={2}>
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    fontFamily="mono"
                    color="text"
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    DETAILS
                  </Text>
                </Box>
                <VStack align="stretch" spacing={0} px={4} py={2}>
                  <HStack py={2} borderBottom="1px solid" borderColor="border" justify="space-between">
                    <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold">AUTHOR</Text>
                    <Link
                      as={NextLink}
                      href={`/skater/${author}`}
                      display="flex"
                      alignItems="center"
                      gap={2}
                      _hover={{ textDecoration: "none" }}
                    >
                      <Avatar
                        size="2xs"
                        name={author}
                        src={`https://images.hive.blog/u/${author}/avatar/sm`}
                        borderRadius="none"
                        border="1px solid"
                        borderColor="border"
                      />
                      <Text fontSize="xs" fontFamily="mono" color="primary" fontWeight="bold">
                        @{author}
                      </Text>
                    </Link>
                  </HStack>
                  <HStack py={2} borderBottom="1px solid" borderColor="border" justify="space-between">
                    <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold">CHAIN</Text>
                    <HStack spacing={1}>
                      <Icon as={FaHive} boxSize="10px" color="#E31337" />
                      <Text fontSize="xs" fontFamily="mono" color="text" fontWeight="bold">HIVE</Text>
                    </HStack>
                  </HStack>
                  <HStack py={2} borderBottom="1px solid" borderColor="border" justify="space-between">
                    <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold">STATUS</Text>
                    <Text fontSize="xs" fontFamily="mono" color={statusColor} fontWeight="bold">
                      {statusLabel}
                    </Text>
                  </HStack>
                  {deadlineStr && (
                    <HStack py={2} borderBottom="1px solid" borderColor="border" justify="space-between">
                      <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold">DEADLINE</Text>
                      <Text fontSize="xs" fontFamily="mono" color="text" fontWeight="bold">
                        {deadlineStr}
                      </Text>
                    </HStack>
                  )}
                  <HStack py={2} justify="space-between">
                    <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold">SUBMISSIONS</Text>
                    <Text fontSize="xs" fontFamily="mono" color="text" fontWeight="bold">
                      {post.children || 0}
                    </Text>
                  </HStack>
                </VStack>
              </Box>
            </VStack>
          </GridItem>
        </SimpleGrid>

        {/* ── Submissions section ────────────── */}
        <Box mt={8}>
          <Box border="1px solid" borderColor="border" bg="muted">
            <Box borderBottom="1px solid" borderColor="primary" px={4} py={2}>
              <Text
                fontSize="sm"
                fontWeight="bold"
                fontFamily="mono"
                color="text"
                textTransform="uppercase"
                letterSpacing="wider"
              >
                SUBMISSIONS ({post.children || 0})
              </Text>
            </Box>
            <Box px={4} py={4}>
              {/* Composer for active bounties */}
              {isActive && canVote && effectiveUser !== post.author && hasClaimed && (
                <Box mb={4}>
                  <SnapComposer
                    pa={post.author}
                    pp={post.permlink}
                    onNewComment={
                      setNewComment as (newComment: Partial<Discussion>) => void
                    }
                    onClose={() => null}
                  />
                </Box>
              )}
              {isActive && canVote && effectiveUser !== post.author && !hasClaimed && (
                <Box
                  border="1px dashed"
                  borderColor="border"
                  px={4}
                  py={6}
                  textAlign="center"
                  mb={4}
                >
                  <Text fontSize="xs" fontFamily="mono" color="dim" fontWeight="bold" textTransform="uppercase">
                    CLAIM THIS BOUNTY TO SUBMIT YOUR PROOF
                  </Text>
                </Box>
              )}
              {isActive && !canVote && (
                <Box
                  border="1px dashed"
                  borderColor="border"
                  px={4}
                  py={6}
                  textAlign="center"
                  mb={4}
                >
                  <Text fontSize="xs" fontFamily="mono" color="dim" fontWeight="bold" textTransform="uppercase">
                    LOG IN TO SUBMIT
                  </Text>
                </Box>
              )}

              <SnapList
                author={post.author}
                permlink={post.permlink}
                setConversation={() => {}}
                onOpen={() => {}}
                setReply={() => {}}
                newComment={newComment}
                setNewComment={setNewComment}
                post={true}
                data={{
                  comments,
                  loadNextPage: () => {},
                  isLoading,
                  hasMore: false,
                }}
                hideComposer={true}
              />
            </Box>
          </Box>
        </Box>
      </Container>

      <BountyRewarder
        isOpen={isOpen}
        onClose={onClose}
        post={post}
        user={effectiveUser || ""}
        uniqueCommenters={uniqueCommenters}
        challengeName={challengeName}
        rewardInfo={rewardInfo}
        onRewardSuccess={() => setHasRewarded(true)}
        addComment={addComment}
      />
    </Box>
  );
};

export default BountyDetail;
