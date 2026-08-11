import {
  Box,
  Text,
  Flex,
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
  useColorModeValue,
} from "@chakra-ui/react";
import dynamic from "next/dynamic";
import { DeleteIcon } from "@chakra-ui/icons";
import { Discussion } from "@hiveio/dhive";
import { FaRegComment } from "react-icons/fa";
import { LuArrowUp, LuCheck } from "react-icons/lu";
import { useAioha } from "@aioha/react-ui";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getPayoutValue } from "@/lib/hive/client-functions";
import { callHiveApi } from "@/lib/hive/client-proxy";
import { EnhancedMarkdownRenderer } from "@/components/markdown/EnhancedMarkdownRenderer";
import { getPostDate } from "@/lib/utils/GetPostDate";
import SnapComposer from "./SnapComposer";
import { UpvoteButton } from "@/components/shared";
import { ErrorBoundaryWithReport } from "@/components/shared/ErrorBoundary";
import ShareMenuButtons from "./ShareMenuButtons";
import useHivePower from "@/hooks/useHivePower";
import { useVoteWeightContext } from "@/contexts/VoteWeightContext";
import { separateContent, fetchFilteredReplies } from "@/lib/utils/snapUtils";
import { extractImageUrls } from "@/lib/utils/extractImageUrls";
import useIsAdmin from "@/hooks/useIsAdmin";
import { FaInstagram } from "react-icons/fa";
import { SlPencil } from "react-icons/sl";
import { usePostEdit } from "@/hooks/usePostEdit";
import { usePostDelete } from "@/hooks/usePostDelete";
import InstagramPreviewModal from "@/components/homepage/InstagramPreviewModal";
import {
  parsePayout,
  calculatePayoutDays,
} from "@/lib/utils/postUtils";
import { BiDotsHorizontal } from "react-icons/bi";
import MediaRenderer from "../shared/MediaRenderer";
import VoteListPopover from "@/components/blog/VoteListModal";
import useEffectiveHiveUser from "@/hooks/useEffectiveHiveUser";
import useHiveVote from "@/hooks/useHiveVote";
import useSoftPostOverlay from "@/hooks/useSoftPostOverlay";
import useSoftVoteOverlay from "@/hooks/useSoftVoteOverlay";
import { extractSafeUser } from "@/lib/userbase/safeUserMetadata";
import SponsorButton from "@/components/userbase/SponsorButton";
import { useSponsorshipStatus } from "@/hooks/useSponsorshipStatus";

// Lazy load heavy modals
const EditPostModal = dynamic(() => import("./EditPostModal"), { ssr: false });
const SponsorshipModal = dynamic(() => import("@/components/userbase/SponsorshipModal"), { ssr: false });
import { useViewerHiveIdentity } from "@/hooks/useViewerHiveIdentity";
import { FaGift } from "react-icons/fa";

// Thread layout, Farcaster style: the avatar sits in a fixed left gutter and a
// connector runs down that gutter between rows of the same conversation.
//
// Replies are never indented — a reply sits in the same avatar column as the
// comment it answers, directly beneath it, so the connector between them is
// straight and centred. An indent would offset the reply's avatar from the
// column the line runs in and leave the line visibly off to one side. It also
// makes a runaway cascade impossible: there is no per-level offset to
// accumulate, however deep the chain goes.
const THREAD_AVATAR_PX = 32; // matches Chakra Avatar size="sm"
const THREAD_GUTTER_GAP_PX = 12;
// Total left offset of the content column. Media cancels this to run edge to
// edge, so the two have to stay in sync.
const THREAD_CONTENT_OFFSET_PX = THREAD_AVATAR_PX + THREAD_GUTTER_GAP_PX;
// How far a connector bleeds past its row to reach the next avatar.
// Overshooting is safe (the avatar is opaque and covers it); undershooting
// leaves a visible break in the chain.
const THREAD_CONNECTOR_BLEED_PX = 24;

