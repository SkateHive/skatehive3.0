import React, { useState, useEffect } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import {
  Box,
  Spinner,
  VStack,
  Button,
  HStack,
  Text,
  SimpleGrid,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Image,
} from "@chakra-ui/react";
import { FaCoins, FaGift, FaUser, FaGavel, FaHive } from "react-icons/fa";
import { useRouter } from "next/navigation";
import Snap from "./Snap";
import SnapComposer from "./SnapComposer";
import CoinCreatorComposer from "./CoinCreatorComposer";
import { AirdropModal } from "../airdrop/AirdropModal";
import { Discussion } from "@hiveio/dhive"; // Add this import for consistency
import LogoMatrix from "../graphics/LogoMatrix";
import UpvoteSnapContainer from "./UpvoteSnapContainer";
import { countDownvotes } from "@/lib/utils/postUtils";
import { separateContent, parseMediaContent } from "@/lib/utils/snapUtils";
import { useAioha } from "@aioha/react-ui";
import { useAccount } from "wagmi";
import SidebarLogo from "../graphics/SidebarLogo";
import VerticalVideoFeed from "./VerticalVideoFeed";
import useIsMobile from "@/hooks/useIsMobile";

interface SnapListProps {
  author: string;
  permlink: string;
  setConversation: (conversation: Discussion) => void;
  onOpen: () => void;
  setReply: (reply: Discussion) => void;
  newComment: Discussion | null;
  setNewComment: (Discussion: Discussion | null) => void;
  post?: boolean;
  data: InfiniteScrollData;
  hideComposer?: boolean;
}

interface InfiniteScrollData {
  comments: Discussion[];
  loadNextPage: () => void; // Default can be an empty function in usage
  isLoading: boolean;
  hasMore: boolean; // Default can be `false` in usage
}

