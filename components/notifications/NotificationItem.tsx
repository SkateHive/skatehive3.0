"use client";
import { debugLog } from "@/lib/utils/debugUtils";

import {
  Box,
  Avatar,
  Text,
  HStack,
  VStack,
  Divider,
  Skeleton,
  Flex,
} from "@chakra-ui/react";
import { Discussion, Notifications } from "@hiveio/dhive";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  getPost,
  checkFollow,
  changeFollow,
} from "../../lib/hive/client-functions";
import { parseJsonMetadata, getImageUrls } from "@/lib/hive/metadata-utils";
import { fetchComments } from "../../lib/hive/fetchComments";
import SnapComposer from "../homepage/SnapComposer";
import UpvoteButton from "../shared/UpvoteButton";

// Import extracted components
import ReplyItem from "./ReplyItem";
import NotificationPreview from "./NotificationPreview";
import {
  FollowNotification,
  VoteNotification,
  GroupedVoteNotification,
  ReplyNotification,
  ReplyCommentNotification,
  MentionNotification,
} from "./content";

// Import utils
import {
  extractMediaFromBody,
  extractThumbnailFromMetadata,
  sanitizeNotificationBody,
  formatNotificationDate,
  isNotificationNew,
  extractAuthorFromMessage,
  type VoteValue,
} from "./utils";

export interface NotificationItemData extends Notifications {
  mergedVotes?: {
    authors: string[];
    totalCount: number;
    totalValue?: VoteValue | null;
    voteValues: Record<string, VoteValue | null>;
  };
}

interface NotificationItemProps {
  notification: NotificationItemData;
  lastReadDate: string;
  currentUser: string;
}

