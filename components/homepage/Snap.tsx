import {
  Box,
  Text,
  HStack,
  Button,
  Avatar,
  Link,
  VStack,
  Tooltip,
  IconButton,
  MenuButton,
  MenuItem,
  Menu,
  MenuList,
} from "@chakra-ui/react";
import { Discussion } from "@hiveio/dhive";
import { FaRegComment } from "react-icons/fa";
import { useAioha } from "@aioha/react-ui";
import { useState, useMemo } from "react";
import { getPayoutValue } from "@/lib/hive/client-functions";
import { EnhancedMarkdownRenderer } from "@/components/markdown/EnhancedMarkdownRenderer";
import { getPostDate } from "@/lib/utils/GetPostDate";
import SnapComposer from "./SnapComposer";
import { UpvoteButton } from "@/components/shared";
import EditPostModal from "./EditPostModal";
import ShareMenuButtons from "./ShareMenuButtons";
import useHivePower from "@/hooks/useHivePower";
import { fetchComments } from "@/lib/hive/fetchComments";
import { separateContent } from "@/lib/utils/snapUtils";
import { SlPencil } from "react-icons/sl";
import { usePostEdit } from "@/hooks/usePostEdit";
import {
  parsePayout,
  calculatePayoutDays,
  deduplicateVotes,
} from "@/lib/utils/postUtils";
import { BiDotsHorizontal } from "react-icons/bi";
import MediaRenderer from "../shared/MediaRenderer";

interface SnapProps {
  discussion: Discussion;
  onOpen: () => void;
  setReply: (discussion: Discussion) => void;
  setConversation?: (conversation: Discussion) => void;
  onCommentAdded?: () => void;
}

