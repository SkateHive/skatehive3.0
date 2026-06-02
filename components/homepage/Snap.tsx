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
import dynamic from "next/dynamic";
import { DeleteIcon } from "@chakra-ui/icons";
import { Discussion } from "@hiveio/dhive";
import { FaRegComment } from "react-icons/fa";
import { LuArrowUp, LuArrowDown, LuDollarSign } from "react-icons/lu";
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
import {
  separateContent,
  fetchFilteredReplies,
  parseMediaContent,
} from "@/lib/utils/snapUtils";
import { extractImageUrls } from "@/lib/utils/extractImageUrls";
import useIsAdmin from "@/hooks/useIsAdmin";
import { KeyTypes } from "@aioha/aioha";
import { FaInstagram } from "react-icons/fa";
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

interface SnapProps {
  discussion: Discussion;
  onOpen: () => void;
  setReply: (discussion: Discussion) => void;
  setConversation?: (conversation: Discussion) => void;
  onCommentAdded?: () => void;
  onDelete?: (permlink: string) => void;
}

const Snap = React.memo(function Snap({
  discussion,
  onOpen,
  setReply,
  setConversation,
  onCommentAdded,
  onDelete,
}: SnapProps) {
  const { user: walletUser, aioha } = useAioha();
  const { handle: effectiveUser } = useEffectiveHiveUser();
  const isModerator = useIsAdmin();
  const [isForcingIg, setIsForcingIg] = useState(false);
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

  const { text, media } = useMemo(
    () => separateContent(discussion.body),
    [discussion.body]
  );

  // Media derived for the moderator "Force post to Instagram" action.
  // Prefer a direct video (→ Reel), else the first image (→ photo post).
  const igMedia = useMemo(() => {
    const video =
      parseMediaContent(media).find((m) => m.type === "video")?.src || null;
    const image = extractImageUrls(discussion.body)[0] || null;
    return { video, image, has: Boolean(video || image) };
  }, [media, discussion.body]);

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

  const [isHovered, setIsHovered] = useState(false);

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

  // Moderator-only: force this snap onto the shared @skatehive Instagram,
  // bypassing the author's self-serve HP/criteria gate. Server re-verifies the
  // moderator allowlist — the menu visibility here is just UX.
  const handleForceInstagram = useCallback(async () => {
    if (!igMedia.has) return;
    setIsForcingIg(true);
    toast({
      title: "Force-posting to Instagram…",
      description: igMedia.video ? "Publishing a Reel can take a moment." : undefined,
      status: "info",
      duration: 6000,
      isClosable: true,
    });

    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "https://skatehive.app";
      const tags = Array.isArray((discussion as any).json_metadata?.tags)
        ? (discussion as any).json_metadata.tags
        : [];

      const payload: Record<string, unknown> = {
        hive_author: discussion.author,
        hive_permlink: discussion.permlink,
        title: (discussion as any).title || "",
        body: discussion.body,
        tags,
        image_url: igMedia.image,
        video_url: igMedia.video,
        permalink_url: `${origin}/post/${discussion.author}/${discussion.permlink}`,
      };

      // Keychain-only moderators have no userbase session cookie — sign a
      // force-cross-post challenge with the posting key so the server can
      // verify ownership + allowlist via the signature path.
      if (walletUser && aioha) {
        const issuedAt = new Date().toISOString();
        const message = [
          "Skatehive: FORCE cross-post snap to @skatehive on Instagram.",
          `Moderator: @${walletUser}`,
          `Target: @${discussion.author}/${discussion.permlink}`,
          `Issued at: ${issuedAt}`,
        ].join("\n");
        const signResult = await aioha.signMessage(message, KeyTypes.Posting);
        payload.requester = walletUser;
        payload.hive_signature = signResult.result;
        payload.hive_public_key = signResult.publicKey;
        payload.signed_at = issuedAt;
      } else {
        payload.requester = effectiveUser;
      }

      const res = await fetch("/api/instagram/force-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.success) {
        toast({
          title: data.deduped
            ? "Already on Instagram"
            : "Posted to @skatehive on Instagram",
          description: data.ig_permalink || undefined,
          status: "success",
          duration: 8000,
          isClosable: true,
        });
      } else {
        toast({
          title: "Instagram force-post failed",
          description: data?.error || `HTTP ${res.status}`,
          status: "error",
          duration: 9000,
          isClosable: true,
        });
      }
    } catch (err: any) {
      toast({
        title: "Instagram force-post failed",
        description: err?.message || "Network or signing error.",
        status: "error",
        duration: 9000,
        isClosable: true,
      });
    } finally {
      setIsForcingIg(false);
    }
  }, [igMedia, discussion, walletUser, aioha, effectiveUser, toast]);

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
    <Box pl={effectiveDepth > 1 ? 1 : 0} ml={effectiveDepth > 1 ? 2 : 0}>
      <Box mt={1} mb={1} borderRadius="base" width="100%">
        <HStack mb={2}>
          <Link
            href={profileLink}
            _hover={{ textDecoration: "none" }}
            display="flex"
            alignItems="center"
            role="group"
          >
            <Avatar
              size="sm"
              name={displayAuthor}
              src={displayAvatar}
              ml={2}
            />
            <Text
              fontWeight="medium"
              fontSize="sm"
              ml={2}
              whiteSpace="nowrap"
              _groupHover={{ textDecoration: "underline" }}
            >
              {displayAuthor}
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
                  onClick={handleForceInstagram}
                  bg={"background"}
                  color={"primary"}
                  isDisabled={!igMedia.has || isForcingIg}
                >
                  <FaInstagram style={{ marginRight: "8px" }} />
                  {isForcingIg
                    ? "Posting to Instagram…"
                    : igMedia.has
                      ? "Force post to Instagram"
                      : "Force post to Instagram (no media)"}
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
                {activeVotes.length > 0 && (
                  <Text 
                    fontSize="sm" 
                    fontWeight="medium"
                    color="primary"
                  >
                    {activeVotes.length}
                  </Text>
                )}
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
                // Always open inline composer for replies
                handleReplyButtonClick(discussion.permlink);
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
                  onClick={() => setIsSponsorModalOpen(true)}
                  opacity={0.9}
                  _hover={{ opacity: 0.7 }}
                  transition="opacity 0.2s"
                >
                  <HStack spacing={1.5}>
                    <Box boxSize="18px" display="flex" alignItems="center" justifyContent="center">
                      <FaGift size={18} color="var(--chakra-colors-green-500)" />
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
      </Box>
    </Box>
  );
});

export default Snap;
