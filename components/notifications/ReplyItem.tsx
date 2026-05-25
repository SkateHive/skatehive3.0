"use client";

import {
  Box,
  Avatar,
  Text,
  HStack,
  VStack,
  Flex,
} from "@chakra-ui/react";
import { Discussion } from "@hiveio/dhive";
import { useState, useEffect } from "react";
import { fetchComments } from "../../lib/hive/fetchComments";
import SnapComposer from "../homepage/SnapComposer";
import HiveMarkdown from "../shared/HiveMarkdown";
import UpvoteButton from "../shared/UpvoteButton";

interface ReplyItemProps {
  reply: Discussion;
  currentUser: string;
}

export default function ReplyItem({ reply, currentUser }: ReplyItemProps) {
  const [showReplies, setShowReplies] = useState<boolean>(false);
  const [nestedReplies, setNestedReplies] = useState<Discussion[]>([]);
  const [nestedRepliesLoading, setNestedRepliesLoading] =
    useState<boolean>(false);
  const [hasVoted, setHasVoted] = useState<boolean>(false);
  const [showSlider, setShowSlider] = useState<boolean>(false);

  // Check if user has voted on this reply
  useEffect(() => {
    if (reply.active_votes && currentUser) {
      const userVoted = reply.active_votes.some(
        (vote) => vote.voter?.toLowerCase() === currentUser?.toLowerCase()
      );
      setHasVoted(userVoted);
    }
  }, [reply.active_votes, currentUser]);

  // Handle new nested replies
  function handleNewNestedReply(newComment: Partial<Discussion>) {
    const newReply = newComment as Discussion;
    setNestedReplies((prev) => [...prev, newReply]);
  }

  // Fetch existing nested replies
  async function fetchNestedReplies() {
    setNestedRepliesLoading(true);
    try {
      const existingReplies = await fetchComments(
        reply.author,
        reply.permlink,
        false
      );
      setNestedReplies(existingReplies);
    } catch (error) {
      console.error("Error fetching nested replies:", error);
      setNestedReplies([]);
    } finally {
      setNestedRepliesLoading(false);
    }
  }

  // Handle reply button click
  function handleReplyClick() {
    if (!showReplies) {
      setShowReplies(true);
      fetchNestedReplies();
    } else {
      setShowReplies(false);
    }
  }

  return (
    <Box
      p={2}
      borderRadius="md"
      bg="muted"
      borderLeft="2px solid"
      borderColor="border"
      ml={4}
    >
      {/* Reply content */}
      <HStack mb={1} spacing={2}>
        <Avatar
          size="xs"
          name={reply.author}
          src={`https://images.hive.blog/u/${reply.author}/avatar/sm`}
        />
        <Text fontSize="xs" fontWeight="bold" color="primary">
          {reply.author}
        </Text>
        <Text fontSize="xs" color="muted">
          {reply.created === "just now"
            ? "just now"
            : new Date(reply.created + "Z").toLocaleString()}
        </Text>
      </HStack>
      <Box ml={6} mb={2}>
        <HiveMarkdown markdown={reply.body} />
      </Box>

      {/* Reply actions */}
      <Box ml={6}>
        <Flex alignItems="center" w="100%">
          <Text
            onClick={handleReplyClick}
            fontSize="xs"
            cursor="pointer"
            mr={2}
            color="primary"
            _hover={{ textDecoration: "underline" }}
          >
            Reply
          </Text>
          <Box w="50%">
            <UpvoteButton
              discussion={reply}
              voted={hasVoted}
              setVoted={setHasVoted}
              activeVotes={reply.active_votes || []}
              setActiveVotes={(votes) => {
                // Update the reply's active votes
                Object.assign(reply, { active_votes: votes });
              }}
              showSlider={showSlider}
              setShowSlider={setShowSlider}
              variant="withSlider"
              size="sm"
            />
          </Box>
        </Flex>
      </Box>

      {/* Nested replies */}
      {showReplies && (
        <Box mt={2} ml={4}>
          {nestedRepliesLoading ? (
            <Box p={2} textAlign="center">
              <Text fontSize="xs" color="muted">
                Loading replies...
              </Text>
            </Box>
          ) : nestedReplies.length > 0 ? (
            <VStack spacing={2} align="stretch" mb={2}>
              {nestedReplies.map((nestedReply: Discussion) => (
                <ReplyItem
                  key={`${nestedReply.author}/${nestedReply.permlink}`}
                  reply={nestedReply}
                  currentUser={currentUser}
                />
              ))}
            </VStack>
          ) : null}

          {/* Nested composer */}
          <SnapComposer
            pa={reply.author}
            pp={reply.permlink}
            onNewComment={handleNewNestedReply}
            onClose={() => setShowReplies(false)}
            submitLabel="Reply"
          />
        </Box>
      )}
    </Box>
  );
}
