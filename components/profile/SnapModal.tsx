"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { safeCopyToClipboard } from "@/lib/utils/clipboardUtils";
import {
  Box,
  Image,
  Text,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalCloseButton,
  ModalBody,
  IconButton,
  HStack,
  VStack,
  Flex,
  Divider,
  Button,
  useBreakpointValue,
  Avatar,
  useToast,
} from "@chakra-ui/react";
import {
  FaChevronLeft,
  FaChevronRight,
  FaDownload,
  FaComments,
  FaShare,
} from "react-icons/fa";
import { Discussion } from "@hiveio/dhive";
import useEffectiveHiveUser from "@/hooks/useEffectiveHiveUser";
import useSoftVoteOverlay from "@/hooks/useSoftVoteOverlay";
import VideoRenderer from "../layout/VideoRenderer";
import SnapComposer from "../homepage/SnapComposer";
import Snap from "../homepage/Snap";
import { UpvoteButton } from "@/components/shared";
import { useComments } from "@/hooks/useComments";
import HiveMarkdown from "../shared/HiveMarkdown";
import { useHeicFallback } from "@/hooks/useHeicFallback";

interface SnapWithMedia extends Discussion {
  media: {
    images: string[];
    videos: string[];
    hasMedia: boolean;
  };
}

interface SnapModalProps {
  snap: SnapWithMedia;
  snaps: SnapWithMedia[];
  currentSnapIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onSnapChange: (snapIndex: number) => void;
}

