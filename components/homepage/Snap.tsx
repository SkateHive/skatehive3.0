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
  useToast,
} from "@chakra-ui/react";
import { DeleteIcon } from "@chakra-ui/icons";
import { Discussion } from "@hiveio/dhive";
import { FaRegComment } from "react-icons/fa";
import { LuArrowUp, LuArrowDown, LuDollarSign } from "react-icons/lu";
import { useAioha } from "@aioha/react-ui";
import { useMemo, useState } from "react";
import { getPayoutValue } from "@/lib/hive/client-functions";
import { EnhancedMarkdownRenderer } from "@/components/markdown/EnhancedMarkdownRenderer";
import { getPostDate } from "@/lib/utils/GetPostDate";
import SnapComposer from "./SnapComposer";
import { UpvoteButton } from "@/components/shared";
import EditPostModal from "./EditPostModal";
import ShareMenuButtons from "./ShareMenuButtons";
import useHivePower from "@/hooks/useHivePower";
import { useVoteWeightContext } from "@/contexts/VoteWeightContext";
import { separateContent, fetchFilteredReplies } from "@/lib/utils/snapUtils";
import { SlPencil } from "react-icons/sl";
import { usePostEdit } from "@/hooks/usePostEdit";
import { usePostDelete } from "@/hooks/usePostDelete";
import {
  parsePayout,
  calculatePayoutDays,
} from "@/lib/utils/postUtils";
import { BiDotsHorizontal } from "react-icons/bi";
import MediaRenderer from "../shared/MediaRenderer";
import VoteListPopover from "@/components/blog/VoteListModal";

interface SnapProps {
  discussion: Discussion;
  onOpen: () => void;
  setReply: (discussion: Discussion) => void;
  setConversation?: (conversation: Discussion) => void;
  onCommentAdded?: () => void;
  onDelete?: (permlink: string) => void;
}