export default function SnapList({
  author,
  permlink,
  setConversation,
  onOpen: onOpenConversation,
  setReply,
  newComment,
  setNewComment,
  post = false,
  data,
  hideComposer = false,
}: SnapListProps) {
  const { comments, loadNextPage, isLoading, hasMore } = data;
  const [displayedComments, setDisplayedComments] = useState<Discussion[]>([]);

  // Get authentication status
  const { user } = useAioha(); // Hive connection
  const { isConnected } = useAccount(); // Ethereum connection
  const router = useRouter(); // Next.js navigation

  // Modal state for coin creator
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Modal state for airdrop
  const {
    isOpen: isAirdropOpen,
    onOpen: onAirdropOpen,
    onClose: onAirdropClose,
  } = useDisclosure();

  // Mounted state
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Mobile video feed state
  const isMobile = useIsMobile();
  const [showVerticalVideoFeed, setShowVerticalVideoFeed] = useState(false);
  const [videoFeedStartSrc, setVideoFeedStartSrc] = useState<string>("");
  const [originalScrollPosition, setOriginalScrollPosition] = useState(0);
  const [lastCommentCount, setLastCommentCount] = useState(0);

  // Handle mobile video fullscreen
  const handleMobileVideoFullscreen = (videoSrc: string) => {
    if (!isMobile) return;

    // Save current scroll position
    const scrollElement = document.getElementById("scrollableDiv");
    if (scrollElement) {
      setOriginalScrollPosition(scrollElement.scrollTop);
    }

    console.log('Opening video with src:', videoSrc);
    setVideoFeedStartSrc(videoSrc);
    setShowVerticalVideoFeed(true);
  };

  const handleCloseVideoFeed = () => {
    setShowVerticalVideoFeed(false);
    
    // Restore scroll position after a brief delay
    setTimeout(() => {
      const scrollElement = document.getElementById("scrollableDiv");
      if (scrollElement) {
        scrollElement.scrollTop = originalScrollPosition;
      }
    }, 100);
  };

  // Update displayed comments when data.comments changes or newComment is added
  useEffect(() => {
    if (comments) {
      setDisplayedComments([...comments]);
    }
  }, [comments]);

  useEffect(() => {
    if (newComment) {
      setDisplayedComments((prevComments) => {
        const exists = prevComments.some(
          (c) => c.permlink === (newComment as any).permlink
        );
        if (!exists) {
          return [newComment as unknown as Discussion, ...prevComments];
        }
        return prevComments;
      });
    }
  }, [newComment]);

  const handleNewComment = (newComment: Partial<Discussion>) => {
    if (typeof setNewComment === "function") {
      setNewComment(newComment as unknown as Discussion);
    } else {
      console.warn("setNewComment is not a function");
      setDisplayedComments((prev) => [
        newComment as unknown as Discussion,
        ...prev,
      ]);
    }
  };

  const filteredAndSortedComments = [...displayedComments]
    .filter((discussion: Discussion) => {
      if (!discussion || !discussion.active_votes) return false;
      const downvoteCount = countDownvotes(discussion.active_votes);
      // Filter out posts with 2 or more downvotes (community disapproval)
      const shouldShow = downvoteCount < 2;
      if (!shouldShow) {
      }
      return shouldShow;
    })
    .sort((a: Discussion, b: Discussion) => {
      if (!a || !b || !a.created || !b.created) return 0;
      return new Date(b.created).getTime() - new Date(a.created).getTime();
    });

  // Track when new content is loaded to maintain video position
  useEffect(() => {
    if (filteredAndSortedComments.length !== lastCommentCount) {
      setLastCommentCount(filteredAndSortedComments.length);
    }
  }, [filteredAndSortedComments.length, lastCommentCount]);

  // Conditionally render after all hooks have run
  if (!hasMounted) return null;

  return (
    <VStack spacing={1} align="stretch" mx="auto">
      {isLoading && filteredAndSortedComments.length === 0 ? (
        <Box textAlign="center" mt={-1}>
          <LogoMatrix />
        </Box>
      ) : (
        <>
          {!hideComposer && (
            <>
              {user ? (
                // User is connected to Hive - show SnapComposer
                <SnapComposer
                  pa={author}
                  pp={permlink}
                  onNewComment={
                    handleNewComment as (
                      newComment: Partial<Discussion>
                    ) => void
                  }
                  onClose={() => null}
                />
              ) : isConnected ? (
                // User is connected to Ethereum but not Hive - show action buttons
                <Box
                  p={2}
                  borderRadius="xl"
                  _dark={{ borderColor: "gray.600" }}
                  mb={4}
                >
                  <VStack spacing={6}>
                    {/* Action Buttons Grid */}
                    <SimpleGrid columns={2} spacing={4} w="full">
                      {/* Create a Coin Button */}
                      <Box
                        w="full"
                        p={3}
                        bg="primary.50"
                        _dark={{
                          bg: "primary.900",
                          borderColor: "primary.700",
                        }}
                        borderRadius="none"
                        border="1px solid"
                        borderColor="primary.200"
                        cursor="pointer"
                        transition="all 0.2s"
                        _hover={{
                          transform: "translateY(-2px)",
                          boxShadow: "lg",
                          borderColor: "primary.300",
                        }}
                        onClick={onOpen}
                      >
                        <HStack spacing={3}>
                          <Box
                            w={10}
                            h={10}
                            bg="primary.100"
                            _dark={{ bg: "primary.800" }}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                          >
                            <Image
                              src="/logos/Zorb.png"
                              alt="Coin Icon"
                              boxSize="20px"
                              objectFit="contain"
                            />
                          </Box>
                          <VStack align="start" spacing={0} flex={1}>
                            <Text
                              fontSize="md"
                              fontWeight="semibold"
                              color="primary.600"
                              _dark={{ color: "primary.200" }}
                            >
                              Post with Zora
                            </Text>
                          </VStack>
                        </HStack>
                      </Box>

                      {/* Create Airdrop Button */}
                      <Box
                        w="full"
                        p={3}
                        bg="primary.100"
                        _dark={{
                          bg: "primary.800",
                          borderColor: "primary.600",
                        }}
                        border="1px solid"
                        borderColor="primary.300"
                        cursor="pointer"
                        transition="all 0.2s"
                        _hover={{
                          transform: "translateY(-2px)",
                          boxShadow: "lg",
                          borderColor: "primary.400",
                        }}
                        onClick={() => {
                          onAirdropOpen();
                        }}
                      >
                        <HStack spacing={3}>
                          <Box
                            w={10}
                            h={10}
                            bg="primary.200"
                            _dark={{ bg: "primary.700" }}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                          >
                            <FaGift
                              size={20}
                              color="var(--chakra-colors-primary-500)"
                            />
                          </Box>
                          <VStack align="start" spacing={0} flex={1}>
                            <Text
                              fontSize="md"
                              fontWeight="semibold"
                              color="primary.700"
                              _dark={{ color: "primary.100" }}
                            >
                              Create Airdrop
                            </Text>
                          </VStack>
                        </HStack>
                      </Box>

                      {/* Get Skatehive Account Button */}
                      <Box
                        w="full"
                        p={3}
                        bg="primary.200"
                        _dark={{
                          bg: "primary.700",
                          borderColor: "primary.500",
                        }}
                        border="1px solid"
                        borderColor="primary.400"
                        cursor="pointer"
                        transition="all 0.2s"
                        _hover={{
                          transform: "translateY(-2px)",
                          boxShadow: "lg",
                          borderColor: "primary.500",
                        }}
                        onClick={() => {
                          window.open(
                            "https://base.skatehive.app",
                            "_blank",
                            "noopener,noreferrer"
                          );
                        }}
                      >
                        <HStack spacing={3}>
                          <Box
                            w={10}
                            h={10}
                            bg="primary.300"
                            _dark={{ bg: "primary.600" }}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                          >
                            <FaHive
                              size={20}
                              color="var(--chakra-colors-primary-600)"
                            />
                          </Box>
                          <VStack align="start" spacing={0} flex={1}>
                            <Text
                              fontSize="md"
                              fontWeight="semibold"
                              color="primary.800"
                              _dark={{ color: "primary.50" }}
                            >
                              Get Hive Account
                            </Text>
                          </VStack>
                        </HStack>
                      </Box>

                      {/* Auction Button */}
                      <Box
                        w="full"
                        p={3}
                        bg="primary.300"
                        _dark={{
                          bg: "primary.600",
                          borderColor: "primary.400",
                        }}
                        border="1px solid"
                        borderColor="primary.500"
                        cursor="pointer"
                        transition="all 0.2s"
                        _hover={{
                          transform: "translateY(-2px)",
                          boxShadow: "lg",
                          borderColor: "primary.600",
                        }}
                        onClick={() => {
                          router.push("/auction");
                        }}
                      >
                        <HStack spacing={3} alignContent={"center"}>
                          <Box
                            w={10}
                            h={10}
                            bg="primary.400"
                            _dark={{ bg: "primary.500" }}
                            borderRadius="full"
                            overflow="hidden"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                          >
                            <SidebarLogo prioritizeAuctionImage={true} />
                          </Box>
                          <VStack align="start" spacing={0} flex={1}>
                            <Text
                              fontSize="md"
                              fontWeight="semibold"
                              color="primary.900"
                            >
                              Bid on Auction
                            </Text>
                          </VStack>
                        </HStack>
                      </Box>
                    </SimpleGrid>
                  </VStack>
                </Box>
              ) : (
                // User is not connected to anything - show welcome message
                <></>
              )}
            </>
          )}

          <UpvoteSnapContainer hideIfVoted />

          {/* Coin Creator Modal */}
          <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="2xl"
            scrollBehavior="inside"
            isCentered
          >
            <ModalOverlay bg="blackAlpha.600" />
            <ModalContent mx={4} my={8} bg="background">
              <ModalHeader pb={2}>Create a Coin</ModalHeader>
              <ModalCloseButton />
              <ModalBody pb={6}>
                <CoinCreatorComposer onClose={onClose} />
              </ModalBody>
            </ModalContent>
          </Modal>

          {/* Airdrop Modal */}
          <AirdropModal
            isOpen={isAirdropOpen}
            onClose={onAirdropClose}
            leaderboardData={[]}
            initialSortOption="points"
          />

          <InfiniteScroll
            dataLength={filteredAndSortedComments.length}
            next={loadNextPage}
            hasMore={hasMore}
            loader={
              <Box textAlign="center" mt={4}>
                {/* Changed the spinner to LoadingComponent */}
                <Spinner />
              </Box>
            }
            scrollableTarget="scrollableDiv"
          >
            <VStack spacing={1} align="stretch">
              {filteredAndSortedComments.map((discussion: Discussion) => (
                <Snap
                  key={discussion.permlink}
                  discussion={discussion}
                  onOpen={onOpenConversation}
                  setReply={setReply}
                  onMobileVideoFullscreen={handleMobileVideoFullscreen}
                  {...(!post ? { setConversation } : {})}
                />
              ))}
            </VStack>
          </InfiniteScroll>
        </>
      )}

      {/* Vertical Video Feed - Mobile Only */}
      {showVerticalVideoFeed && (
        <VerticalVideoFeed
          comments={filteredAndSortedComments}
          onClose={handleCloseVideoFeed}
          initialVideoSrc={videoFeedStartSrc}
          onLoadMore={loadNextPage}
          hasMore={hasMore}
          isLoading={isLoading}
        />
      )}
    </VStack>
  );
}