const SnapModal = ({
  snap,
  snaps,
  currentSnapIndex,
  isOpen,
  onClose,
  onSnapChange,
}: SnapModalProps) => {
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const modalSize = useBreakpointValue({ base: "full", md: "5xl" });
  const toast = useToast();
  const { handle: effectiveUser } = useEffectiveHiveUser();

  // Always use the snap from the current index to ensure consistency
  const currentSnap = useMemo(() => {
    if (
      snaps.length > 0 &&
      currentSnapIndex >= 0 &&
      currentSnapIndex < snaps.length
    ) {
      return snaps[currentSnapIndex];
    }
    return snap; // Fallback to prop
  }, [snaps, currentSnapIndex, snap]);

  // Voting state
  const softVote = useSoftVoteOverlay(currentSnap.author, currentSnap.permlink);
  const hasSoftVote =
    !!softVote && softVote.status !== "failed" && softVote.weight > 0;
  const [voted, setVoted] = useState(
    hasSoftVote ||
      currentSnap.active_votes?.some(
        (item: { voter: string }) => item.voter === effectiveUser
      ) ||
      false
  );
  const [activeVotes, setActiveVotes] = useState(currentSnap.active_votes || []);
  const [showSlider, setShowSlider] = useState(false);

  // Use the useComments hook to fetch comments for the current snap
  const {
    comments,
    isLoading: commentsLoading,
    error: commentsError,
  } = useComments(
    currentSnap.author,
    currentSnap.permlink,
    false // Set to true if you want nested replies
  );

  // State for optimistic updates when new comments are added
  const [optimisticComments, setOptimisticComments] = useState<Discussion[]>(
    []
  );

  const allMedia = useMemo(
    () => [...currentSnap.media.images, ...currentSnap.media.videos],
    [currentSnap]
  );
  const currentMedia = allMedia[currentMediaIndex];
  const isVideo = currentSnap.media.videos.includes(currentMedia);
  const { src: mediaSrc, onError: onMediaError } = useHeicFallback(currentMedia || "");

  const nextMedia = useCallback(() => {
    setCurrentMediaIndex((prev) => (prev + 1) % allMedia.length);
  }, [allMedia.length]);

  const prevMedia = useCallback(() => {
    setCurrentMediaIndex(
      (prev) => (prev - 1 + allMedia.length) % allMedia.length
    );
  }, [allMedia.length]);

  const nextSnap = useCallback(() => {
    if (
      snaps.length > 0 &&
      currentSnapIndex >= 0 &&
      currentSnapIndex < snaps.length - 1
    ) {
      onSnapChange(currentSnapIndex + 1);
    }
  }, [snaps.length, currentSnapIndex, onSnapChange]);

  const prevSnap = useCallback(() => {
    if (
      snaps.length > 0 &&
      currentSnapIndex > 0 &&
      currentSnapIndex < snaps.length
    ) {
      onSnapChange(currentSnapIndex - 1);
    }
  }, [snaps.length, currentSnapIndex, onSnapChange]);

  const handleNewComment = (newComment: Partial<Discussion>) => {
    setOptimisticComments((prev) => [newComment as Discussion, ...prev]);
  };

  // Callback to update comment count when a new comment is added
  const handleCommentAdded = () => {
    // This will be called when a comment is added to update the count
    // The count is already updated optimistically in the Snap component
  };

  const cleanBodyText = (body: string) => {
    if (!body) return "";
    let cleaned = body.replace(/!\[.*?\]\(.*?\)/g, "");
    cleaned = cleaned.replace(/<iframe[^>]*>.*?<\/iframe>/gi, "");
    cleaned = cleaned.replace(/\n\s*\n/g, "\n").trim();
    return cleaned;
  };

  // Helper function to get profile image URL
  const getProfileImageUrl = (username: string) => {
    return `https://images.hive.blog/u/${username}/avatar/small`;
  };

  // Function to redirect to the snap's dedicated page for deeper discussion
  const goToSnapPage = () => {
    const snapUrl = `/post/${currentSnap.author}/${currentSnap.permlink}`;
    window.open(snapUrl, "_blank");
  };

  // Function to share the current snap modal URL
  const handleShareSnap = async () => {
    await safeCopyToClipboard(window.location.href, {
      successMessage: "Link copied!",
      errorMessage: "Failed to copy link",
      showToast: (options) => toast({
        title: options.title,
        description: options.status === "success" 
          ? "Snap link has been copied to your clipboard" 
          : "Please try again",
        status: options.status,
        duration: 3000,
        isClosable: true,
      })
    });
  };

  useEffect(() => {
    setCurrentMediaIndex(0);
    setOptimisticComments([]);
    // Reset voting state when snap changes
    setVoted(
      hasSoftVote ||
        currentSnap.active_votes?.some(
          (item: { voter: string }) => item.voter === effectiveUser
        ) ||
        false
    );
    setActiveVotes(currentSnap.active_votes || []);
    setShowSlider(false);
  }, [currentSnap, effectiveUser, hasSoftVote]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      // Prevent handling if user is typing in an input/textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          prevSnap();
          if (allMedia.length > 1 && currentMediaIndex > 0) prevMedia();
          break;
        case "ArrowRight":
          event.preventDefault();
          nextSnap();
          if (allMedia.length > 1 && currentMediaIndex < allMedia.length - 1)
            nextMedia();
          break;
        case "ArrowUp":
          event.preventDefault();
          prevSnap();
          break;
        case "ArrowDown":
          event.preventDefault();
          nextSnap();
          break;
        case "Escape":
          // Let the modal handle this - don't prevent default
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    currentMediaIndex,
    allMedia.length,
    nextMedia,
    nextSnap,
    prevMedia,
    prevSnap,
    onClose,
  ]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={modalSize}
      isCentered
      closeOnOverlayClick={true}
      closeOnEsc={true}
    >
      <ModalOverlay bg="blackAlpha.900" />
      <ModalContent
        bg="rgb(24, 24, 24)"
        color="white"
        h={{ base: "100vh", md: "85vh" }}
        borderRadius={{ base: 0, md: "lg" }}
      >
        <ModalCloseButton zIndex={20} />

        <ModalBody
          p={0}
          display="flex"
          flexDirection={{ base: "column", md: "row" }}
        >
          {/* Left: Media */}
          <Box
            flex="1"
            display="flex"
            justifyContent="center"
            alignItems="center"
            bg="black"
            h={{ base: "60vh", md: "85vh" }}
            position="relative"
            overflow="hidden"
          >
            {isVideo ? (
              <Box
                w="100%"
                h="100%"
                display="flex"
                justifyContent="center"
                alignItems="center"
                sx={{
                  "& > div": {
                    width: "100%",
                    height: "100%",
                    paddingTop: "0 !important",
                    minWidth: "auto !important",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  },
                  "& video": {
                    width: { base: "100%", md: "auto" },
                    height: { base: "100%", md: "auto" },
                    maxWidth: { base: "none", md: "100%" },
                    maxHeight: { base: "none", md: "calc(100% - 60px)" },
                    objectFit: { base: "cover", md: "contain" },
                    marginBottom: "0 !important",
                  },
                  "& picture": {
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  },
                }}
              >
                <VideoRenderer
                  src={currentMedia}
                  loop
                  skipThumbnailLoad={true}
                />
              </Box>
            ) : (
              <Image
                src={mediaSrc}
                alt="Snap content"
                w={{ base: "100%", md: "auto" }}
                h={{ base: "100%", md: "auto" }}
                maxW={{ base: "none", md: "100%" }}
                maxH={{ base: "none", md: "85vh" }}
                objectFit={{ base: "cover", md: "contain" }}
                onError={onMediaError}
              />
            )}

            {/* Optional Download Button */}
            {!isVideo && (
              <a
                href={currentMedia}
                download={currentMedia ? currentMedia.split("/").pop() || "media" : "media"}
                style={{
                  position: "absolute",
                  bottom: "16px",
                  right: "16px",
                }}
              >
                <Button
                  colorScheme="green"
                  size="sm"
                  leftIcon={<FaDownload />}
                  opacity={0}
                  transition="opacity 0.2s"
                  _hover={{ opacity: 1 }}
                >
                  Download
                </Button>
              </a>
            )}

            {/* Media Navigation Arrows */}
            {allMedia.length > 1 && (
              <>
                <IconButton
                  aria-label="Previous media"
                  icon={<FaChevronLeft />}
                  position="absolute"
                  left={{ base: 1, md: 2 }}
                  top="50%"
                  transform="translateY(-50%)"
                  bg="blackAlpha.600"
                  color="white"
                  _hover={{ bg: "blackAlpha.800" }}
                  onClick={prevMedia}
                  zIndex={15}
                  size={{ base: "sm", md: "md" }}
                  isDisabled={currentMediaIndex === 0}
                  opacity={currentMediaIndex === 0 ? 0.5 : 1}
                />
                <IconButton
                  aria-label="Next media"
                  icon={<FaChevronRight />}
                  position="absolute"
                  right={{ base: 1, md: 2 }}
                  top="50%"
                  transform="translateY(-50%)"
                  bg="blackAlpha.600"
                  color="white"
                  _hover={{ bg: "blackAlpha.800" }}
                  onClick={nextMedia}
                  zIndex={15}
                  size={{ base: "sm", md: "md" }}
                  isDisabled={currentMediaIndex === allMedia.length - 1}
                  opacity={currentMediaIndex === allMedia.length - 1 ? 0.5 : 1}
                />
              </>
            )}

            {/* Media Counter */}
            {allMedia.length > 1 && (
              <Box
                position="absolute"
                top={{ base: 2, md: 4 }}
                left="50%"
                transform="translateX(-50%)"
                bg="blackAlpha.700"
                color="white"
                px={3}
                py={1}
                borderRadius="full"
                fontSize="sm"
                zIndex={10}
              >
                {currentMediaIndex + 1} / {allMedia.length}
              </Box>
            )}

            {/* Snap Navigation Arrows */}
            {snaps.length > 1 && currentSnapIndex >= 0 && (
              <>
                <IconButton
                  aria-label="Previous snap"
                  icon={<FaChevronLeft />}
                  position="absolute"
                  left={{ base: 1, md: 2 }}
                  bottom={{ base: 20, md: 10 }}
                  bg="background"
                  color="primary"
                  _hover={{ color: "primary", bg: "black" }}
                  onClick={prevSnap}
                  zIndex={15}
                  size={{ base: "sm", md: "md" }}
                  isDisabled={currentSnapIndex <= 0}
                  opacity={currentSnapIndex <= 0 ? 0.2 : 0.4}
                />
                <IconButton
                  aria-label="Next snap"
                  icon={<FaChevronRight />}
                  position="absolute"
                  right={{ base: 1, md: 2 }}
                  bottom={{ base: 20, md: 10 }}
                  bg="background"
                  color="primary"
                  _hover={{ color: "primary", bg: "black" }}
                  onClick={nextSnap}
                  zIndex={15}
                  size={{ base: "sm", md: "md" }}
                  isDisabled={currentSnapIndex >= snaps.length - 1}
                  opacity={currentSnapIndex >= snaps.length - 1 ? 0.2 : 0.4}
                />
              </>
            )}
          </Box>

          {/* Right: Comments & Info */}
          <Box
            flex="1"
            p={4}
            maxW={{ base: "100%", md: "40%" }}
            display="flex"
            flexDirection="column"
            h={{ base: "40vh", md: "85vh" }}
            overflow="hidden"
          >
            {/* Snap Info */}
            <Box mb={4}>
              <HStack spacing={3} align="start" justify="space-between">
                <HStack spacing={3} align="start">
                  <Avatar
                    src={getProfileImageUrl(currentSnap.author)}
                    name={currentSnap.author}
                    size="md"
                  />
                  <Box>
                    <Text fontWeight="bold" color="primary">
                      @{currentSnap.author}
                    </Text>
                    <Text fontSize="sm" color="muted">
                      {new Date(currentSnap.created).toLocaleDateString()}
                    </Text>
                  </Box>
                </HStack>
              </HStack>
              {cleanBodyText(currentSnap.body) && (
                <Box color="text" fontSize="sm" mt={2} lineHeight="1.5">
                  <HiveMarkdown
                    markdown={cleanBodyText(currentSnap.body)}
                    style={{
                      fontSize: "14px",
                      lineHeight: "1.5",
                      color: "inherit",
                    }}
                  />
                </Box>
              )}

              {/* Voting Section */}
              <UpvoteButton
                discussion={currentSnap}
                voted={voted}
                setVoted={setVoted}
                activeVotes={activeVotes}
                setActiveVotes={setActiveVotes}
                showSlider={showSlider}
                setShowSlider={setShowSlider}
                onVoteSuccess={() => setVoted(true)}
                variant="withSlider"
                size="sm"
              />
            </Box>

            {/* Comments Section */}
            <Box flex="1" overflow="hidden" minH="0">
              {/* Comments Header */}
              <Flex justify="space-between" align="center" mb={3}>
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<FaComments />}
                  onClick={goToSnapPage}
                  color="primary"
                  _hover={{ bg: "blackAlpha.300" }}
                >
                  Snap Page
                </Button>
                {/* Share Button */}
                <IconButton
                  aria-label="Share snap"
                  icon={<FaShare />}
                  size="sm"
                  variant="ghost"
                  colorScheme="gray"
                  onClick={handleShareSnap}
                  _hover={{ bg: "gray.700" }}
                />
              </Flex>
              {/* Comment Composer */}
              <Box>
                <SnapComposer
                  pa={currentSnap.author}
                  pp={currentSnap.permlink}
                  onNewComment={handleNewComment}
                  post={false}
                  onClose={() => {}}
                  submitLabel="Reply"
                  buttonSize="sm"
                />
              </Box>
              <Box
                h="calc(100% - 50px)"
                overflowY="auto"
                css={{
                  "&::-webkit-scrollbar": {
                    width: "4px",
                  },
                  "&::-webkit-scrollbar-track": {
                    width: "6px",
                  },
                  "&::-webkit-scrollbar-thumb": {
                    background: "rgba(255, 255, 255, 0.3)",
                    borderRadius: "24px",
                  },
                }}
              >
                <VStack spacing={3} align="stretch">
                  {commentsLoading ? (
                    <Text color="muted" textAlign="center" py={8}>
                      Loading comments...
                    </Text>
                  ) : commentsError ? (
                    <Text color="red.400" textAlign="center" py={8}>
                      Error loading comments: {commentsError}
                    </Text>
                  ) : optimisticComments.length === 0 &&
                    comments.length === 0 ? (
                    <Text color="muted" textAlign="center" py={8}>
                      No comments yet. Be the first to comment!
                    </Text>
                  ) : (
                    <>
                      {/* Show optimistic comments first (newest) */}
                      {optimisticComments.map((comment, index) => (
                        <Box
                          key={`optimistic-${index}`}
                          p={2}
                          borderRadius="none"
                          bg="muted"
                          opacity={0.8}
                          borderLeft="3px solid"
                          borderColor="primary"
                        >
                          <Snap
                            discussion={comment}
                            onOpen={() => {}}
                            setReply={() => {}}
                            onCommentAdded={handleCommentAdded}
                          />
                        </Box>
                      ))}
                      {/* Show real comments using Snap component */}
                      {comments.map((comment, index) => (
                        <Box
                          key={comment.permlink || index}
                          p={2}
                          borderRadius="none"
                          bg="muted"
                        >
                          <Snap
                            discussion={comment}
                            onOpen={() => {}}
                            setReply={() => {}}
                            onCommentAdded={handleCommentAdded}
                          />
                        </Box>
                      ))}
                    </>
                  )}
                </VStack>
              </Box>
            </Box>

            {/* Divider */}
            <Divider my={4} />
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default SnapModal;
export type { SnapWithMedia };
