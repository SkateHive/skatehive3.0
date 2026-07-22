"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { LuArrowUp, LuCheck } from "react-icons/lu";
import useHiveVote from "@/hooks/useHiveVote";
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
  onUpvoteStoke?: (estimatedValue: number) => void; // New prop for UpvoteStoke integration
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
  onUpvoteStoke,
}: UpvoteButtonProps) => {
  const { vote, effectiveUser, canVote } = useHiveVote();
  const toast = useToast();
  const {
    voteWeight: userVoteWeight,
    disableSlider,
    isLoading,
  } = useVoteWeightContext();
  const [sliderValue, setSliderValue] = useState(userVoteWeight);
  const [isVoting, setIsVoting] = useState(false);
  const [lastVoteTime, setLastVoteTime] = useState(0);

  // Refs for immediate concurrency/debounce checks (non-atomic state guard)
  const isVotingRef = useRef(false);
  const lastVoteTimeRef = useRef(0);

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
      if (!canVote) {
        toast({
          title: "Please log in",
          description: "You need to be logged in to vote.",
          status: "warning",
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      // Use refs for immediate atomic concurrency/debounce checks
      const now = Date.now();
      
      // Prevent multiple concurrent votes using ref (immediate check)
      if (isVotingRef.current) {
        return;
      }

      // Prevent rapid successive votes using ref (debounce of 1 second)
      if (now - lastVoteTimeRef.current < 1000) {
        toast({
          title: "Please wait",
          description: "Wait a moment before voting again.",
          status: "info",
          duration: 2000,
          isClosable: true,
        });
        return;
      }

      // Set refs immediately for atomic protection
      isVotingRef.current = true;
      lastVoteTimeRef.current = now;

      // Update state for UI (can be async)
      setIsVoting(true);
      setLastVoteTime(now);

      try {
        const voteResult = await vote(
          discussion.author,
          discussion.permlink,
          votePercentage * 100
        );

        if (voteResult.success) {
          // On Hive, voting again overwrites the previous vote, so we always set voted to true
          setVoted(true);
          
          // Update active votes - prevent race conditions by using current activeVotes
          const currentVotes = [...activeVotes];
          if (effectiveUser) {
            const existingVoteIndex = currentVotes.findIndex(
              (vote: any) =>
                vote.voter?.toLowerCase() === effectiveUser?.toLowerCase()
            );
            if (existingVoteIndex >= 0) {
              // Update existing vote
              currentVotes[existingVoteIndex] = {
                voter: effectiveUser,
                weight: votePercentage * 100,
              };
              setActiveVotes(currentVotes);
            } else {
              // Add new vote
              setActiveVotes([
                ...currentVotes,
                { voter: effectiveUser, weight: votePercentage * 100 },
              ]);
            }
          }

          // Estimate the value and call onVoteSuccess if provided
          if (estimateVoteValue && onVoteSuccess && !isHivePowerLoading) {
            try {
              const estimatedValue = await estimateVoteValue(votePercentage);
              onVoteSuccess(estimatedValue);
              // Trigger UpvoteStoke animation if callback provided
              if (onUpvoteStoke && estimatedValue) {
                onUpvoteStoke(estimatedValue);
              }
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
        // Reset refs immediately for atomic protection
        isVotingRef.current = false;
        
        // Update state for UI (can be async)
        setIsVoting(false);
        if (variant === "withSlider" && setShowSlider) {
          setShowSlider(false);
        }
      }
    },
    [
      effectiveUser,
      canVote,
      vote,
      discussion.author,
      discussion.permlink,
      sliderValue,
      activeVotes,
      estimateVoteValue,
      onVoteSuccess,
      variant,
      setShowSlider,
      isHivePowerLoading,
      onUpvoteStoke,
      setActiveVotes,
      setVoted,
      toast,
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
            _hover={{ opacity: 0.7 }}
            transition="opacity 0.2s"
            className={`upvote-container ${className}`}
          >
            {voted ? (
              <LuCheck size={24} color="#22c55e" />
            ) : (
              <LuArrowUp size={24} color="var(--chakra-colors-text)" />
            )}
          </Box>
        </Tooltip>
      </HStack>
    );
  }

  // With vote count variant (matches Snap styling exactly)
  if (variant === "withVoteCount") {
    return (
      <HStack spacing={0}>
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
            _hover={{ opacity: 0.7 }}
            transition="opacity 0.2s"
            className={`upvote-container ${className}`}
          >
            {voted ? (
              <LuCheck size={24} color="#22c55e" />
            ) : (
              <LuArrowUp size={24} color="var(--chakra-colors-text)" />
            )}
          </Box>
        </Tooltip>
        <VoteListPopover
          trigger={
            <Button
              variant="ghost"
              color="gray.500"
              size={size}
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
        <HStack spacing={0}>
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
              _hover={{ opacity: 0.7 }}
              transition="opacity 0.2s"
              className={`upvote-container ${className}`}
            >
              {voted ? (
                <LuCheck size={24} color="#22c55e" />
              ) : (
                <LuArrowUp size={24} color="var(--chakra-colors-text)" />
              )}
            </Box>
          </Tooltip>
          <VoteListPopover
            trigger={
              <Button
                variant="ghost"
                color="gray.500"
                size={size}
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
      <HStack spacing={0}>
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
            _hover={{ opacity: 0.7 }}
            transition="opacity 0.2s"
            className={`upvote-container ${className}`}
          >
            {voted ? (
              <LuCheck size={24} color="#22c55e" />
            ) : (
              <LuArrowUp size={24} color="var(--chakra-colors-text)" />
            )}
          </Box>
        </Tooltip>
        <VoteListPopover
          trigger={
            <Button
              variant="ghost"
              color="gray.500"
              size={size}
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