export default function NotificationItem({
  notification,
  lastReadDate,
  currentUser,
}: NotificationItemProps) {
  const author = extractAuthorFromMessage(notification.msg);
  const [displayCommentPrompt, setDisplayCommentPrompt] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [showSlider, setShowSlider] = useState(false);
  const [replies, setReplies] = useState<Discussion[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);

  const formattedDate = formatNotificationDate(notification.date);
  const isNew = isNotificationNew(notification.date, lastReadDate);

  const [rawPostAuthor, postId] = notification.url.split("/");
  const postAuthor = rawPostAuthor.replace(/^@/, "");

  const [parentPost, setParentPost] = useState<Discussion | null>(null);
  const [magPostThumbnail, setMagPostThumbnail] = useState("");
  const [inlineImageUrl, setInlineImageUrl] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [reply, setReply] = useState<Discussion | null>(null);
  const [originalApp, setOriginalApp] = useState("");
  const [isFollowingBack, setIsFollowingBack] = useState(false);

  const postCache = useRef<Record<string, Discussion>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Helper to extract media preview from a post
   * Returns previewUrl (image/video thumbnail), inlineImageUrl (embedded images), and videoSourceUrl (direct video URL)
   */
  const getMediaFromPost = useCallback((post: Discussion): { 
    previewUrl: string | null; 
    inlineImageUrl: string | null;
    videoSourceUrl: string | null;
  } => {
    const bodyMedia = extractMediaFromBody(post.body || "");
    let previewUrl = bodyMedia.previewUrl;
    let inlineImageUrl = bodyMedia.inlineImageUrl;
    let videoSourceUrl = bodyMedia.videoSourceUrl;

    // If no preview from body, try metadata with detailed logging
    if (!previewUrl) {
      try {
        const metadata = post.json_metadata ? parseJsonMetadata(post.json_metadata) : {};
        // Enable logging for debugging
        const metadataThumbnail = extractThumbnailFromMetadata(metadata, true);
        if (metadataThumbnail) {
          previewUrl = metadataThumbnail;
        }
        // Also check for images in metadata
        if (!previewUrl && !inlineImageUrl) {
          const imageUrls = getImageUrls(metadata);
          if (imageUrls.length > 0) {
            inlineImageUrl = imageUrls[0];
          }
        }
      } catch (err) {
        console.error("[notifications] Error extracting media from metadata:", err);
      }
    }

    // Log the final extraction result
    console.log("[notifications] getMediaFromPost result:", {
      author: post.author,
      permlink: post.permlink?.slice(0, 30),
      previewUrl: previewUrl?.slice(0, 60),
      inlineImageUrl: inlineImageUrl?.slice(0, 60),
      videoSourceUrl: videoSourceUrl?.slice(0, 60),
    });

    return { previewUrl, inlineImageUrl, videoSourceUrl };
  }, []);

  /**
   * Fetch and cache a post by author/permlink
   */
  const fetchAndCachePost = useCallback(async (author: string, permlink: string): Promise<Discussion> => {
    const cacheKey = `${author}_${permlink}`;
    if (postCache.current[cacheKey]) {
      return postCache.current[cacheKey];
    }
    const post = await getPost(author, permlink);
    postCache.current[cacheKey] = post;
    return post;
  }, []);

  /**
   * Get the root post by traversing up the parent chain
   */
  /**
   * Check if a post is a "snap container" (a holder post for snap comments)
   */
  const isSnapContainer = useCallback((post: Discussion): boolean => {
    // Snap containers typically have specific authors or patterns
    const containerAuthors = ['peak.snaps', 'snaps', 'hive.snaps'];
    const isContainer = containerAuthors.includes(post.author) || 
                        post.permlink?.includes('snap-container') ||
                        post.title?.includes('Snaps Container');
    return isContainer;
  }, []);

  /**
   * Get the best media source - prefer user's content over container posts
   * This handles the case where snaps are comments on container posts
   */
  const getBestMediaSource = useCallback(async (
    notificationPost: Discussion,
    preferParent: boolean = false
  ): Promise<{ mediaSource: Discussion; strategy: string }> => {
    // First, check if the notification post itself has media
    const notificationMedia = getMediaFromPost(notificationPost);
    const hasNotificationMedia = notificationMedia.previewUrl || notificationMedia.inlineImageUrl;

    debugLog("[notifications] Notification post has media", hasNotificationMedia ? "yes" : "no");
    
    // If we want the parent (for reply notifications)
    if (preferParent && notificationPost.parent_author && notificationPost.parent_permlink) {
      const parentPost = await fetchAndCachePost(
        notificationPost.parent_author,
        notificationPost.parent_permlink
      );
      
      // Check if parent is a snap container
      if (isSnapContainer(parentPost)) {
        debugLog("[notifications] Parent is a snap container, using notification post instead");
        // The notification post is likely a comment with actual content
        return { 
          mediaSource: notificationPost, 
          strategy: "notification post (parent is container)" 
        };
      }

      const parentMedia = getMediaFromPost(parentPost);
      const hasParentMedia = parentMedia.previewUrl || parentMedia.inlineImageUrl;

      debugLog("[notifications] Parent post has media", hasParentMedia ? "yes" : "no");

      // Return parent if it has media, otherwise try to find better source
      if (hasParentMedia) {
        return { mediaSource: parentPost, strategy: "parent post (your content)" };
      }

      // If parent has no media, check if notification post does
      if (hasNotificationMedia) {
        return { mediaSource: notificationPost, strategy: "notification post (parent has no media)" };
      }

      // Last resort: return parent anyway
      return { mediaSource: parentPost, strategy: "parent post (no media found)" };
    }

    // For non-parent cases, just return the notification post
    if (hasNotificationMedia) {
      return { mediaSource: notificationPost, strategy: "notification post" };
    }

    // Try to get parent if exists and has media
    if (notificationPost.parent_author && notificationPost.parent_permlink) {
      const parentPost = await fetchAndCachePost(
        notificationPost.parent_author,
        notificationPost.parent_permlink
      );

      // Skip container posts
      if (!isSnapContainer(parentPost)) {
        const parentMedia = getMediaFromPost(parentPost);
        if (parentMedia.previewUrl || parentMedia.inlineImageUrl) {
          return { mediaSource: parentPost, strategy: "parent post (fallback)" };
        }
      }
    }

    return { mediaSource: notificationPost, strategy: "notification post (default)" };
  }, [fetchAndCachePost, getMediaFromPost, isSnapContainer]);

  /**
   * Fetch content and apply notification-type-specific media preview strategy
   * 
   * Notification types and their preview strategies:
   * - reply: Show media from YOUR original post/comment that was replied to
   * - reply_comment: Show media from YOUR comment that was replied to (NOT root container)
   * - vote: Show media from YOUR post/comment that was voted on
   * - mention: Show media from THE POST/COMMENT where you were mentioned
   * - reblog: Show media from YOUR post that was reblogged
   * - follow: No media preview (show avatar instead)
   * 
   * IMPORTANT: Skip "snap container" posts and prefer actual user content
   */
  const fetchCommentContent = useCallback(async () => {
    const checkIfUserVoted = (post: Discussion | null) => {
      if (!post || !post.active_votes || !currentUser) return false;
      return post.active_votes.some(
        (vote) => vote.voter?.toLowerCase() === currentUser?.toLowerCase()
      );
    };

    console.log(`\n[notifications] ========== NOTIFICATION ==========`);
    console.log(`[notifications] Type: ${notification.type}`);
    console.log(`[notifications] URL: ${notification.url}`);
    console.log(`[notifications] Message: ${notification.msg}`);

    try {
      setIsLoading(true);

      // Step 1: Fetch the post referenced in the notification URL
      const notificationPost = await fetchAndCachePost(postAuthor, postId);
      debugLog("[notifications] Fetched notification post", {
        author: notificationPost.author,
        permlink: notificationPost.permlink,
        hasParent: notificationPost.parent_author ? "yes" : "no",
        bodyPreview: (notificationPost.body || "").slice(0, 150) + "..."
      });

      setReply(notificationPost);
      setHasVoted(checkIfUserVoted(notificationPost));
      setPostContent(notificationPost.body || "No content available");

      // Step 2: Apply notification-type-specific preview strategy
      let mediaSourcePost: Discussion | null = null;
      let previewStrategy = "";

      switch (notification.type) {
        case "follow":
          // No media preview for follow notifications (show avatar)
          previewStrategy = "none (follow notification - showing avatar)";
          setVideoPreviewUrl(null);
          setInlineImageUrl(null);
          setMagPostThumbnail("");
          setParentPost(null);
          break;

        case "vote":
          // Show media from the post/comment that was voted on
          // This is YOUR content, so show its media directly
          previewStrategy = "voted content (your post/comment)";
          const voteResult = await getBestMediaSource(notificationPost, false);
          mediaSourcePost = voteResult.mediaSource;
          previewStrategy = voteResult.strategy;
          
          // Set parent for context display
          if (notificationPost.parent_author && notificationPost.parent_permlink) {
            const voteParent = await fetchAndCachePost(
              notificationPost.parent_author,
              notificationPost.parent_permlink
            );
            setParentPost(isSnapContainer(voteParent) ? notificationPost : voteParent);
          } else {
            setParentPost(notificationPost);
          }
          break;

        case "reply":
          // Show media from YOUR original post that was replied to
          // The notification post is the reply, its parent is YOUR content
          previewStrategy = "your content that was replied to";
          const replyResult = await getBestMediaSource(notificationPost, true);
          mediaSourcePost = replyResult.mediaSource;
          previewStrategy = replyResult.strategy;
          
          if (notificationPost.parent_author && notificationPost.parent_permlink) {
            const replyParent = await fetchAndCachePost(
              notificationPost.parent_author,
              notificationPost.parent_permlink
            );
            setParentPost(replyParent);
          } else {
            setParentPost(notificationPost);
          }
          break;

        case "reply_comment":
          // Show media from YOUR COMMENT that was replied to
          // NOT the root post - that's often a container with generic images
          previewStrategy = "your comment that was replied to";
          const replyCommentResult = await getBestMediaSource(notificationPost, true);
          mediaSourcePost = replyCommentResult.mediaSource;
          previewStrategy = replyCommentResult.strategy;
          
          if (notificationPost.parent_author && notificationPost.parent_permlink) {
            const commentParent = await fetchAndCachePost(
              notificationPost.parent_author,
              notificationPost.parent_permlink
            );
            setParentPost(commentParent);
          } else {
            setParentPost(notificationPost);
          }
          break;

        case "mention":
          // Show media from the post/comment where you were mentioned
          previewStrategy = "content where you were mentioned";
          const mentionResult = await getBestMediaSource(notificationPost, false);
          mediaSourcePost = mentionResult.mediaSource;
          previewStrategy = mentionResult.strategy;
          setParentPost(notificationPost);
          break;

        case "reblog":
          // Show media from YOUR post that was reblogged
          previewStrategy = "reblogged post";
          const reblogResult = await getBestMediaSource(notificationPost, false);
          mediaSourcePost = reblogResult.mediaSource;
          previewStrategy = reblogResult.strategy;
          setParentPost(notificationPost);
          break;

        default:
          // Default: try to show media from the notification post
          previewStrategy = "default (notification post)";
          const defaultResult = await getBestMediaSource(notificationPost, false);
          mediaSourcePost = defaultResult.mediaSource;
          previewStrategy = defaultResult.strategy;
          setParentPost(notificationPost);
          break;
      }

      // Step 3: Extract media from the determined source
      if (mediaSourcePost) {
        const { previewUrl, inlineImageUrl, videoSourceUrl } = getMediaFromPost(mediaSourcePost);
        
        // Use videoSourceUrl as fallback preview for IPFS videos
        // The video URL itself can be used as a preview with proper handling in NotificationPreview
        const effectivePreviewUrl = previewUrl || videoSourceUrl;
        
        setVideoPreviewUrl(effectivePreviewUrl);
        setInlineImageUrl(inlineImageUrl);

        // Also set magPostThumbnail from metadata images
        try {
          const metadata = mediaSourcePost.json_metadata 
            ? parseJsonMetadata(mediaSourcePost.json_metadata) 
            : {};
          const imageUrls = getImageUrls(metadata);
          setMagPostThumbnail(imageUrls.length > 0 ? imageUrls[0] : "");
          setOriginalApp(metadata.app || "");
          console.log(`[notifications] Metadata images: ${imageUrls.length > 0 ? imageUrls[0] : "none"}`);
          console.log(`[notifications] Original app: ${metadata.app || "unknown"}`);
          console.log(`[notifications] Effective preview URL: ${effectivePreviewUrl || "none"}`);
        } catch (err) {
          console.error("[notifications] Error parsing metadata:", err);
          setMagPostThumbnail("");
        }
      }

      console.log(`[notifications] ========== END ==========\n`);

    } catch (error) {
      setPostContent("Error loading content");
      console.error("[notifications] Error in fetchCommentContent:", error);
    } finally {
      setIsLoading(false);
    }
  }, [postAuthor, postId, notification.type, notification.url, notification.msg, currentUser, fetchAndCachePost, getBestMediaSource, getMediaFromPost, isSnapContainer]);

  // Handle reply button click
  function handleReplyClick() {
    if (!displayCommentPrompt) {
      setDisplayCommentPrompt(true);
      fetchCommentContent();
      fetchExistingReplies();
      window.dispatchEvent(
        new CustomEvent("activeComposerChange", { detail: notification.url })
      );
    } else {
      setDisplayCommentPrompt(false);
      window.dispatchEvent(
        new CustomEvent("activeComposerChange", { detail: null })
      );
    }
  }

  // Collapse composer when another is opened
  useEffect(() => {
    function handleActiveComposerChange(e: CustomEvent) {
      if (e.detail && e.detail !== notification.url) {
        setDisplayCommentPrompt(false);
      }
    }
    window.addEventListener(
      "activeComposerChange",
      handleActiveComposerChange as EventListener
    );
    return () => {
      window.removeEventListener(
        "activeComposerChange",
        handleActiveComposerChange as EventListener
      );
    };
  }, [notification.url]);

  // Lazy load content when visible
  useEffect(() => {
    if (
      ["reply", "reply_comment", "mention", "vote", "reblog"].includes(
        notification.type
      ) &&
      containerRef.current
    ) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              fetchCommentContent();
              observer.disconnect();
            }
          });
        },
        { threshold: 0.1 }
      );
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, [notification.type, notification.url, fetchCommentContent]);

  // Check follow state for follow notifications
  useEffect(() => {
    if (notification.type === "follow" && currentUser) {
      checkFollow(currentUser, author)
        .then((result: boolean) => setIsFollowingBack(result))
        .catch(() => setIsFollowingBack(false));
    }
  }, [notification.type, currentUser, author]);

  async function handleFollowBack() {
    await changeFollow(currentUser, author);
    setIsFollowingBack(true);
  }

  function handleNewReply(newComment: Partial<Discussion>) {
    setReplies((prev) => [...prev, newComment as Discussion]);
  }

  async function fetchExistingReplies() {
    if (!reply) return;
    setRepliesLoading(true);
    try {
      const existingReplies = await fetchComments(
        reply.author,
        reply.permlink,
        false
      );
      setReplies(existingReplies);
    } catch (error) {
      console.error("Error fetching replies:", error);
      setReplies([]);
    } finally {
      setRepliesLoading(false);
    }
  }

  // Theme styles
  const notificationPulseGradient =
    "linear-gradient(180deg, rgba(0,0,0,0) 0%, var(--chakra-colors-primary) 100%)";
  const notificationBoxShadowAccent = "0 0 4px 1px var(--chakra-colors-primary)";
  const notificationBoxShadowAccent16 =
    "0 0 8px 2px var(--chakra-colors-primary)";

  // Render notification content based on type
  const renderNotificationContent = () => {
    switch (notification.type) {
      case "follow":
        return (
          <FollowNotification
            message={notification.msg}
            isNew={isNew}
            isFollowingBack={isFollowingBack}
            onFollowBack={handleFollowBack}
          />
        );
      case "vote":
        if (notification.mergedVotes && notification.mergedVotes.totalCount > 1) {
          return (
            <GroupedVoteNotification
              authors={notification.mergedVotes.authors}
              totalCount={notification.mergedVotes.totalCount}
              totalValue={notification.mergedVotes.totalValue}
              voteValues={notification.mergedVotes.voteValues}
              postContent={postContent}
              notificationUrl={notification.url}
              formattedDate={formattedDate}
              isNew={isNew}
            />
          );
        }
        return (
          <VoteNotification
            message={notification.msg}
            notificationUrl={notification.url}
            postContent={postContent}
            formattedDate={formattedDate}
            isNew={isNew}
            author={author}
          />
        );
      case "reply_comment":
        return (
          <ReplyCommentNotification
            message={notification.msg}
            notificationUrl={notification.url}
            parentPost={parentPost}
            reply={reply}
            postContent={postContent}
            isNew={isNew}
            author={author}
          />
        );
      case "mention":
        return (
          <MentionNotification
            message={notification.msg}
            notificationUrl={notification.url}
            parentPost={parentPost}
            formattedDate={formattedDate}
            isNew={isNew}
            author={author}
          />
        );
      case "reply":
        return (
          <ReplyNotification
            message={notification.msg}
            notificationUrl={notification.url}
            parentPost={parentPost}
            reply={reply}
            postContent={postContent}
            isNew={isNew}
            author={author}
          />
        );
      default:
        return (
            <Text
              color={isNew ? "accent" : "primary"}
              fontSize={{ base: "sm", md: "sm" }}
              noOfLines={2}
              overflow="hidden"
              textOverflow="ellipsis"
            wordBreak="break-word"
          >
            {notification.msg.replace(/^@/, "")} - {parentPost?.title}
            {(notification.type === "reply" ||
              notification.type === "reply_comment") &&
              ` using ${originalApp}`}
          </Text>
        );
    }
  };

  return (
    <div ref={containerRef}>
      <VStack
        spacing={{ base: 2, md: 3 }}
        p={{ base: 2, md: 3 }}
        bg="muted"
        w="full"
        align="stretch"
        position="relative"
        sx={isNew ? { boxShadow: "none", animation: undefined } : {}}
        _before={
          isNew
            ? {
                content: '""',
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: { base: "3px", md: "4px" },
                background: notificationPulseGradient,
                boxShadow: notificationBoxShadowAccent,
                animation: "pulseGlowLeft 2.5s infinite",
              }
            : {}
        }
      >
        <style>{`
          @keyframes pulseGlowLeft {
            0% { box-shadow: ${notificationBoxShadowAccent}; }
            50% { box-shadow: ${notificationBoxShadowAccent16}; }
            100% { box-shadow: ${notificationBoxShadowAccent}; }
          }
        `}</style>

        <HStack
          w="full"
          spacing={4}
          align={{ base: "flex-start", md: "center" }}
          justify="space-between"
          direction={{ base: "column", md: "row" }}
        >
          <Box flex="1" minW={0}>
            <HStack
              spacing={{ base: 2, md: 3 }}
              align={{ base: "flex-start", md: "center" }}
            >
              <Avatar
                src={`https://images.hive.blog/u/${author}/avatar/sm`}
                name=""
                size={{ base: "xs", md: "sm" }}
              />
              <Box flex="1" minW={0}>
                {renderNotificationContent()}
              </Box>
            </HStack>

            {/* Post content for non-standard notification types */}
            {parentPost &&
              !["vote", "reblog", "reply", "reply_comment", "mention"].includes(
                notification.type
              ) && (
                <>
                  <Divider my={2} />
                  <VStack align="start" spacing={2} w="100%">
                    {isLoading ? (
                      <>
                        <Skeleton
                          height="16px"
                          width="100%"
                          startColor="muted"
                          endColor="primary"
                        />
                        <Skeleton
                          height="16px"
                          width="100%"
                          startColor="muted"
                          endColor="primary"
                        />
                      </>
                    ) : (
                      <Text
                        fontSize={{ base: "xs", md: "sm" }}
                        color="primary"
                        ml={{ base: 2, md: 5 }}
                        noOfLines={3}
                        overflow="hidden"
                        textOverflow="ellipsis"
                        w="100%"
                        wordBreak="break-word"
                      >
                        {sanitizeNotificationBody(postContent)}
                      </Text>
                    )}
                  </VStack>
                </>
              )}

            {/* Reply actions */}
            {(notification.type === "reply" ||
              notification.type === "reply_comment") && (
              <Box mt={2} w="100%" ml={{ base: 2, md: 8 }}>
                <Flex alignItems="center" mb={2}>
                  <Text
                    onClick={handleReplyClick}
                    fontSize={{ base: "sm", md: "sm" }}
                    cursor="pointer"
                    mr={2}
                  >
                    Reply
                  </Text>
                  {reply ? (
                    <Box w="50%">
                      <UpvoteButton
                        discussion={reply}
                        voted={hasVoted}
                        setVoted={setHasVoted}
                        activeVotes={reply.active_votes || []}
                        setActiveVotes={(votes) => {
                          if (reply) {
                            setReply({ ...reply, active_votes: votes });
                          }
                        }}
                        showSlider={showSlider}
                        setShowSlider={setShowSlider}
                        variant="withSlider"
                        size="sm"
                      />
                    </Box>
                  ) : (
                    <Text fontSize="xs" color="muted">
                      Loading...
                    </Text>
                  )}
                </Flex>
              </Box>
            )}
          </Box>

          {/* Preview thumbnail */}
          <NotificationPreview
            videoPreviewUrl={videoPreviewUrl}
            magPostThumbnail={magPostThumbnail}
            inlineImageUrl={inlineImageUrl}
            notificationType={notification.type}
            author={author}
          />
        </HStack>

        {/* Composer and replies */}
        {displayCommentPrompt && (
          <Box w="full">
            {repliesLoading ? (
              <Box p={2} textAlign="center" mb={2}>
                <Text fontSize="xs" color="muted">
                  Loading replies...
                </Text>
              </Box>
            ) : replies.length > 0 ? (
              <VStack spacing={2} align="stretch" mb={2}>
                {replies.map((replyItem: Discussion) => (
                  <ReplyItem
                    key={`${replyItem.author}/${replyItem.permlink}`}
                    reply={replyItem}
                    currentUser={currentUser}
                  />
                ))}
              </VStack>
            ) : null}
            <SnapComposer
              pa={postAuthor}
              pp={postId}
              onNewComment={handleNewReply}
              onClose={() => setDisplayCommentPrompt(false)}
              submitLabel="Reply"
            />
          </Box>
        )}
      </VStack>
    </div>
  );
}
