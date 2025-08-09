"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  Button,
  Tooltip,
  useToast,
  HStack,
  Flex,
  Image,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
} from "@chakra-ui/react";
import { LuArrowUpRight } from "react-icons/lu";
import { useAioha } from "@aioha/react-ui";
import { Discussion } from "@hiveio/dhive";
import VoteListPopover from "@/components/blog/VoteListModal";
import { useVoteWeightContext } from "@/contexts/VoteWeightContext";

interface UpvoteButtonProps {
  discussion: Discussion;
  voted: boolean;
  setVoted: (voted: boolean) => void;
  activeVotes: any[];
  setActiveVotes: (votes: any[]) => void;
  onVoteSuccess?: (estimatedValue?: number) => void;
  estimateVoteValue?: (percentage: number) => Promise<number>;
  isHivePowerLoading?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "simple" | "withSlider" | "withVoteCount";
  showSlider?: boolean;
  setShowSlider?: (show: boolean) => void;
  className?: string;
}

const UpvoteButton = ({
  discussion,
  voted,
  setVoted,
  activeVotes,
  setActiveVotes,
  onVoteSuccess,
  estimateVoteValue,
  isHivePowerLoading = false,
  size = "sm",
  variant = "simple",
  showSlider = false,
  setShowSlider,
  className,
}: UpvoteButtonProps) => {
  const { aioha, user } = useAioha();
  const toast = useToast();
  const {
    voteWeight: userVoteWeight,
    disableSlider,
    isLoading,
  } = useVoteWeightContext();
  const [sliderValue, setSliderValue] = useState(userVoteWeight);
  const [isVoting, setIsVoting] = useState(false);

  // Update slider value when user's vote weight changes from context
  useEffect(() => {
    setSliderValue(userVoteWeight);
  }, [userVoteWeight]);

  // Memoize unique votes to prevent unnecessary recalculations
  const uniqueVotes = useMemo(() => {
    const uniqueVotesMap = new Map();
    activeVotes.forEach((vote) => {
      uniqueVotesMap.set(vote.voter, vote);
    });
    return Array.from(uniqueVotesMap.values());
  }, [activeVotes]);

const handleVote = useCallback(
    async (votePercentage: number = sliderValue) => {
      if (!user) {
        toast({
          title: "Please log in",
          description: "You need to be logged in to vote.",
          status: "warning",
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      setIsVoting(true);

      try {
        const vote = await aioha.vote(
          discussion.author,
          discussion.permlink,
          votePercentage * 100
        );

        if (vote.success) {
          // On Hive, voting again overwrites the previous vote, so we always set voted to true
          setVoted(true);
          
          // Update active votes - replace or add the user's vote
          const existingVoteIndex = activeVotes.findIndex(vote => vote.voter === user);
          if (existingVoteIndex >= 0) {
            // Update existing vote
            const updatedVotes = [...activeVotes];
            updatedVotes[existingVoteIndex] = { voter: user, weight: votePercentage * 100 };
            setActiveVotes(updatedVotes);
          } else {
            // Add new vote
            setActiveVotes([...activeVotes, { voter: user, weight: votePercentage * 100 }]);
          }

          // Estimate the value and call onVoteSuccess if provided
          if (estimateVoteValue && onVoteSuccess && !isHivePowerLoading) {
            try {
              const estimatedValue = await estimateVoteValue(votePercentage);
              onVoteSuccess(estimatedValue);
            } catch (e) {
              onVoteSuccess();
            }
          } else if (onVoteSuccess) {
            onVoteSuccess();
          }

          toast({
            title: "Vote submitted!",
            status: "success",
            duration: 3000,
            isClosable: true,
          });
        }
      } catch (error: any) {
        toast({
          title: "Failed to vote",
          description: error.message || "Please try again",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      } finally {
        setIsVoting(false);
        if (variant === "withSlider" && setShowSlider) {
          setShowSlider(false);
        }
      }
    },
    [
      user,
      aioha,
      discussion.author,
      discussion.permlink,
      sliderValue,
      setVoted,
      setActiveVotes,
      activeVotes,
      estimateVoteValue,
      onVoteSuccess,
      toast,
      variant,
      setShowSlider,
      isHivePowerLoading,
    ]
  );

  const handleHeartClick = useCallback(() => {
    // Don't allow voting if user info is still loading
    if (isLoading) {
      toast({
        title: "Please wait",
        description: "Loading user preferences...",
        status: "info",
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    if (variant === "withSlider" && setShowSlider && !disableSlider) {
      // Only show slider if it's not disabled in user preferences
      setShowSlider(!showSlider);
    } else if (
      variant === "simple" ||
      variant === "withVoteCount" ||
      disableSlider
    ) {
      // If slider is disabled or it's a simple variant, vote directly with preferred weight
      handleVote(userVoteWeight);
    }
  }, [
    variant,
    setShowSlider,
    showSlider,
    userVoteWeight,
    disableSlider,
    isLoading,
    toast,
    handleVote,
  ]);

  

  // Simple variant - just the upvote button (matches Snap styling)
  if (variant === "simple") {
    return (
      <HStack>
        <Tooltip
          label={voted ? "already voted" : "upvote"}
          hasArrow
          openDelay={1000}
        >
          <Box
            as="span"
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            onClick={handleHeartClick}
            p={1}
            borderRadius="full"
            bg={voted ? "muted" : !voted ? "muted" : undefined}
            border="1px solid"
            borderColor="primary"
            _hover={{ bg: "muted" }}
            transition="background 0.2s, border-radius 0.2s"
            className={`upvote-container ${className} ${
              !voted ? "arrow-bg-fade" : ""
            }`}
          >
            <LuArrowUpRight
              size={24}
              color={voted ? "var(--chakra-colors-success)" : "var(--chakra-colors-primary)"}
              style={{ opacity: 1 }}
              className={!voted ? "arrow-pulse-hover" : ""}
            />
          </Box>
        </Tooltip>
      </HStack>
    );
  }

  // With vote count variant (matches Snap styling exactly)
  if (variant === "withVoteCount") {
    return (
      <HStack>
        <Tooltip
          label={voted ? "already voted" : "upvote"}
          hasArrow
          openDelay={1000}
        >
          <Box
            as="span"
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            onClick={handleHeartClick}
            p={1}
            borderRadius="full"
            bg={voted ? "muted" : !voted ? "muted" : undefined}
            border="1px solid"
            borderColor="primary"
            _hover={{ bg: "muted" }}
            transition="background 0.2s, border-radius 0.2s"
            className={`upvote-container ${className} ${
              !voted ? "arrow-bg-fade" : ""
            }`}
          >
            <LuArrowUpRight
              size={24}
              color={voted ? "var(--chakra-colors-success)" : "var(--chakra-colors-primary)"}
              style={{ opacity: 1 }}
              className={!voted ? "arrow-pulse-hover" : ""}
            />
          </Box>
        </Tooltip>
        <VoteListPopover
          trigger={
            <Button
              variant="ghost"
              size={size}
              ml={0}
              p={1}
              _hover={{ textDecoration: "underline" }}
              onClick={(e) => e.stopPropagation()}
            >
              {uniqueVotes.length}
            </Button>
          }
          votes={activeVotes}
          post={discussion}
        />
      </HStack>
    );
  }

  // With slider variant (matches Snap styling exactly)
  if (variant === "withSlider") {
    // If slider is disabled in user preferences, don't show the slider
    if (disableSlider) {
      return (
        <HStack>
          <Tooltip
            label={voted ? "already voted" : "upvote"}
            hasArrow
            openDelay={1000}
          >
            <Box
              as="span"
              display="flex"
              alignItems="center"
              justifyContent="center"
              cursor="pointer"
              onClick={handleHeartClick}
              p={1}
              borderRadius="full"
              bg={voted ? "muted" : !voted ? "muted" : undefined}
              border="1px solid"
              borderColor="primary"
              _hover={{ bg: "muted" }}
              transition="background 0.2s, border-radius 0.2s"
              className={`upvote-container ${className} ${
                !voted ? "arrow-bg-fade" : ""
              }`}
            >
              <LuArrowUpRight
                size={24}
                color={voted ? "var(--chakra-colors-success)" : "var(--chakra-colors-primary)"}
                style={{ opacity: 1 }}
                className={!voted ? "arrow-pulse-hover" : ""}
              />
            </Box>
          </Tooltip>
          <VoteListPopover
            trigger={
              <Button
                variant="ghost"
                size={size}
                ml={1}
                p={1}
                _hover={{ textDecoration: "underline" }}
                onClick={(e) => e.stopPropagation()}
              >
                {uniqueVotes.length}
              </Button>
            }
            votes={activeVotes}
            post={discussion}
          />
        </HStack>
      );
    }

    // If slider is enabled, show the normal slider functionality
    if (showSlider) {
      return (
        <Flex mt={4} alignItems="center">
          <Box width="100%" mr={2}>
            <Slider
              aria-label="vote-slider"
              min={0}
              max={100}
              value={sliderValue}
              onChange={(val) => setSliderValue(val)}
            >
              <SliderTrack
                bg="gray.700"
                height="8px"
                boxShadow="0 0 10px rgba(255, 255, 0, 0.8)"
              >
                <SliderFilledTrack bgGradient="linear(to-r, success, warning, error)" />
              </SliderTrack>
              <SliderThumb
                boxSize="30px"
                bg="transparent"
                boxShadow={"none"}
                _focus={{ boxShadow: "none" }}
                zIndex={1}
              >
                <Image
                  src="/images/spitfire.png"
                  alt="thumb"
                  w="100%"
                  h="auto"
                  mr={2}
                  mb={1}
                />
              </SliderThumb>
            </Slider>
          </Box>
          <Button
            size={size}
            onClick={() => handleVote()}
            ml={2}
            bgGradient="linear(to-r, primary, accent)"
            color="background"
            _hover={{ bg: "accent" }}
            fontWeight="bold"
            className="subtle-pulse"
            isDisabled={isVoting}
            isLoading={isVoting}
          >
            {isVoting ? "Voting..." : `Vote ${sliderValue}%`}
          </Button>
          <Button
            size={size}
            onClick={handleHeartClick}
            ml={2}
            bg="muted"
            color="primary"
            _hover={{ bg: "muted", opacity: 0.8 }}
          >
            X
          </Button>
        </Flex>
      );
    }

    return (
      <HStack>
        <Tooltip
          label={voted ? "already voted" : "upvote"}
          hasArrow
          openDelay={1000}
        >
          <Box
            as="span"
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            onClick={handleHeartClick}
            p={1}
            borderRadius="full"
            bg={voted ? "muted" : !voted ? "muted" : undefined}
            border="1px solid"
            borderColor="primary"
            _hover={{ bg: "muted" }}
            transition="background 0.2s, border-radius 0.2s"
            className={`upvote-container ${className} ${
              !voted ? "arrow-bg-fade" : ""
            }`}
          >
            <LuArrowUpRight
              size={24}
              color={voted ? "var(--chakra-colors-success)" : "var(--chakra-colors-primary)"}
              style={{ opacity: 1 }}
              className={!voted ? "arrow-pulse-hover" : ""}
            />
          </Box>
        </Tooltip>
        <VoteListPopover
          trigger={
            <Button
              variant="ghost"
              size={size}
              ml={1}
              p={1}
              _hover={{ textDecoration: "underline" }}
              onClick={(e) => e.stopPropagation()}
            >
              {uniqueVotes.length}
            </Button>
          }
          votes={activeVotes}
          post={discussion}
        />
      </HStack>
    );
  }

  return null;
};

const UpvoteButtonWithPulse = (props: UpvoteButtonProps) => {
  return <UpvoteButton {...props} />;
};

export default UpvoteButtonWithPulse;
