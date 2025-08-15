import {
  Box,
  Avatar,
  Text,
  HStack,
  IconButton,
  Link,
  VStack,
  Divider,
  Button,
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
import { parseJsonMetadata } from "@/lib/hive/metadata-utils";
import { fetchComments } from "../../lib/hive/fetchComments";
import SnapComposer from "../homepage/SnapComposer";
import HiveMarkdown from "../shared/HiveMarkdown";
import UpvoteButton from "../shared/UpvoteButton";

interface NotificationItemProps {
  notification: Notifications;
  lastReadDate: string;
  currentUser: string; // Added currentUser prop
}

export default function NotificationItem({
  notification,
  lastReadDate,
  currentUser,
}: NotificationItemProps) {
  const author = notification.msg.trim().replace(/^@/, "").split(" ")[0];
  const [displayCommentPrompt, setDisplayCommentPrompt] =
    useState<boolean>(false);
  const [postContent, setPostContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasVoted, setHasVoted] = useState<boolean>(false);
  const [showSlider, setShowSlider] = useState<boolean>(false);
  const [replies, setReplies] = useState<Discussion[]>([]);
  const [repliesLoading, setRepliesLoading] = useState<boolean>(false);
  const formattedDate = new Date(notification.date + "Z").toLocaleString(
    "en-US",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }
  );

  const notificationDateStr = notification.date.endsWith("Z")
    ? notification.date
    : `${notification.date}Z`;
  const notificationDate = new Date(notificationDateStr);
  const lastRead = new Date(lastReadDate);
  const isNew = notificationDate > lastRead;
  const [rawPostAuthor, postId] = notification.url.split("/");
  const postAuthor = rawPostAuthor.replace(/^@/, "");
  const [parentPost, setParentPost] = useState<Discussion | null>(null);
  const [magPostThumbnail, setMagPostThumbnail] = useState<string>("");
  const [reply, setReply] = useState<Discussion | null>(null);
  const [originalApp, setOriginalApp] = useState<string>("");
  const [isFollowingBack, setIsFollowingBack] = useState<boolean>(false);

  // Add a cache for posts
  const postCache = useRef<Record<string, Discussion>>({});

  // Add helper to fetch comment content
  const fetchCommentContent = useCallback(async () => {
    const checkIfUserVoted = (post: Discussion | null) => {
      if (!post || !post.active_votes || !currentUser) return false;
      return post.active_votes.some((vote) => vote.voter === currentUser);
    };
    try {
      setIsLoading(true);
      const replyKey = `${postAuthor}_${postId}`;
      let post: Discussion;
      if (postCache.current[replyKey]) {
        post = postCache.current[replyKey];
      } else {
        post = await getPost(postAuthor, postId);
        postCache.current[replyKey] = post;
      }
      setReply(post);

      // Check if user has voted on this post
      setHasVoted(checkIfUserVoted(post));

      // Set the post content regardless of type
      setPostContent(post.body || "No content available");

      if (
        notification.type === "reply" ||
        notification.type === "reply_comment" ||
        notification.type === "mention" ||
        notification.type === "vote" ||
        notification.type === "reblog"
      ) {
        // Check if it's a comment (has parent_author) or a root post
        if (post.parent_author && post.parent_permlink) {
          // It's a comment - fetch its parent
          const parentKey = `${post.parent_author}_${post.parent_permlink}`;
          let parentPostData: Discussion;
          if (postCache.current[parentKey]) {
            parentPostData = postCache.current[parentKey];
          } else {
            parentPostData = await getPost(
              post.parent_author,
              post.parent_permlink
            );
            postCache.current[parentKey] = parentPostData;
          }
          setParentPost(parentPostData);

          // Get metadata from parent post
          try {
            const post_metadata =
              parentPostData && parentPostData.json_metadata
                ? parseJsonMetadata(parentPostData.json_metadata)
                : {};
            if (
              post_metadata &&
              post_metadata.image &&
              post_metadata.image.length > 0
            ) {
              setMagPostThumbnail(post_metadata.image[0]);
              setOriginalApp(post_metadata.app || "");
            } else {
              setMagPostThumbnail(
                "https://images.hive.blog/u/" + post.author + "/avatar"
              );
            }
          } catch (err) {
            console.error("Error parsing parent post metadata:", err);
            setMagPostThumbnail(
              "https://images.hive.blog/u/" + post.author + "/avatar"
            );
          }
        } else {
          // It's a root post - use the post itself as "parent"
          setParentPost(post);

          // Get metadata from the post itself
          try {
            const post_metadata = post.json_metadata
              ? parseJsonMetadata(post.json_metadata)
              : {};
            if (
              post_metadata &&
              post_metadata.image &&
              post_metadata.image.length > 0
            ) {
              setMagPostThumbnail(post_metadata.image[0]);
              setOriginalApp(post_metadata.app || "");
            } else {
              setMagPostThumbnail(
                "https://images.hive.blog/u/" + post.author + "/avatar"
              );
            }
          } catch (err) {
            console.error("Error parsing post metadata:", err);
            setMagPostThumbnail(
              "https://images.hive.blog/u/" + post.author + "/avatar"
            );
          }
        }
      }
    } catch (error) {
      setPostContent("Error loading content");
      console.error("Error in fetchCommentContent:", error);
    } finally {
      setIsLoading(false);
    }
  }, [postAuthor, postId, notification.type, postCache, currentUser]);

  // Replace the existing handleReplyClick with this version
  function handleReplyClick() {
    if (!displayCommentPrompt) {
      setDisplayCommentPrompt(true);
      fetchCommentContent();
      fetchExistingReplies(); // Fetch existing replies when opening
      window.dispatchEvent(
        new CustomEvent("activeComposerChange", { detail: notification.url })
      );
    } else {
      setDisplayCommentPrompt(false);
      // Optionally dispatch a null detail if needed; others remain closed anyway.
      window.dispatchEvent(
        new CustomEvent("activeComposerChange", { detail: null })
      );
    }
  }

  // Add a global listener to collapse this composer when another is opened
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

  const containerRef = useRef<HTMLDivElement>(null);

  // Use IntersectionObserver to lazy load comment/parent content when visible
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

  // For follow notifications, check follow state on mount
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

  // Handle new replies
  function handleNewReply(newComment: Partial<Discussion>) {
    const newReply = newComment as Discussion;
    setReplies((prev) => [...prev, newReply]);
  }

  // Fetch existing replies when reply button is clicked
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

  // Replace hardcoded gradient and box-shadow with theme variables
  const notificationPulseGradient =
    "linear-gradient(180deg, var(--chakra-colors-primary) 0%, var(--chakra-colors-accent) 100%)";
  const notificationBoxShadowAccent =
    "0 0 8px 2px var(--chakra-colors-primary)";
  const notificationBoxShadowAccent16 =
    "0 0 16px 4px var(--chakra-colors-primary)";

  return (
    <div ref={containerRef}>
      <HStack
        spacing={{ base: 2, md: 3 }}
        p={{ base: 2, md: 3 }}
        bg="muted"
        w="full"
        align="stretch"
        position="relative"
        direction={{ base: "column", md: "row" }}
        sx={
          isNew
            ? {
              boxShadow: "none",
              animation: undefined,
            }
            : {}
        }
        _before={
          isNew
            ? {
              content: '""',
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: { base: "4px", md: "6px" },
              background: notificationPulseGradient,
              boxShadow: notificationBoxShadowAccent,
              animation: "pulseGlowLeft 1.5s infinite",
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
        <Box flex="1" w="full">
          <HStack
            spacing={{ base: 2, md: 3 }}
            align={{ base: "flex-start", md: "center" }}
          >
            <Avatar
              src={`https://images.hive.blog/u/${author}/avatar/sm`}
              name=""
              size={{ base: "sm", md: "xs" }}
            />
            {notification.type === "follow" ? (
              <HStack spacing={2}>
                <Text
                  color={isNew ? "accent" : "primary"}
                  fontSize={{ base: "xs", md: "sm" }}
                >
                  {notification.msg.replace(/^@/, "")}
                </Text>
                {isFollowingBack ? (
                  <Text fontSize={{ base: "xs", md: "sm" }} color="primary">
                    Following
                  </Text>
                ) : (
                  <Button
                    size={{ base: "xs", md: "sm" }}
                    onClick={handleFollowBack}
                  >
                    Follow Back
                  </Button>
                )}
              </HStack>
            ) : notification.type === "vote" ? (
              <Box>
                <Text
                  color={isNew ? "accent" : "primary"}
                  fontSize={{ base: "xs", md: "sm" }}
                  display="flex"
                  alignItems="center"
                  flexWrap="wrap"
                  noOfLines={2}
                  wordBreak="break-word"
                >
                  <Link
                    href={`/user/${author}`}
                    color={isNew ? "accent" : "primary"}
                    fontWeight="bold"
                    _hover={{ textDecoration: "underline" }}
                  >
                    {notification.msg.replace(/^@/, "").split(" ")[0]}
                  </Link>
                  <Text as="span" ml={{ base: 0.5, md: 1 }}>
                    upvoted your
                  </Text>
                  <Link
                    href={`/${notification.url}`}
                    color={isNew ? "accent" : "primary"}
                    fontWeight="bold"
                    _hover={{ textDecoration: "underline" }}
                    ml={{ base: 0.5, md: 1 }}
                  >
                    post
                  </Link>
                  {":"}
                  <Text
                    as="span"
                    color="success"
                    fontWeight="bold"
                    ml={{ base: 0.5, md: 1 }}
                  >
                    {(() => {
                      const match = notification.msg.match(/\(([^)]+)\)/);
                      return match && match[1] ? `(${match[1]})` : "";
                    })()}
                  </Text>
                  {/* Inline postContent preview for vote notifications */}
                  {notification.type === "vote" && postContent && (
                    <Text
                      as="span"
                      color="success"
                      fontWeight="normal"
                      ml={{ base: 0.5, md: 1 }}
                      fontSize={{ base: "2xs", md: "xs" }}
                    >
                      &quot;{postContent.replace(/\n/g, " ").slice(0, 100)}
                      {postContent.length > 100 ? "…" : ""}&quot;
                    </Text>
                  )}
                  <Text
                    as="span"
                    fontSize={{ base: "2xs", md: "xs" }}
                    color="muted"
                    ml={{ base: 1, md: 2 }}
                  >
                    {formattedDate}
                  </Text>
                </Text>
              </Box>
            ) : notification.type === "reply_comment" ? (
              <Box>
                <Text
                  color={isNew ? "accent" : "primary"}
                  fontSize={{ base: "xs", md: "sm" }}
                  display="flex"
                  alignItems="center"
                  flexWrap="wrap"
                  noOfLines={2}
                  wordBreak="break-word"
                  maxW={{ base: "95vw", md: "100%" }}
                  overflowX="hidden"
                >
                  <Link
                    href={`/user/${author}`}
                    color={isNew ? "accent" : "primary"}
                    fontWeight="bold"
                    _hover={{ textDecoration: "underline" }}
                    maxW={{ base: "40vw", md: "100%" }}
                    overflowWrap="anywhere"
                  >
                    {notification.msg.replace(/^@/, "").split(" ")[0]}
                  </Link>
                  <Text as="span" ml={{ base: 0.5, md: 1 }}>
                    replied to your
                  </Text>
                  <Link
                    href={`/${parentPost
                        ? `@${parentPost.author}/${parentPost.permlink}`
                        : notification.url
                      }`}
                    color={isNew ? "accent" : "primary"}
                    fontWeight="bold"
                    _hover={{ textDecoration: "underline" }}
                    ml={{ base: 0.5, md: 1 }}
                    maxW={{ base: "30vw", md: "100%" }}
                    overflowWrap="anywhere"
                  >
                    comment
                  </Link>
                  {/* Inline quoted comment, small and muted */}
                  {parentPost?.body && (
                    <Text
                      as="span"
                      fontSize="xs"
                      color="text"
                      ml={2}
                      isTruncated
                      verticalAlign="middle"
                      display="inline-block"
                      maxW={{ base: "40vw", md: "100%" }}
                      overflowWrap="anywhere"
                    >
                      {(() => {
                        const replaced = parentPost.body
                          .replace(/!\[.*?\]\(.*?\)/g, "🖼️")
                          .replace(/<img[^>]*>/gi, "🖼️")
                          .replace(/\n/g, " ");
                        return `"${replaced.slice(0, 60)}${replaced.length > 60 ? "…" : ""
                          }"`;
                      })()}
                    </Text>
                  )}
                  {":"}
                </Text>
                {/* Main reply content using HiveMarkdown */}
                {reply && (
                  <Box
                    mt={1}
                    ml={{ base: 2, md: 4 }}
                    pl={{ base: 2, md: 3 }}
                    pr={{ base: 2, md: 0 }}
                    borderLeft="2px solid"
                    borderColor="border"
                    bg="muted"
                    borderRadius="0"
                    maxW={{ base: "95vw", md: "100%" }}
                    overflowX="auto"
                    h="200px"           // fixed preview height
                    overflow="hidden"   // clip anything taller
                    w="full"
                    sx={{
                      // tighten default <p> spacing from markdown
                      '& .notification-reply-comment-markdown p': { m: 0, lineHeight: 0 },
                      // clamp images inside the markdown
                      '& .notification-reply-comment-markdown img': {
                        maxHeight: '200px !important',
                        maxWidth: '100%',
                        width: 'auto',
                        height: 'auto',
                        objectFit: 'contain',
                        display: 'block',   // prevents extra gaps from inline images
                      },
                    }}
                  >
                    <HiveMarkdown
                      markdown={postContent}
                      className="notification-reply-comment-markdown"
                    />
                  </Box>
                )}
              </Box>
            ) : notification.type === "mention" ? (
              <Box>
                <Text
                  color={isNew ? "accent" : "primary"}
                  fontSize={{ base: "xs", md: "sm" }}
                  display="flex"
                  alignItems="center"
                  flexWrap="wrap"
                  noOfLines={2}
                  wordBreak="break-word"
                >
                  <Link
                    href={`/user/${author}`}
                    color={isNew ? "accent" : "primary"}
                    fontWeight="bold"
                    _hover={{ textDecoration: "underline" }}
                  >
                    {notification.msg.replace(/^@/, "").split(" ")[0]}
                  </Link>
                  <Text as="span" ml={{ base: 0.5, md: 1 }}>
                    mentioned you in
                  </Text>
                  {parentPost?.title && (
                    <Link
                      href={`/${parentPost
                          ? `@${parentPost.author}/${parentPost.permlink}`
                          : notification.url
                        }`}
                      color={isNew ? "accent" : "primary"}
                      fontWeight="bold"
                      _hover={{ textDecoration: "underline" }}
                      ml={{ base: 0.5, md: 1 }}
                    >
                      {parentPost.title}
                    </Link>
                  )}
                  {":"}
                  <Text
                    as="span"
                    fontSize={{ base: "2xs", md: "xs" }}
                    color="muted"
                    ml={{ base: 1, md: 2 }}
                  >
                    {formattedDate}
                  </Text>
                </Text>
              </Box>
            ) : notification.type === "reply" ? (
              <Box>
                <Text
                  color={isNew ? "accent" : "primary"}
                  fontSize={{ base: "xs", md: "sm" }}
                  display="flex"
                  alignItems="center"
                  flexWrap="wrap"
                  whiteSpace="normal"
                  wordBreak="break-word"
                >
                  <Link
                    href={`/user/${author}`}
                    color={isNew ? "accent" : "primary"}
                    fontWeight="bold"
                    _hover={{ textDecoration: "underline" }}
                  >
                    {notification.msg.replace(/^@/, "").split(" ")[0]}
                  </Link>
                  <Text as="span" ml={{ base: 0.5, md: 1 }}>
                    replied to your
                  </Text>
                  <Link
                    href={`/${parentPost
                        ? `@${parentPost.author}/${parentPost.permlink}`
                        : notification.url
                      }`}
                    color={isNew ? "accent" : "primary"}
                    fontWeight="bold"
                    _hover={{ textDecoration: "underline" }}
                    ml={{ base: 0.5, md: 1 }}
                  >
                    post
                  </Link>
                  {":"}
                </Text>
                {/* Parent post preview using HiveMarkdown */}
                {parentPost?.title && (
                  <HiveMarkdown markdown={parentPost.title} />
                )}
                {/* Main reply content using HiveMarkdown */}
                {reply && <HiveMarkdown markdown={postContent} />}
              </Box>
            ) : (
              <Text
                color={isNew ? "accent" : "primary"}
                fontSize={{ base: "xs", md: "sm" }}
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
            )}
          </HStack>
          {/* Only show post summary for non-vote, non-reblog, non-reply, non-reply_comment, non-mention notifications */}
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
                    <>
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
                        {postContent}
                      </Text>
                    </>
                  )}
                </VStack>
              </>
            )}
          {/* Indent Reply and upvote to align with main text, not all the way right */}
          {(notification.type === "reply" ||
            notification.type === "reply_comment") && (
              <Box mt={2} w="100%" ml={{ base: 2, md: 8 }}>
                <Flex alignItems="center" mb={2}>
                  <Text
                    onClick={handleReplyClick}
                    fontSize={{ base: "xs", md: "sm" }}
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
                        setVoted={(newVotedState) => {
                          setHasVoted(newVotedState);
                        }}
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
        {/* No thumbnail for reply notifications */}
      </HStack>
      {displayCommentPrompt && (
        <Box mt={2}>
          {/* Show replies first */}
          {repliesLoading ? (
            <Box p={2} textAlign="center" mb={2}>
              <Text fontSize="xs" color="muted">
                Loading replies...
              </Text>
            </Box>
          ) : replies.length > 0 ? (
            <VStack spacing={2} align="stretch" mb={2}>
              {replies.map((reply: Discussion) => (
                <ReplyItem
                  key={`${reply.author}/${reply.permlink}`}
                  reply={reply}
                  currentUser={currentUser}
                />
              ))}
            </VStack>
          ) : null}
          {/* Composer below replies */}
          <SnapComposer
            pa={postAuthor}
            pp={postId}
            onNewComment={handleNewReply}
            onClose={() => setDisplayCommentPrompt(false)}
          />
        </Box>
      )}
    </div>
  );
}

// ReplyItem component for nested replies
interface ReplyItemProps {
  reply: Discussion;
  currentUser: string;
}

function ReplyItem({ reply, currentUser }: ReplyItemProps) {
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
        (vote) => vote.voter === currentUser
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
          />
        </Box>
      )}
    </Box>
  );
}