const Snap = ({
  discussion,
  onOpen,
  setReply,
  setConversation,
  onCommentAdded,
}: SnapProps) => {
  const { user } = useAioha();
  const { isLoading: isHivePowerLoading, estimateVoteValue } = useHivePower(user);
  const commentDate = getPostDate(discussion.created);

  // Use the custom hook for edit functionality
  const {
    isEditing,
    editedContent,
    isSaving,
    setEditedContent,
    handleEditClick,
    handleCancelEdit,
    handleSaveEdit,
  } = usePostEdit(discussion);

  const [showSlider, setShowSlider] = useState(false);
  const [activeVotes, setActiveVotes] = useState(discussion.active_votes || []);
  const [rewardAmount, setRewardAmount] = useState(
    parseFloat(getPayoutValue(discussion))
  );
  const [inlineRepliesMap, setInlineRepliesMap] = useState<
    Record<string, Discussion[]>
  >({});
  const [inlineRepliesLoading, setInlineRepliesLoading] = useState<
    Record<string, boolean>
  >({});
  const [inlineComposerStates, setInlineComposerStates] = useState<
    Record<string, boolean>
  >({});

  // State to track comment count for optimistic updates
  const [commentCount, setCommentCount] = useState(discussion.children ?? 0);

  const effectiveDepth = discussion.depth || 0;

  const { text, media } = useMemo(
    () => separateContent(discussion.body),
    [discussion.body]
  );

  const [voted, setVoted] = useState(
    discussion.active_votes?.some(
      (item: { voter: string }) => item.voter === user
    ) || false
  );

  function handleConversation() {
    if (setConversation) {
      setConversation(discussion);
    }
  }

  function handleInlineNewReply(newComment: Partial<Discussion>) {
    const newReply = newComment as Discussion;
    setInlineRepliesMap((prev) => ({
      ...prev,
      [discussion.permlink]: [...(prev[discussion.permlink] || []), newReply],
    }));
    // Update comment count optimistically
    setCommentCount((prev) => prev + 1);
    // Notify parent component if callback is provided
    if (onCommentAdded) {
      onCommentAdded();
    }
  }

  async function handleReplyButtonClick(permlink: string) {
    setInlineComposerStates((prev: Record<string, boolean>) => ({
      ...prev,
      [permlink]: !prev[permlink],
    }));
    // If opening, fetch replies if not already loaded
    if (!inlineComposerStates[permlink]) {
      setInlineRepliesLoading((prev) => ({ ...prev, [permlink]: true }));
      try {
        const replies = await fetchRepliesForPermlink(
          discussion.author,
          permlink
        );
        setInlineRepliesMap((prev) => ({ ...prev, [permlink]: replies }));
      } catch (e) {
        setInlineRepliesMap((prev) => ({ ...prev, [permlink]: [] }));
      } finally {
        setInlineRepliesLoading((prev) => ({ ...prev, [permlink]: false }));
      }
    }
  }

  // Helper to fetch replies for a given author/permlink
  async function fetchRepliesForPermlink(author: string, permlink: string) {
    return fetchComments(author, permlink, false);
  }

  // Deduplicate votes by voter (keep the last occurrence)
  const uniqueVotes = deduplicateVotes(activeVotes);

  const authorPayout = parsePayout(discussion.total_payout_value);
  const curatorPayout = parsePayout(discussion.curator_payout_value);
  const { daysRemaining, isPending } = calculatePayoutDays(discussion.created);

  return (
    <Box pl={effectiveDepth > 1 ? 1 : 0} ml={effectiveDepth > 1 ? 2 : 0}>
      <Box mt={1} mb={1} borderRadius="base" width="100%">
        <HStack align="flex-start" spacing={3} mb={2}>
          <Avatar
            size="sm"
            name={discussion.author}
            src={`https://images.hive.blog/u/${discussion.author}/avatar/sm`}
          />
          <VStack align="start" spacing={1} w="100%">
            <HStack w="100%" justify="space-between" align="center">
              <HStack spacing={2} align="center">
                <Link
                  href={`/user/${discussion.author}`}
                  _hover={{ textDecoration: "none" }}
                  role="group"
                >
                  <Text
                    fontWeight="bold"
                    fontSize="sm"
                    whiteSpace="nowrap"
                    _groupHover={{ textDecoration: "underline" }}
                  >
                    {discussion.author}
                  </Text>
                </Link>
                <Text fontSize="xs" color="gray">
                  {commentDate}
                </Text>
              </HStack>
              <Menu>
                <MenuButton
                  as={IconButton}
                  aria-label="Edit post"
                  icon={<BiDotsHorizontal />}
                  size="sm"
                  variant="ghost"
                  _active={{ bg: "none" }}
                  _hover={{ bg: "none" }}
                  bg={"background"}
                  color={"primary"}
                />
                <MenuList bg={"background"} color={"primary"}>
                  {user === discussion.author && (
                    <MenuItem
                      onClick={handleEditClick}
                      bg={"background"}
                      color={"primary"}
                    >
                      <SlPencil style={{ marginRight: "8px" }} />
                      Edit
                    </MenuItem>
                  )}
                  <ShareMenuButtons comment={discussion} />
                </MenuList>
              </Menu>
            </HStack>
            <Box w="100%" pt={2} pb={2}>
              <Box
                sx={{
                  p: { marginBottom: "1rem", lineHeight: "1.6" },
                }}
              >
                <EnhancedMarkdownRenderer content={text} />
              </Box>
              <MediaRenderer
                mediaContent={media}
                fullContent={discussion.body}
              />
            </Box>
          </VStack>
        </HStack>

        {/* Edit Modal */}
        <EditPostModal
          isOpen={isEditing}
          onClose={handleCancelEdit}
          discussion={discussion}
          editedContent={editedContent}
          setEditedContent={setEditedContent}
          onSave={handleSaveEdit}
          isSaving={isSaving}
        />

        {!showSlider && (
          <HStack justify="center" spacing={8} mt={3}>
            <UpvoteButton
              discussion={discussion}
              voted={voted}
              setVoted={setVoted}
              activeVotes={activeVotes}
              setActiveVotes={setActiveVotes}
              showSlider={showSlider}
              setShowSlider={setShowSlider}
              onVoteSuccess={(estimatedValue?: number) => {
                setVoted(true);
                if (estimatedValue) {
                  setRewardAmount((prev) =>
                    parseFloat((prev + estimatedValue).toFixed(3))
                  );
                }
              }}
              estimateVoteValue={estimateVoteValue}
              isHivePowerLoading={isHivePowerLoading}
              variant="withSlider"
              size="sm"
            />
            <HStack>
              <Tooltip label="comments" hasArrow openDelay={1000}>
                <Button
                  leftIcon={<FaRegComment size={18} />}
                  variant="ghost"
                  onClick={() => {
                    if (effectiveDepth > 0) {
                      handleReplyButtonClick(discussion.permlink);
                    } else {
                      handleConversation();
                    }
                  }}
                  size="sm"
                >
                  {commentCount}
                </Button>
              </Tooltip>
            </HStack>
            <Tooltip
              label={
                isPending
                  ? `Pending - ${daysRemaining} day${
                      daysRemaining !== 1 ? "s" : ""
                    } until payout`
                  : `Author: $${authorPayout.toFixed(
                      3
                    )} | Curators: $${curatorPayout.toFixed(3)}`
              }
              hasArrow
              openDelay={500}
              placement="top"
            >
              <Text fontWeight="bold" fontSize="sm" cursor="pointer">
                ${rewardAmount.toFixed(2)}
              </Text>
            </Tooltip>
          </HStack>
        )}

        {showSlider && (
          <UpvoteButton
            discussion={discussion}
            voted={voted}
            setVoted={setVoted}
            activeVotes={activeVotes}
            setActiveVotes={setActiveVotes}
            showSlider={showSlider}
            setShowSlider={setShowSlider}
            onVoteSuccess={(estimatedValue?: number) => {
              if (estimatedValue) {
                setRewardAmount((prev) =>
                  parseFloat((prev + estimatedValue).toFixed(3))
                );
              }
            }}
            estimateVoteValue={estimateVoteValue}
            isHivePowerLoading={isHivePowerLoading}
            variant="withSlider"
            size="sm"
          />
        )}
        {inlineComposerStates[discussion.permlink] && (
          <Box mt={2}>
            <SnapComposer
              pa={discussion.author}
              pp={discussion.permlink}
              onNewComment={handleInlineNewReply}
              onClose={() =>
                setInlineComposerStates((prev: Record<string, boolean>) => ({
                  ...prev,
                  [discussion.permlink]: false,
                }))
              }
              post
            />
            {/* Replies loading indicator */}
            {inlineRepliesLoading[discussion.permlink] && (
              <Text mt={2} color="gray.400" fontSize="sm">
                Loading replies...
              </Text>
            )}
            {/* Show replies for this permlink */}
            {inlineRepliesMap[discussion.permlink] &&
              inlineRepliesMap[discussion.permlink].length > 0 && (
                <VStack spacing={2} align="stretch" mt={2}>
                  {inlineRepliesMap[discussion.permlink].map(
                    (reply: Discussion) => {
                      const nextDepth = effectiveDepth + 1;
                      return (
                        <Snap
                          key={reply.permlink}
                          discussion={{ ...reply, depth: nextDepth } as any}
                          onOpen={onOpen}
                          setReply={setReply}
                          setConversation={setConversation}
                        />
                      );
                    }
                  )}
                </VStack>
              )}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default Snap;