interface SnapProps {
  discussion: Discussion;
  onOpen: () => void;
  setReply: (discussion: Discussion) => void;
  setConversation?: (conversation: Discussion) => void;
  onCommentAdded?: () => void;
  onDelete?: (permlink: string) => void;
  /**
   * True when another row of the same conversation is rendered directly below
   * this one, so the connector has to carry on past this row. Set by a reply
   * group for all but its last reply, and by SnapList for a post's comment
   * list.
   */
  hasFollowingThreadRow?: boolean;
  /**
   * True when this row is a comment rather than a top-level post in the feed.
   * Only comments thread: a feed snap must never draw a connector out of its
   * author avatar, however many replies it has open.
   */
  isCommentRow?: boolean;
}

const Snap = React.memo(function Snap({
  discussion,
  onOpen,
  setReply,
  setConversation,
  onCommentAdded,
  onDelete,
  hasFollowingThreadRow = false,
  isCommentRow = false,
}: SnapProps) {
  const { user: walletUser, aioha } = useAioha();
  const { handle: effectiveUser } = useEffectiveHiveUser();
  const isModerator = useIsAdmin();
  // Moderator-only preview dialog for the Instagram force-post action.
  // Opens BEFORE we publish so the moderator can see the rendered caption
  // + media + dedupe status, then confirm explicitly.
  const [isIgPreviewOpen, setIsIgPreviewOpen] = useState(false);
  const { vote, canVote } = useHiveVote();
  const toast = useToast();
  const {
    isLoading: isHivePowerLoading,
    error: hivePowerError,
    estimateVoteValue,
  } = useHivePower(effectiveUser || "");
  const { voteWeight: userVoteWeight, disableSlider } = useVoteWeightContext();
  const commentDate = getPostDate(discussion.created);
  const safeUser = useMemo(
    () => extractSafeUser(discussion.json_metadata),
    [discussion.json_metadata]
  );

  const softPost = useSoftPostOverlay(
    discussion.author,
    discussion.permlink,
    safeUser
  );
  const softVote = useSoftVoteOverlay(discussion.author, discussion.permlink);

  const displayAuthor =
  softPost?.user.handle ||
    softPost?.user.display_name ||
    discussion.author;
  const displayAvatar =
    softPost?.user.avatar_url ||
    `https://images.hive.blog/u/${discussion.author}/avatar/sm`;

  // Use lite user's handle for profile link if it's a soft post
  const profileLink = softPost?.user.handle
    ? `/user/${softPost.user.handle}`
    : `/user/${discussion.author}`;

  const {
    isEditing,
    editedContent,
    isSaving,
    setEditedContent,
    handleEditClick,
    handleCancelEdit,
    handleSaveEdit,
    canEditThisPost,
  } = usePostEdit(discussion);

  const [isDeleted, setIsDeleted] = useState(false);
  const { isDeleting, handleDelete, handleSoftDelete } = usePostDelete(
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
  const [commentCount, setCommentCount] = useState(discussion.children ?? 0);
  
  // Refresh vote/comment counts from Hive (API doesn't include subcomments)
  // Safe because MediaRenderer is React.memo'd — this state change won't destroy iframes
  useEffect(() => {
    let mounted = true;

    const refreshData = async () => {
      try {
        const content = await callHiveApi('condenser_api.get_content', [
          discussion.author,
          discussion.permlink
        ]);

        if (mounted && content) {
          if (content.active_votes && Array.isArray(content.active_votes)) {
            setActiveVotes(content.active_votes);
          }

          if (typeof content.children === 'number') {
            setCommentCount(content.children);
          }
        }
      } catch (error) {
        // Silent fail - use API data as fallback
      }
    };

    const timeout = setTimeout(refreshData, 2000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, [discussion.author, discussion.permlink]);
  
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

  // Sponsorship state
  const [isSponsorModalOpen, setIsSponsorModalOpen] = useState(false);
  const viewerHiveUsername = useViewerHiveIdentity();
  const { isLite, loading: sponsorStatusLoading } = useSponsorshipStatus(
    softPost?.user?.id || null
  );

  const effectiveDepth = discussion.depth || 0;

  const isThreadOpen = Boolean(inlineComposerStates[discussion.permlink]);
  const inlineReplies = inlineRepliesMap[discussion.permlink] ?? [];
  // Threading is for comments only. A post in the feed never draws — no line
  // may leave its author avatar, open replies or not — so the drop into a reply
  // group is gated on this row being a comment itself. hasFollowingThreadRow is
  // already comment-only: nothing sets it in the feed.
  const hasVisibleReplies = isThreadOpen && inlineReplies.length > 0;
  const showThreadConnector =
    (isCommentRow && hasVisibleReplies) || hasFollowingThreadRow;
  // Neutral translucent grey rather than the theme text colour: "text" is
  // #00FF00 on the hacker themes, which made the connector read as a bright
  // green rule instead of a quiet hairline between avatars.
  const threadLineColor = useColorModeValue("blackAlpha.400", "whiteAlpha.400");
  // Media, body and actions share this offset — they have to, or the column
  // stops lining up with the author name.
  const contentPl = isCommentRow ? `${THREAD_CONTENT_OFFSET_PX}px` : 0;

  const { text, media } = useMemo(
    () => separateContent(discussion.body),
    [discussion.body]
  );

  // Media derived for the moderator "Force post to Instagram" action.
  // Snap videos are embedded as an <iframe> IPFS player (often multi-line) or
  // as a markdown/raw video URL; images use ![](...) markdown. Scan the full
  // body so multi-line iframes aren't missed. Prefer video (→ Reel).
  const igMedia = useMemo(() => {
    const body = discussion.body || "";
    const isVideoFile = (u: string) => /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u);
    const isIpfs = (u: string) =>
      /\/ipfs\/[a-z0-9]{40,}/i.test(u) || /\bipfs\./i.test(u);

    let video: string | null = null;
    // 1. iframe player (the skatehive video embed) — IPFS or a video file
    const iframeSrc = body.match(/<iframe[\s\S]*?\bsrc=["']([^"']+)["']/i)?.[1];
    if (iframeSrc && (isIpfs(iframeSrc) || isVideoFile(iframeSrc))) {
      video = iframeSrc;
    }
    // 2. markdown / raw video URL fallback
    if (!video) {
      video =
        body.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+\.(?:mp4|webm|mov|m4v)[^)\s]*)\)/i)?.[1] ||
        body.match(/https?:\/\/[^\s"'<>)]+\.(?:mp4|webm|mov|m4v)/i)?.[0] ||
        null;
    }

    const image = extractImageUrls(body)[0] || null;
    return { video, image, has: Boolean(video || image) };
  }, [discussion.body]);

  const hasSoftVote =
    !!softVote && softVote.status !== "failed" && softVote.weight > 0;

  // Derive voted state instead of useState+useEffect
  const derivedVoted = useMemo(
    () =>
      hasSoftVote ||
      discussion.active_votes?.some(
        (item: { voter: string }) =>
          item.voter?.toLowerCase() === effectiveUser?.toLowerCase()
      ) ||
      false,
    [discussion.active_votes, effectiveUser, hasSoftVote]
  );
  const [votedOverride, setVotedOverride] = useState(false);
  const voted = votedOverride || derivedVoted;

  // Accessible names for the two icon-only controls. Without them a screen
  // reader announces the bare count, or nothing at all when it is zero. The
  // count belongs in the label because aria-label replaces the element's own
  // content. "Upvoted" rather than "Remove upvote": clicking an already-voted
  // control is a no-op here, so offering to undo would be a lie.
  const voteLabel = `${voted ? "Upvoted" : "Upvote"}${
    activeVotes.length > 0 ? `, ${activeVotes.length} votes` : ""
  }`;
  const replyLabel = `Reply${
    commentCount > 0 ? `, ${commentCount} replies` : ""
  }`;

  // Direct vote handler for when slider is disabled
  async function handleDirectVote() {
    if (!canVote || voted || isVoting) return;
    
    setIsVoting(true);
    try {
      const voteResult = await vote(
        discussion.author,
        discussion.permlink,
        userVoteWeight * 100
      );
      
      if (voteResult.success) {
        setVotedOverride(true);
        if (effectiveUser) {
          setActiveVotes([
            ...activeVotes,
            { voter: effectiveUser, weight: userVoteWeight * 100 },
          ]);
        }
        
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

  const handleConversation = useCallback(() => {
    if (setConversation) {
      setConversation(discussion);
    }
  }, [setConversation, discussion]);

  // Moderator-only: open the Instagram force-post preview dialog. The
  // actual POST to /api/instagram/force-post happens inside the modal
  // on Confirm — including the Keychain signature, which must be signed
  // at confirm-time (5-min replay window) rather than now. Server still
  // re-verifies the moderator allowlist; this open is just UX.
  const handleOpenIgPreview = useCallback(() => {
    if (!igMedia.has) return;
    setIsIgPreviewOpen(true);
  }, [igMedia.has]);

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

  // Show sponsor CTA if: lite account, viewer has Hive, not own post
  const showSponsorCTA =
    !sponsorStatusLoading &&
    isLite &&
    softPost?.user?.id &&
    viewerHiveUsername &&
    effectiveUser !== discussion.author;

  const handleDeleteClick = () => {
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
    <Box position="relative" width="100%" mt={1} mb={1}>
      {/* Thread connector: leaves from under the avatar and stops at the next
          one. Anchored to this wrapper rather than to the reply group, so it
          ends with the row instead of trailing past the last reply. Only rows
          with another row after them draw it, so the line begins at the first
          comment and ends on the last. */}
      <Box position="relative">
        {showThreadConnector && (
          <Box
            aria-hidden="true"
            position="absolute"
            left={`${THREAD_AVATAR_PX / 2}px`}
            ml="-1px"
            top={`${THREAD_AVATAR_PX + 4}px`}
            // The bleed exists to bridge the gap to the next avatar. With the
            // thread open and nothing fetched yet, what follows is the reply
            // composer, not an avatar — bleeding into it just leaves a stub
            // pointing at a text box.
            bottom={
              isThreadOpen && !hasVisibleReplies
                ? 0
                : `-${THREAD_CONNECTOR_BLEED_PX}px`
            }
            width="2px"
            bg={threadLineColor}
            borderRadius="full"
          />
        )}

        <Flex align="flex-start" gap={`${THREAD_GUTTER_GAP_PX}px`}>
          {/* Positioned so the avatar paints above the connector. A positioned
              element beats non-positioned content in the painting order, so
              without this the previous row's bleed would land on top of this
              avatar rather than tucking behind it. */}
          <Box
            position="relative"
            zIndex={1}
            flexShrink={0}
            width={`${THREAD_AVATAR_PX}px`}
          >
            <Link href={profileLink} display="block" _hover={{ textDecoration: "none" }}>
              <Avatar size="sm" name={displayAuthor} src={displayAvatar} />
            </Link>
          </Box>

          <Box flex="1" minW={0}>
          <HStack spacing={2} mb={2}>
            <Link
              href={profileLink}
              _hover={{ textDecoration: "none" }}
              role="group"
              minW={0}
            >
              <Text
                fontWeight="medium"
                fontSize="sm"
                noOfLines={1}
                _groupHover={{ textDecoration: "underline" }}
              >
                {displayAuthor}
              </Text>
            </Link>
            <Text
              fontWeight="medium"
              fontSize="sm"
              color="gray"
              whiteSpace="nowrap"
            >
              · {commentDate}
            </Text>
            <Box ml="auto">
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
                  {canEditThisPost && (
                    <MenuItem
                      onClick={handleEditClick}
                      bg={"background"}
                      color={"primary"}
                    >
                      <SlPencil style={{ marginRight: "8px" }} />
                      Edit
                    </MenuItem>
                  )}
                  {walletUser === discussion.author && (
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
                  {isModerator && (
                    <MenuItem
                      onClick={handleOpenIgPreview}
                      bg={"background"}
                      color={"primary"}
                      isDisabled={!igMedia.has}
                    >
                      <FaInstagram style={{ marginRight: "8px" }} />
                      {igMedia.has
                        ? "Force post to Instagram…"
                        : "Force post to Instagram (no media)"}
                    </MenuItem>
                  )}
                  <ShareMenuButtons comment={discussion} />
                </MenuList>
              </Menu>
            </Box>
            </HStack>
          </Box>
        </Flex>

        {/* Media is a direct child of the snap, exactly as on main: a plain
            block, no gutter to escape and no negative margin to resolve. A
            feed post keeps the full width it has always had.
            A comment indents it into the content column instead, because a
            threaded row has a connector at x=16 running past it. Full-bleed
            media there is opaque and hundreds of pixels tall, so it would hide
            the line for that whole stretch and the chain would read as two
            disconnected stubs on any comment carrying a video. */}
        <Box pl={contentPl}>
          <MediaRenderer mediaContent={media} fullContent={discussion.body} />
        </Box>

        {/* On a comment, body and actions align under the author name, which is
            what makes a threaded row read as one column. A feed post keeps the
            full width it has on main: nothing threads there, so the avatar
            column would just be an empty strip down the left of every post. */}
        <Box pl={contentPl}>
          <Box sx={{ p: { marginBottom: "1rem", lineHeight: "1.6" } }}>
            <EnhancedMarkdownRenderer content={text} />
          </Box>

          {!showSlider && (
            <HStack
              justify="space-between"
              mt={2}
              // On a comment, pull back the first action's own px so the icons
              // line up with the author name and body above them. A feed post
              // has no column to line up with, so it keeps the inset the action
              // bar has always had there.
              ml={isCommentRow ? -2 : 2}
              mr={isCommentRow ? 0 : 2}
            >
              <HStack spacing={2}>
                <HStack
                  justify="center"
                  px={2}
                  py={1}
                  cursor="pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={voteLabel}
                  aria-disabled={voted || isVoting || undefined}
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      if (e.key === " ") e.preventDefault();
                      if (!voted && !isVoting) {
                        if (disableSlider) {
                          // Slider disabled - vote directly with default weight
                          handleDirectVote();
                        } else {
                          // Show slider for vote weight selection
                          setShowSlider(true);
                        }
                      }
                    }
                  }}
                  opacity={isVoting ? 0.5 : 0.9}
                  _hover={{ opacity: 0.7 }}
                  transition="opacity 0.2s"
                >
                  <HStack spacing={1}>
                    {voted ? (
                      <Box boxSize="18px" display="flex" alignItems="center" justifyContent="center">
                        <LuCheck size={18} color="var(--chakra-colors-primary)" />
                      </Box>
                    ) : (
                      <Box boxSize="18px" display="flex" alignItems="center" justifyContent="center">
                        <LuArrowUp size={18} color="var(--chakra-colors-text)" />
                      </Box>
                    )}
                    {activeVotes.length > 0 && (
                      <Text
                        fontSize="sm"
                        fontWeight="medium"
                        color={voted ? "primary" : "text"}
                      >
                        {activeVotes.length}
                      </Text>
                    )}
                  </HStack>
                </HStack>

                <HStack
                  justify="center"
                  px={2}
                  py={1}
                  cursor="pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={replyLabel}
                  aria-expanded={isThreadOpen}
                  onClick={() => {
                    // Always open inline composer for replies
                    handleReplyButtonClick(discussion.permlink);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      if (e.key === " ") e.preventDefault();
                      // Always open inline composer for replies
                      handleReplyButtonClick(discussion.permlink);
                    }
                  }}
                  opacity={0.9}
                  _hover={{ opacity: 0.7 }}
                  transition="opacity 0.2s"
                >
                  <HStack spacing={1.5}>
                    <Box boxSize="18px" display="flex" alignItems="center" justifyContent="center">
                      <FaRegComment
                        size={18}
                        color={voted ? "var(--chakra-colors-primary)" : "var(--chakra-colors-text)"}
                      />
                    </Box>
                    <Text
                      fontSize="sm"
                      fontWeight="medium"
                      color={voted ? "primary" : "text"}
                    >
                      {commentCount}
                    </Text>
                  </HStack>
                </HStack>

                {showSponsorCTA && (
                  <Tooltip
                    label="Sponsor this user to create their Hive account"
                    hasArrow
                    placement="top"
                  >
                    <HStack
                      minW="72px"
                      justify="center"
                      px={2}
                      py={1}
                      borderRadius="md"
                      cursor="pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => setIsSponsorModalOpen(true)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          if (e.key === " ") e.preventDefault();
                          setIsSponsorModalOpen(true);
                        }
                      }}
                      opacity={0.9}
                      _hover={{ opacity: 0.7 }}
                      transition="opacity 0.2s"
                    >
                      <HStack spacing={1.5}>
                        <Box boxSize="18px" display="flex" alignItems="center" justifyContent="center">
                          <FaGift size={18} color="var(--chakra-colors-primary)" />
                        </Box>
                        <Text
                          fontSize="sm"
                          fontWeight="medium"
                          color="green.500"
                        >
                          Sponsor
                        </Text>
                      </HStack>
                    </HStack>
                  </Tooltip>
                )}
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
                        justify="center"
                        px={2}
                        py={1}
                        cursor="pointer"
                        opacity={0.9}
                        _hover={{ opacity: 0.7 }}
                        transition="opacity 0.2s"
                      >
                        <HStack spacing={0.5}>
                          <Text
                            fontSize="sm"
                            fontWeight="medium"
                            color={voted ? "primary" : "text"}
                          >
                            $
                          </Text>
                          <Text
                            fontSize="sm"
                            fontWeight="medium"
                            color={voted ? "primary" : "text"}
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
            <ErrorBoundaryWithReport>
              <UpvoteButton
                discussion={discussion}
                voted={voted}
                setVoted={setVotedOverride}
                activeVotes={activeVotes}
                setActiveVotes={setActiveVotes}
                showSlider={showSlider}
                setShowSlider={setShowSlider}
                onVoteSuccess={(estimatedValue?: number) => {
                  setVotedOverride(true);
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
            </ErrorBoundaryWithReport>
          )}
        </Box>
      </Box>

      {/* Reply group, flush with this row: a reply sits directly under the
          comment it answers, in the same avatar column, so the connector
          between them runs straight down the middle of that column. */}
      {isThreadOpen && (
        <Box mt={2}>
          {inlineReplies.length > 0 && (
            <VStack spacing={2} align="stretch" mb={2}>
              {inlineReplies.map((reply: Discussion, index: number) => {
                const nextDepth = effectiveDepth + 1;
                return (
                  <Snap
                    key={`${reply.author}/${reply.permlink}`}
                    discussion={{ ...reply, depth: nextDepth } as any}
                    onOpen={onOpen}
                    setReply={setReply}
                    setConversation={setConversation}
                    onDelete={onDelete}
                    hasFollowingThreadRow={index < inlineReplies.length - 1}
                    // A reply is always a comment, even when its parent is a
                    // feed post.
                    isCommentRow
                  />
                );
              })}
            </VStack>
          )}
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
            isReply
          />
        </Box>
      )}

      <EditPostModal
        isOpen={isEditing}
        onClose={handleCancelEdit}
        discussion={discussion}
        editedContent={editedContent}
        setEditedContent={setEditedContent}
        onSave={handleSaveEdit}
        isSaving={isSaving}
      />

      {/* Sponsorship Modal */}
      {showSponsorCTA && softPost?.user && softPost.user.handle && viewerHiveUsername && (
        <SponsorshipModal
          isOpen={isSponsorModalOpen}
          onClose={() => setIsSponsorModalOpen(false)}
          liteUserId={softPost.user.id}
          liteUserHandle={softPost.user.handle}
          liteUserDisplayName={softPost.user.handle || softPost.user.display_name || 'User'}
          sponsorHiveUsername={viewerHiveUsername}
        />
      )}

      {/* Instagram force-post preview (moderator only). Lazy: only
          mounted while open so we don't preflight a fetch for every
          snap that has a 3-dots menu rendered on screen. */}
      {isModerator && isIgPreviewOpen && (
        <InstagramPreviewModal
          isOpen={isIgPreviewOpen}
          onClose={() => setIsIgPreviewOpen(false)}
          mode="moderator"
          context={{
            hiveAuthor: discussion.author,
            hivePermlink: discussion.permlink,
            title: (discussion as any).title || "",
            body: discussion.body,
            tags: Array.isArray((discussion as any).json_metadata?.tags)
              ? (discussion as any).json_metadata.tags
              : [],
            imageUrl: igMedia.image,
            videoUrl: igMedia.video,
            permalinkUrl: `${
              typeof window !== "undefined" ? window.location.origin : "https://skatehive.app"
            }/post/${discussion.author}/${discussion.permlink}`,
          }}
          userHandle={walletUser || effectiveUser}
        />
      )}
    </Box>
  );
});

export default Snap;
