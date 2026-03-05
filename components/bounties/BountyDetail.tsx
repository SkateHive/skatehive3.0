"use client";

import {
  Box,
  Text,
  Avatar,
  Flex,
  Button,
  Link,
  Divider,
  Badge,
  useTheme,
  useDisclosure,
  Tooltip,
} from "@chakra-ui/react";
import React, { useMemo, useState, useEffect } from "react";
import { Discussion } from "@hiveio/dhive";
import { getPostDate } from "@/lib/utils/GetPostDate";
import { useComments } from "@/hooks/useComments";
import { parse, isAfter, isValid } from "date-fns";
import HiveMarkdown from "@/components/shared/HiveMarkdown";
import SnapList from "@/components/homepage/SnapList";
import SnapComposer from "@/components/homepage/SnapComposer";
import MatrixOverlay from "@/components/graphics/MatrixOverlay";
import useHiveVote from "@/hooks/useHiveVote";
import useHivePower from "@/hooks/useHivePower";
import BountyRewarder from "./BountyRewarder";
import useVoteWeight from "@/hooks/useVoteWeight";
import useSoftVoteOverlay from "@/hooks/useSoftVoteOverlay";

interface BountyDetailProps {
  post: Discussion;
}

const getDeadlineFromBody = (body: string): Date | null => {
  const deadlineMatch = body.match(/Deadline:\s*([^\n]+)/);
  if (deadlineMatch && deadlineMatch[1]) {
    // Try MM-dd-yyyy
    let date = parse(deadlineMatch[1], "MM-dd-yyyy", new Date());
    if (!isValid(date)) {
      // Try M/d/yyyy
      date = parse(deadlineMatch[1], "M/d/yyyy", new Date());
    }
    return isValid(date) ? date : null;
  }
  return null;
};