const Snap = ({
  discussion,
  onOpen,
  setReply,
  setConversation,
  onCommentAdded,
  onDelete,
}: SnapProps) => {
  const { aioha, user } = useAioha();
  const toast = useToast();
  const {
    isLoading: isHivePowerLoading,
    error: hivePowerError,
    estimateVoteValue,
  } = useHivePower(user);
  const { voteWeight: userVoteWeight, disableSlider } = useVoteWeightContext();
  const commentDate = getPostDate(discussion.created);

  const {
    isEditing,
    editedContent,
    isSaving,
    setEditedContent,
    handleEditClick,
    handleCancelEdit,
    handleSaveEdit,
  } = usePostEdit(discussion);

  const [isDeleted, setIsDeleted] = useState(false);
  const {
    canDelete,
    isLiteOwner,
    isDeleting,
    handleDelete,
    handleSoftDelete,
    handleLiteSoftDelete,
  } = usePostDelete(
    discussion,
    () => {
      setIsDeleted(true);
      onDelete?.(discussion.permlink);
    }
  );
  const hasRepliesOrVotes =
    (discussion.children ?? 0) > 0 ||
    (discussion.active_votes?.length ?? 0) > 0;

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
  const [isVoting, setIsVoting] = useState(false);

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
  const [isHovered, setIsHovered] = useState(false);

  // Direct vote handler for when slider is disabled
  async function handleDirectVote() {
    if (!user || voted || isVoting) return;
    
    setIsVoting(true);
    try {
      const vote = await aioha.vote(
        discussion.author,
        discussion.permlink,
        userVoteWeight * 100
      );
      
      if (vote.success) {
        setVoted(true);
        setActiveVotes([...activeVotes, { voter: user, weight: userVoteWeight * 100 }]);
        
        // Update reward amount with estimated value
        if (estimateVoteValue && !isHivePowerLoading) {
          try {
            const estimatedValue = await estimateVoteValue(userVoteWeight);
            if (estimatedValue) {
              setRewardAmount((prev) => parseFloat((prev + estimatedValue).toFixed(3)));
            }
          } catch (e) {
            // Ignore estimation errors
          }
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
    }
  }

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
    setCommentCount((prev) => prev + 1);
    if (onCommentAdded) {
      onCommentAdded();
    }
  }

  async function handleReplyButtonClick(permlink: string) {
    setInlineComposerStates((prev: Record<string, boolean>) => ({
      ...prev,
      [permlink]: !prev[permlink],
    }));
    if (!inlineComposerStates[permlink]) {
      setInlineRepliesLoading((prev) => ({ ...prev, [permlink]: true }));
      try {
        const replies = await fetchFilteredReplies(
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

  const authorPayout = parsePayout(discussion.total_payout_value);
  const curatorPayout = parsePayout(discussion.curator_payout_value);
  const { daysRemaining, isPending } = calculatePayoutDays(discussion.created);

  const handleDeleteClick = () => {
    if (isLiteOwner) {
      handleLiteSoftDelete();
      return;
    }

    if (hasRepliesOrVotes) {
      handleSoftDelete();
    } else {
      handleDelete();
    }
  };

  if (isDeleted) {
    return null;
  }

  return (
    <Box pl={effectiveDepth > 1 ? 1 : 0} ml={effectiveDepth > 1 ? 2 : 0}>
      <Box mt={1} mb={1} borderRadius="base" width="100%">
        <HStack mb={2}>
          <Link
            href={`/user/${discussion.author}`}
            _hover={{ textDecoration: "none" }}
            display="flex"
            alignItems="center"
            role="group"
          >
            <Avatar
              size="sm"
              name={discussion.author}
              src={`https://images.hive.blog/u/${discussion.author}/avatar/sm`}
              ml={2}
            />
            <Text
              fontWeight="medium"
              fontSize="sm"
              ml={2}
              whiteSpace="nowrap"
              _groupHover={{ textDecoration: "underline" }}
            >
              {discussion.author}
            </Text>
          </Link>
          <HStack ml={0} width="100%" justify="space-between">
            <HStack>
              <Text fontWeight="medium" fontSize="sm" color="gray">
                · {commentDate}
              </Text>
            </HStack>
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
              {canDelete && (
                <MenuItem
                  onClick={handleDeleteClick}
                  bg={"background"}
                  color={"error"}
                  isDisabled={isDeleting}
                >
                  <DeleteIcon style={{ marginRight: "8px" }} />
                  Delete
                </MenuItem>
              )}
              <ShareMenuButtons comment={discussion} />
            </MenuList>
          </Menu>
        </HStack>
        <Box>
          <Box>
            <MediaRenderer mediaContent={media} fullContent={discussion.body} />
          </Box>
          <Box
            sx={{
              p: { marginBottom: "1rem", lineHeight: "1.6", marginLeft: "4" },
            }}
          >
            <EnhancedMarkdownRenderer content={text} />
          </Box>
        </Box>

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
          <HStack 
            justify="center" 
            spacing={6}
            mt={3} 
            w="100%"
          >
            <HStack
              minW="72px"
              justify="center"
              px={2}
              py={1}
              borderRadius="md"
              cursor="pointer"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={() => {
                if (!voted && !isVoting) {
                  if (disableSlider) {
                    // Slider disabled - vote directly with default weight
                    handleDirectVote();
                  } else {
                    // Show slider for vote weight selection
                    setShowSlider(true);
                  }
                }
              }}
              opacity={isVoting ? 0.5 : 0.9}
              _hover={{ opacity: 0.7 }}
              transition="opacity 0.2s"
            >
              <HStack spacing={1.5}>
                {voted || isHovered ? (
                  <Box boxSize="18px" display="flex" alignItems="center" justifyContent="center">
                    <LuArrowUp size={18} color="var(--chakra-colors-primary)" />
                  </Box>
                ) : (
                  <Box boxSize="18px" display="flex" alignItems="center" justifyContent="center">
                    <LuArrowDown size={18} color="var(--chakra-colors-primary)" />
                  </Box>
                )}
                <Text 
                  fontSize="sm" 
                  fontWeight="medium"
                  color="primary"
                >
                  {activeVotes.length}
                </Text>
              </HStack>
            </HStack>

            <HStack
              minW="72px"
              justify="center"
              px={2}
              py={1}
              borderRadius="md"
              cursor="pointer"
              onClick={() => {
                if (effectiveDepth > 0) {
                  handleReplyButtonClick(discussion.permlink);
                } else {
                  handleConversation();
                }
              }}
              opacity={0.9}
              _hover={{ opacity: 0.7 }}
              transition="opacity 0.2s"
            >
              <HStack spacing={1.5}>
                <Box boxSize="18px" display="flex" alignItems="center" justifyContent="center">
                  <FaRegComment size={18} color="var(--chakra-colors-primary)" />
                </Box>
                <Text 
                  fontSize="sm" 
                  fontWeight="medium"
                  color="primary"
                >
                  {commentCount}
                </Text>
              </HStack>
            </HStack>

            <Tooltip
              label={
                isPending
                  ? `Pending - ${daysRemaining} day${
                      daysRemaining !== 1 ? "s" : ""
                    } until payout - Click to see voters`
                  : `Author: $${authorPayout.toFixed(
                      3
                    )} | Curators: $${curatorPayout.toFixed(3)} - Click to see voters`
              }
              hasArrow
              openDelay={500}
              placement="top"
            >
              <Box>
                <VoteListPopover
                  trigger={
                    <HStack
                      minW="72px"
                      justify="center"
                      px={2}
                      py={1}
                      borderRadius="md"
                      cursor="pointer"
                      opacity={0.9}
                      _hover={{ opacity: 0.7 }}
                      transition="opacity 0.2s"
                    >
                      <HStack spacing={1.5}>
                        <Box boxSize="18px" display="flex" alignItems="center" justifyContent="center">
                          <LuDollarSign size={18} color="var(--chakra-colors-primary)" />
                        </Box>
                        <Text 
                          fontSize="sm" 
                          fontWeight="medium"
                          color="primary"
                        >
                          {rewardAmount.toFixed(2)}
                        </Text>
                      </HStack>
                    </HStack>
                  }
                  votes={activeVotes}
                  post={discussion}
                />
              </Box>
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
            {inlineRepliesMap[discussion.permlink] &&
              inlineRepliesMap[discussion.permlink].length > 0 && (
                <VStack spacing={2} align="stretch" mt={2}>
                  {inlineRepliesMap[discussion.permlink].map(
                    (reply: Discussion) => {
                      const nextDepth = effectiveDepth + 1;
                      return (
                        <Snap
                          key={`${reply.author}/${reply.permlink}`}
                          discussion={{ ...reply, depth: nextDepth } as any}
                          onOpen={onOpen}
                          setReply={setReply}
                          setConversation={setConversation}
                          onDelete={onDelete}
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