const BountyDetail: React.FC<BountyDetailProps> = ({ post }) => {
  const { author, created, body, title: postTitle } = post;
  const postDate = getPostDate(created);
  const theme = useTheme();
  const { comments, isLoading, addComment } = useComments(
    post.author,
    post.permlink,
    true
  );
  const [newComment, setNewComment] = useState<Discussion | null>(null);

  // Voting state
  const { vote, effectiveUser, canVote } = useHiveVote();
  const userVoteWeight = useVoteWeight(effectiveUser || "");
  const [sliderValue, setSliderValue] = useState(userVoteWeight);
  const [showSlider, setShowSlider] = useState(false);
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

  // Update slider value when user's vote weight changes
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

  // Claim state
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const hasClaimed = useMemo(
    () => activeVotes.some((v) => v.voter?.toLowerCase() === effectiveUser?.toLowerCase()),
    [activeVotes, effectiveUser]
  );

  // Reward Modal State
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [hasRewarded, setHasRewarded] = useState(false); // TODO: Replace with real check

  // Extract bounty fields
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

  // TEMP/ADMIN override: allow bounty author to reward winners before deadline
  // Enable via URL: ?forceReward=1 (or localStorage SKATEHIVE_FORCE_BOUNTY_REWARD=true)
  const forceReward = useMemo(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return (
      params.get("forceReward") === "1" ||
      localStorage.getItem("SKATEHIVE_FORCE_BOUNTY_REWARD") === "true"
    );
  }, []);

  // Get unique commenters (exclude bounty creator)
  const uniqueCommenters = useMemo(() => {
    if (!comments) return [];
    const commenters = comments
      .map((c) => c.author)
      .filter((author) => author !== post.author);
    return Array.from(new Set(commenters));
  }, [comments, post.author]);

  // Calculate reward per winner
  const totalReward = useMemo(() => {
    const match = body.match(/Reward:\s*([0-9.]+)/);
    return match && match[1] ? parseFloat(match[1]) : 0;
  }, [body]);

  // Parse reward amount and currency from body
  const rewardInfo = useMemo(() => {
    // Match e.g. "Reward: 10 HIVE" or "Reward: 5.5 HBD"
    const match = body.match(/Reward:\s*([0-9.]+)\s*(HIVE|HBD)?/i);
    if (match) {
      return {
        amount: parseFloat(match[1]),
        currency: match[2] ? match[2].toUpperCase() : "HIVE",
      };
    }
    return { amount: 0, currency: "HIVE" };
  }, [body]);

  // function handleHeartClick() {
  //   setShowSlider(!showSlider);
  // }

  async function handleVote() {
    if (!canVote) return;
    try {
      const voteResult = await vote(
        post.author,
        post.permlink,
        sliderValue * 100
      );
      if (voteResult.success) {
        setVoted(true);
        if (effectiveUser) {
          setActiveVotes([...activeVotes, { voter: effectiveUser, percent: sliderValue * 100 }]);
        }
      }
    } catch (error: any) {
      setClaimError(error?.message || "Failed to vote on bounty.");
    } finally {
      setShowSlider(false);
    }
  }

  // Handler for claiming the bounty
  async function handleClaimBounty() {
    if (!canVote) {
      setClaimError("You must be logged in to claim a bounty.");
      return;
    }
    setIsClaiming(true);
    setClaimError(null);
    try {
      // Use a 100% vote to claim the bounty
      const result = await vote(post.author, post.permlink, 10000);
      if (result.success) {
        // Optimistically update the votes list
        if (effectiveUser) {
          setActiveVotes((prev) => [
            ...prev,
            { voter: effectiveUser, percent: 10000 },
          ]);
        }
      } else {
        setClaimError("Failed to claim bounty. Your vote was not successful.");
      }
    } catch (err: any) {
      setClaimError(
        err.message || "An error occurred while claiming the bounty."
      );
    } finally {
      setIsClaiming(false);
    }
  }

  const renderComposerOrBlocker = () => {
    if (!isActive) {
      return null;
    }

    if (!canVote) {
      return (
        <Box textAlign="center" p={4} bg="gray.800" borderRadius="md">
          <Text>Please log in to submit.</Text>
        </Box>
      );
    }

    if (effectiveUser === post.author) {
      return null;
    }

    if (!hasClaimed) {
      return (
        <Box
          position="relative"
          p={4}
          borderRadius="none"
          bg="gray.800"
          textAlign="center"
          height="150px"
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          overflow="hidden"
        >
          <MatrixOverlay />
          <Box position="relative" zIndex={1}>
            <Text fontWeight="bold" fontSize="lg" color="white">
              Claim Bounty to Submit
            </Text>
            <Text color="gray.300">
              Click &quot;Claim Bounty&quot; on the left to unlock submissions.
            </Text>
          </Box>
        </Box>
      );
    }

    return (
      <SnapComposer
        pa={post.author}
        pp={post.permlink}
        onNewComment={
          setNewComment as (newComment: Partial<Discussion>) => void
        }
        onClose={() => null}
      />
    );
  };

  // Claimed users (exclude post author, dedupe, sorted by time desc)
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
    // Sort by time descending (most recent first)
    return filtered.sort((a, b) => {
      const ta = a.time ? new Date(a.time).getTime() : 0;
      const tb = b.time ? new Date(b.time).getTime() : 0;
      return tb - ta;
    });
  }, [activeVotes, post.author]);

  return (
    <Box bg="background" color="text" minH="100vh">
      <Flex
        direction={{ base: "column", md: "row" }}
        h={{ base: "auto", md: "100vh" }}
        gap={4}
      >
        {/* Left: Bounty Details */}
        <Box
          flex={1}
          h={{ base: "auto", md: "100vh" }}
          overflowY="auto"
          sx={{
            "&::-webkit-scrollbar": { display: "none" },
            scrollbarWidth: "none",
          }}
        >
          <Box
            data-component="BountyDetail"
            borderRadius="base"
            overflow="hidden"
            bg="muted"
            mb={3}
            p={2}
            w="100%"
            mt={{ base: "0px", md: "10px" }}
            boxShadow={theme.shadows.md}
          >
            {/* Header */}
            <Flex
              direction="column"
              boxShadow={theme.shadows.md}
              bg={
                theme.colors.primary
                  ? `linear-gradient(to bottom, ${theme.colors.primary}, ${theme.colors.accent})`
                  : undefined
              }
              p={2}
              mb={4}
              borderRadius="lg"
            >
              {/* Challenge Name at the top */}
              <Text
                fontSize={{ base: "xl", md: "2xl" }}
                fontWeight="bold"
                color={theme.colors.background}
                mb={4}
                textAlign="center"
              >
                {challengeName}
              </Text>

              <Flex
                direction={{ base: "column", md: "row" }}
                alignItems="center"
                justify="space-between"
                w="100%"
                gap={4}
              >
                {/* Left Section: Avatar and User Info */}
                <Flex
                  alignItems="center"
                  gap={4}
                  minW={0}
                  flex={{ base: "1", md: "0 0 auto" }}
                >
                  <Avatar
                    size={{ base: "md", md: "lg" }}
                    name={author}
                    src={`https://images.hive.blog/u/${author}/avatar/sm`}
                    border="3px solid"
                    borderColor={theme.colors.background}
                    boxShadow="0 4px 12px rgba(0,0,0,0.15)"
                  />
                  <Box minW={0} flex="1">
                    <Text
                      fontWeight="bold"
                      fontSize={{ base: "md", md: "lg" }}
                      color={theme.colors.background}
                      mb={1}
                      isTruncated
                    >
                      <Link
                        href={`/user/${author}`}
                        color={theme.colors.background}
                        _hover={{ textDecoration: "underline" }}
                      >
                        @{author}
                      </Link>
                    </Text>
                    <Text
                      fontSize="sm"
                      color={theme.colors.background}
                      opacity={0.8}
                    >
                      {postDate}
                    </Text>
                  </Box>
                </Flex>

                {/* Divider for desktop */}
                <Divider
                  orientation="vertical"
                  h="60px"
                  borderColor={theme.colors.background}
                  opacity={0.3}
                  display={{ base: "none", md: "block" }}
                />

                {/* Divider for mobile */}
                <Divider
                  orientation="horizontal"
                  borderColor={theme.colors.background}
                  opacity={0.3}
                  display={{ base: "block", md: "none" }}
                  w="100%"
                />

                {/* Right Section: Bounty Status */}
                <Box
                  textAlign="center"
                  flex={{ base: "1", md: "0 0 auto" }}
                  minW={0}
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text
                    fontSize={{ base: "xl", md: "2xl", lg: "3xl" }}
                    fontWeight="extrabold"
                    color={
                      isActive
                        ? theme.colors.background
                        : theme.colors.background
                    }
                    letterSpacing="tight"
                    textShadow="0 2px 8px rgba(0,0,0,0.25)"
                    lineHeight="1.1"
                    opacity={isActive ? 1 : 0.7}
                    mb={3}
                  >
                    {isActive ? "Active Bounty" : "Closed Bounty"}
                  </Text>

                  {/* Reward Badge */}
                  <Badge
                    colorScheme={isActive ? "green" : "gray"}
                    variant="solid"
                    fontSize={{ base: "md", md: "lg" }}
                    px={4}
                    py={2}
                    borderRadius="full"
                    boxShadow="0 4px 12px rgba(0,0,0,0.15)"
                  >
                    Reward: {reward}
                  </Badge>

                  {!isActive && (
                    <Text
                      fontSize="sm"
                      color={theme.colors.background}
                      opacity={0.6}
                      mt={2}
                    >
                      No longer accepting submissions
                    </Text>
                  )}
                </Box>
              </Flex>
            </Flex>
            {/* Bounty Details */}
            <Box mb={4}>
              <Text fontWeight="bold" color="orange.300" fontSize="lg">
                Reward: {reward}
              </Text>
              <Text color="gray.500" fontSize="md">
                Deadline: {deadline ? deadline.toLocaleDateString() : "N/A"}
              </Text>
            </Box>
            <Divider />
            {/* Rules/Description */}
            <Box my={4}>
              <Text fontWeight="bold" mb={1}>
                Rules:
              </Text>
              <HiveMarkdown
                markdown={body
                  .replace(/^Trick\/Challenge:.*$/gim, "")
                  .replace(/^Reward:.*$/gim, "")
                  .replace(/^Deadline:.*$/gim, "")
                  .replace(/^Bounty Rules: ?/gim, "")
                  .trim()}
              />
            </Box>
            {/* Claimed Users Section (moved from right panel) */}
            {claimedUsers.length > 0 && (
              <Box mb={4}>
                <Text fontWeight="bold" fontSize="lg" mb={2} color="text">
                  Claimed By{" "}
                  <Tooltip
                    label="People who want to attempt this bounty"
                    placement="top"
                  >
                    <Text as="span" color="accent" cursor="help">
                      ({claimedUsers.length})
                    </Text>
                  </Tooltip>
                  :
                </Text>
                <Flex wrap="wrap" gap={3}>
                  {claimedUsers.map((vote) => (
                    <Flex
                      key={`${vote.voter}-${vote.time || ""}`}
                      align="center"
                      gap={2}
                      bg="muted"
                      p={2}
                      borderRadius="none"
                      border="1px solid"
                      borderColor="border"
                      flex="0 0 calc(50% - 6px)"
                      minW="0"
                    >
                      <Avatar
                        size="sm"
                        name={vote.voter}
                        src={`https://images.hive.blog/u/${vote.voter}/avatar/sm`}
                      />
                      <Box minW="0" flex="1">
                        <Text noOfLines={1}>
                          <Link
                            href={`/user/${vote.voter}`}
                            _hover={{ textDecoration: "underline" }}
                          >
                            @{vote.voter}
                          </Link>
                        </Text>
                        {vote.time && (
                          <Text fontSize="xs" color="accent" noOfLines={1}>
                            {new Date(vote.time).toLocaleString()}
                          </Text>
                        )}
                      </Box>
                    </Flex>
                  ))}
                </Flex>
              </Box>
            )}
            {/* Claim Bounty Button */}
            {isActive &&
              effectiveUser &&
              effectiveUser !== post.author &&
              !hasClaimed && (
              <Flex justify="center" my={4}>
                <Button
                  colorScheme="green"
                  onClick={handleClaimBounty}
                  isLoading={isClaiming}
                >
                  Claim Bounty (100% Vote)
                </Button>
              </Flex>
            )}
            {isActive && effectiveUser === post.author && (
              <Box textAlign="center" my={4}>
                <Text color="gray.400">You cannot claim your own bounty.</Text>
              </Box>
            )}
            {claimError && (
              <Text color="red.400" textAlign="center">
                {claimError}
              </Text>
            )}
            {/* Media Section */}
            {/* Media Section removed, as full body is now shown above */}
            <Divider />
            {/* Submission Composer Removed */}
            {!isActive && (
              <Text color="red.400" fontWeight="bold" textAlign="center" my={4}>
                Submissions are closed for this bounty.
              </Text>
            )}
            {/* Reward Bounty Hunters Button */}
            {effectiveUser === post.author && !hasRewarded && (!isActive || forceReward) && (
              <Flex justify="center" my={2} flexDir="column" align="center" gap={2}>
                {isActive && forceReward && (
                  <Text fontSize="sm" color="orange.300" textAlign="center">
                    Test mode enabled: rewarding before deadline.
                  </Text>
                )}
                <Button colorScheme="orange" onClick={onOpen} fontWeight="bold">
                  Reward Bounty Hunters
                </Button>
              </Flex>
            )}
          </Box>
        </Box>
        {/* Right: Submissions List */}
        <Box
          flex={1}
          h={{ base: "auto", md: "100vh" }}
          overflowY="auto"
          bg="muted"
          borderRadius="base"
          boxShadow={theme.shadows.md}
          p={4}
          sx={{
            "&::-webkit-scrollbar": { display: "none" },
            scrollbarWidth: "none",
          }}
        >
          {/* Claimed Users Section removed from here */}
          <Text fontWeight="bold" fontSize="2xl" textAlign="left" mb={2} mt={2}>
            Submissions: {post.children || 0}
          </Text>
          {renderComposerOrBlocker()}
          {isActive && <Divider my={4} />}
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
      </Flex>
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
