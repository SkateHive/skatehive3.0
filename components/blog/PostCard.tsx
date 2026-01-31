import {
  Box,
  Image,
  Text,
  Avatar,
  Flex,
  Link,
  Tooltip,
  Menu,
  MenuButton,
  MenuList,
  IconButton,
  HStack,
  useToast,
} from "@chakra-ui/react";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Discussion } from "@hiveio/dhive";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { getPostDate } from "@/lib/utils/GetPostDate";
import useHiveVote from "@/hooks/useHiveVote";
import useSoftPostOverlay from "@/hooks/useSoftPostOverlay";
import useSoftVoteOverlay from "@/hooks/useSoftVoteOverlay";
import { getPayoutValue } from "@/lib/hive/client-functions";
import {
  extractYoutubeLinks,
  LinkWithDomain,
  extractImageUrls,
} from "@/lib/utils/extractImageUrls"; // Import YouTube extraction function
import useHivePower from "@/hooks/useHivePower";
import { useVoteWeightContext } from "@/contexts/VoteWeightContext";
import { parseJsonMetadata } from "@/lib/hive/metadata-utils";
import { extractSafeUser } from "@/lib/userbase/safeUserMetadata";
import MatrixOverlay from "@/components/graphics/MatrixOverlay";
import { UpvoteButton } from "@/components/shared";
import { BiDotsHorizontal } from "react-icons/bi";
import ShareMenuButtons from "@/components/homepage/ShareMenuButtons";
import { LuArrowUp, LuArrowDown, LuDollarSign } from "react-icons/lu";
import VoteListPopover from "@/components/blog/VoteListModal";

interface PostJsonMetadata {
  app?: string;
  format?: string;
  description?: string;
  tags?: string[];
  users?: string[];
  links?: string[];
  image?: string | string[];
  [key: string]: any;
}

interface PostCardProps {
  post: Discussion;
  listView?: boolean;
  hideAuthorInfo?: boolean;
}

export default function PostCard({
  post,
  listView = false,
  hideAuthorInfo = false,
}: PostCardProps) {
  const { title, author, body, json_metadata, created } = post;
  const postDate = getPostDate(created);

  // Use useMemo to parse JSON only when json_metadata changes
  const metadata = useMemo((): PostJsonMetadata => {
    const parsed = parseJsonMetadata(json_metadata);
    // Ensure we always return a valid object, even if parseJsonMetadata fails
    return parsed && typeof parsed === "object" ? parsed : {};
  }, [json_metadata]);

  const safeUser = useMemo(() => extractSafeUser(metadata), [metadata]);

  const softPost = useSoftPostOverlay(post.author, post.permlink, safeUser);
  const softVote = useSoftVoteOverlay(post.author, post.permlink);

  const displayAuthor =
    softPost?.user?.handle || softPost?.user?.display_name || author;
  const displayAvatar =
    softPost?.user?.avatar_url ||
    `https://images.hive.blog/u/${author}/avatar/sm`;
  const [showSlider, setShowSlider] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const { vote, effectiveUser, canVote } = useHiveVote();
  const toast = useToast();
  const {
    isLoading: isHivePowerLoading,
    estimateVoteValue,
  } = useHivePower(effectiveUser || "");
  const { voteWeight: userVoteWeight, disableSlider } = useVoteWeightContext();
  const [isVoting, setIsVoting] = useState(false);
  const [activeVotes, setActiveVotes] = useState(post.active_votes || []);
  const [payoutValue, setPayoutValue] = useState(
    parseFloat(getPayoutValue(post))
  );
  const hasSoftVote =
    !!softVote && softVote.status !== "failed" && softVote.weight > 0;
  const [voted, setVoted] = useState(
    hasSoftVote ||
      post.active_votes?.some(
        (item) => item.voter.toLowerCase() === effectiveUser?.toLowerCase()
      )
  );
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    setActiveVotes(post.active_votes || []);
    setPayoutValue(parseFloat(getPayoutValue(post)));
    setVoted(
      hasSoftVote ||
        post.active_votes?.some(
          (item) => item.voter.toLowerCase() === effectiveUser?.toLowerCase()
        )
    );
  }, [post, effectiveUser, hasSoftVote]);
  const default_thumbnail =
    softPost?.user?.avatar_url ||
    "https://images.hive.blog/u/" + author + "/avatar/large";
  const [visibleImages, setVisibleImages] = useState<number>(3);
  const [showMatrix, setShowMatrix] = useState(false);
  const matrixTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matrixHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (matrixTimerRef.current) {
        clearTimeout(matrixTimerRef.current);
      }
      if (matrixHideTimerRef.current) {
        clearTimeout(matrixHideTimerRef.current);
      }
    };
  }, []);

  // Calculate days remaining for pending payout
  const createdDate = new Date(post.created);
  const now = new Date();
  const timeDifferenceInMs = now.getTime() - createdDate.getTime();
  const timeDifferenceInDays = timeDifferenceInMs / (1000 * 60 * 60 * 24);
  const daysRemaining = Math.max(0, 7 - Math.floor(timeDifferenceInDays));
  const isPending = timeDifferenceInDays < 7;
  // Calculate payout timestamp (creation + 7 days)

  const summary = useMemo(() => {
    let summarySource = body;
    if (listView) {
      summarySource = summarySource.replace(/!\[[^\]]*\]\([^\)]*\)/g, "");
      summarySource = summarySource.replace(/!\[\]\([^\)]*\)/g, "");
      summarySource = summarySource.replace(/\[[^\]]*\]\([^\)]*\)/g, "");
      summarySource = summarySource.replace(
        /https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/g,
        ""
      );
      summarySource = summarySource.replace(/<[^>]+>/g, "");
    }

    return summarySource
      .replace(/[#*_`>\[\]()!\-]/g, "")
      .replace(/\n+/g, " ");
  }, [body, listView]);

  const mediaData = useMemo(() => {
    let images: string[] = [];
    if (metadata.image) {
      images = Array.isArray(metadata.image) ? metadata.image : [metadata.image];
    }

    const markdownImages = extractImageUrls(body);
    images = images.concat(markdownImages);

    const uniqueImages = Array.from(new Set(images));
    const validImages = uniqueImages.filter((img) => !failedImages.has(img));
    if (validImages.length > 0) {
      return { imageUrls: validImages, youtubeLinks: [] as LinkWithDomain[] };
    }

    const ytLinks = extractYoutubeLinks(body);
    if (ytLinks.length > 0) {
      const uniqueLinks = Array.from(new Set(ytLinks.map((link) => link.url)))
        .map((url) => ytLinks.find((link) => link.url === url)!)
        .filter(Boolean);
      return { imageUrls: [] as string[], youtubeLinks: uniqueLinks };
    }

    return {
      imageUrls: [default_thumbnail],
      youtubeLinks: [] as LinkWithDomain[],
    };
  }, [body, metadata.image, failedImages, default_thumbnail]);

  const { imageUrls, youtubeLinks } = mediaData;
  const hasMultipleImages = imageUrls.length > 1;
  const hasMultipleVideos = youtubeLinks.length > 1;

  // **Function to load more slides**
  function handleSlideChange(swiper: any) {
    // Check if user is reaching the end of currently visible images
    if (
      swiper.activeIndex === visibleImages - 1 &&
      visibleImages < imageUrls.length
    ) {
      setVisibleImages((prev) => Math.min(prev + 3, imageUrls.length)); // Load 3 more slides
    }
  }

  function handleSwiperInit(swiper: any) {
    setTimeout(() => {
      if (!swiper.el) return;
      const next = swiper.el.querySelector(".swiper-button-next");
      const prev = swiper.el.querySelector(".swiper-button-prev");
      
      // Named handlers for cleanup
      const handleNextClick = (event: Event) => event.stopPropagation();
      const handlePrevClick = (event: Event) => event.stopPropagation();
      
      if (next) {
        next.addEventListener("click", handleNextClick);
      }
      if (prev) {
        prev.addEventListener("click", handlePrevClick);
      }
      
      // Clean up listeners on destroy
      swiper.on('destroy', () => {
        if (next) {
          next.removeEventListener("click", handleNextClick);
        }
        if (prev) {
          prev.removeEventListener("click", handlePrevClick);
        }
      });
    }, 0);
  }

  // Enhanced function to handle image load errors with fallback
  function handleImageError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
    const img = e.currentTarget;
    const originalSrc = img.src;

    // Track failed images to avoid retrying them
    setFailedImages((prev) => {
      const next = new Set(prev);
      next.add(originalSrc);
      return next;
    });

    // If this is not already the fallback image, try to set it
    if (img.src !== default_thumbnail) {
      img.src = default_thumbnail;
      img.onerror = null; // Prevent infinite loop
    }

    const mask = img.parentElement?.querySelector(
      ".post-card-image-mask"
    ) as HTMLElement | null;
    if (mask) {
      mask.classList.add("is-loaded");
    }

    // Prevent the error from bubbling up
    e.preventDefault();
    e.stopPropagation();

    // Return false to prevent the default error handling
    return false;
  }

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement, Event>) {
    const img = e.currentTarget;
    const mask = img.parentElement?.querySelector(
      ".post-card-image-mask"
    ) as HTMLElement | null;
    if (mask) {
      mask.classList.add("is-loaded");
    }
  }

  // Direct vote handler for when slider is disabled
  async function handleDirectVote() {
    if (!canVote || voted || isVoting) return;
    
    setIsVoting(true);
    try {
      const voteResult = await vote(
        post.author,
        post.permlink,
        userVoteWeight * 100
      );
      
      if (voteResult.success) {
        setVoted(true);
        if (effectiveUser) {
          setActiveVotes((prev) => [
            ...prev,
            { voter: effectiveUser, weight: userVoteWeight * 100 },
          ]);
        }
        
        // Update payout value with estimated value
        if (estimateVoteValue && !isHivePowerLoading) {
          try {
            const estimatedValue = await estimateVoteValue(userVoteWeight);
            if (estimatedValue) {
              setPayoutValue((prev) => prev + estimatedValue);
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


  const { authorPayout, curatorPayout } = useMemo(() => {
    const assetToString = (val: string | { toString: () => string }): string =>
      typeof val === "string" ? val : val.toString();

    const parsePayout = (
      val: string | { toString: () => string } | undefined
    ): number => {
      if (!val) return 0;
      const str = assetToString(val);
      return parseFloat(str.replace(" HBD", "").replace(/,/g, ""));
    };

    return {
      authorPayout: parsePayout(post.total_payout_value),
      curatorPayout: parsePayout(post.curator_payout_value),
    };
  }, [post.total_payout_value, post.curator_payout_value]);

  if (listView) {
    return (
      <Box
        overflow="hidden"
        height="200px"
        display="flex"
        flexDirection="row"
        bg="background"
        border={"1px solid"}
        borderColor="muted"
      >
        {/* Thumbnail */}
        <Box
          w="160px"
          h="100%"
          flexShrink={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg="muted"
        >
          {imageUrls.length > 0 ? (
            <Image
              src={imageUrls[0]}
              alt={title}
              borderRadius="base"
              objectFit="cover"
              w="100%"
              h="100%"
              loading="lazy"
              decoding="async"
              onError={handleImageError}
            />
          ) : (
            <Image
              src={default_thumbnail}
              alt="default thumbnail"
              borderRadius="base"
              objectFit="cover"
              w="100%"
              h="100%"
              loading="lazy"
              decoding="async"
              onError={handleImageError}
            />
          )}
        </Box>
        {/* Content */}
        <Flex direction="column" flex={1} p={4} minW={0}>
          <Box flex={1} overflow="hidden">
            <Link
              href={`/post/${author}/${post.permlink}`}
            >
              <Text
                fontWeight="bold"
                fontSize={listView ? "sm" : "sm"}
                mb={1}
                isTruncated={false}
                whiteSpace="normal"
                wordBreak="break-word"
                noOfLines={2}
                _hover={{ textDecoration: "underline" }}

              >
                {title}
              </Text>
            </Link>
            <Text fontSize="xs" color="muted" mb={2} textAlign="right">
              {postDate}
            </Text>
            <Text
              fontSize="sm"
              color="gray.400"
              mb={2}
              noOfLines={3}
              overflow="hidden"
              textOverflow="ellipsis"
            >
              {summary}
            </Text>
          </Box>
          {/* Action bar */}
          <HStack 
            justify="space-between" 
            mt={2}
            flexShrink={0}
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
                          {payoutValue.toFixed(2)}
                        </Text>
                      </HStack>
                    </HStack>
                  }
                  votes={activeVotes}
                  post={post}
                />
              </Box>
            </Tooltip>
          </HStack>
        </Flex>
      </Box>
    );
  }

  return (
    <>
      <style jsx global>{`
        .custom-swiper {
          --swiper-navigation-color: var(--chakra-colors-primary);
          --swiper-pagination-color: var(--chakra-colors-primary);
        }


        .custom-swiper .swiper-button-next::after,
        .custom-swiper .swiper-button-prev::after {
          font-size: 20px;
        }

        .custom-swiper .swiper-pagination-bullet {
          width: 6px;
          height: 6px;
          border-radius: 0; /* Make the dots squared */
        }

        .subtle-pulse {
          animation: subtle-pulse 2s infinite;
        }
        @keyframes subtle-pulse {
          0% {
            box-shadow: 0 0 0 0 var(--chakra-colors-accent);
          }
          70% {
            box-shadow: 0 0 0 4px rgba(72, 255, 128, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(72, 255, 128, 0);
          }
        }

        .post-card-matrix {
          opacity: 0;
          transition: opacity 0.24s ease;
          will-change: opacity;
        }

        .post-card-matrix.is-visible {
          opacity: 1;
        }

        .post-card-image-mask.is-loaded {
          opacity: 0;
        }

        .post-card-image-mask {
          opacity: 1;
        }

        @media (prefers-reduced-motion: reduce) {
          .post-card-matrix {
            transition: none;
          }
        }
      `}</style>
      <Box
        position="relative"
        borderBottom="1px solid"
        borderColor="muted"
        overflow="hidden"
        height="100%"
        cursor="default"
      >
          {/* MatrixOverlay covers the whole card, only when showMatrix is true */}
          <Box
            position="absolute"
            top={0}
            left={0}
            width="100%"
            height="100%"
            zIndex={1}
            pointerEvents="none"
            className={`post-card-matrix${showMatrix ? " is-visible" : ""}`}
          >
            <MatrixOverlay />
          </Box>
        <Box
          py={4}
          px={4}
          display="flex"
          flexDirection="column"
          justifyContent="space-between"
          height="100%"
          position="relative"
          zIndex={2}
        >
          {/* Only show author info if not hidden */}
          {!hideAuthorInfo && (
            <Box mb={4}>
              <Flex
                alignItems="center"
                minWidth={0}
                justifyContent="space-between"
                gap={3}
              >
                <Link
                  href={`/@${author}`}
                  display="flex"
                  alignItems="center"
                  _hover={{ textDecoration: "underline" }}
                  minWidth={0}
                >
                  <Avatar
                    size="sm"
                    name={displayAuthor}
                    src={displayAvatar}
                  />
                  <Text
                    fontWeight="bold"
                    fontSize="3xl"
                    ml={2}
                    color="primary"
                    _hover={{ color: "accent" }}
                    isTruncated
                    maxW="240px"
                  >
                    {displayAuthor}
                  </Text>
                  <Text fontSize="xs" color="gray.500" ml={2}>
                    · {postDate}
                  </Text>
                </Link>
                <Menu>
                  <MenuButton
                    as={IconButton}
                    aria-label="Post actions"
                    icon={<BiDotsHorizontal />}
                    size="sm"
                    variant="ghost"
                    _active={{ bg: "none" }}
                    _hover={{ bg: "none" }}
                    bg="background"
                    color="primary"
                  />
                  <MenuList bg="background" color="primary">
                    <ShareMenuButtons comment={post} />
                  </MenuList>
                </Menu>
              </Flex>
            </Box>
          )}

          {/* Content Box */}
          <Box
            border="2px solid"
            borderColor="muted"
            borderRadius="none"
            overflow="hidden"
            bg="transparent"
          >
            {/* Image Section */}
            <Box
              flex="1"
              display="flex"
              alignItems="flex-end"
              justifyContent="center"
              zIndex={2}
            >
               {imageUrls.length > 0 ? (
                 hasMultipleImages ? (
                   <Swiper
                     spaceBetween={10}
                     slidesPerView={1}
                     pagination={{ clickable: true }}
                     navigation={true}
                     modules={[Navigation, Pagination]}
                     onSlideChange={handleSlideChange}
                     className="custom-swiper"
                     onSwiper={handleSwiperInit}
                     observer={false}
                     observeParents={false}
                     watchSlidesProgress={false}
                     watchOverflow={true}
                   >
                    {imageUrls.slice(0, visibleImages).map((url, index) => (
                      <SwiperSlide key={`${url}-${index}`}>
                         <Box h="200px" w="100%" position="relative" sx={{ userSelect: "none" }}>
                     <Image
                       src={url}
                       alt={title}
                       objectFit="cover"
                       w="100%"
                       h="100%"
                       loading="lazy"
                       decoding="async"
                       transform="none"
                       transition="none"
                       onError={handleImageError}
                       onLoad={handleImageLoad}
                     />
                            <Box
                              position="absolute"
                              inset={0}
                              bg="background"
                              opacity={0}
                              transition="opacity 0.18s ease"
                              pointerEvents="none"
                              className="post-card-image-mask"
                            />
                         </Box>
                      </SwiperSlide>
                    ))}
                  </Swiper>
                ) : (
                  <Box h="200px" w="100%" position="relative">
                    <Image
                      src={imageUrls[0]}
                      alt={title}
                      objectFit="cover"
                      w="100%"
                      h="100%"
                      loading="lazy"
                      decoding="async"
                      transform="none"
                      transition="none"
                      onError={handleImageError}
                      onLoad={handleImageLoad}
                    />
                    <Box
                      position="absolute"
                      inset={0}
                      bg="background"
                      opacity={0}
                      transition="opacity 0.18s ease"
                      pointerEvents="none"
                      className="post-card-image-mask"
                    />
                  </Box>
                )
              ) : youtubeLinks.length > 0 ? (
                hasMultipleVideos ? (
                  <Swiper
                    spaceBetween={10}
                    slidesPerView={1}
                    pagination={{ clickable: true }}
                    navigation={true}
                    modules={[Navigation, Pagination]}
                    className="custom-swiper"
                    onSwiper={handleSwiperInit}
                  >
                    {youtubeLinks.map((link, index) => (
                      <SwiperSlide key={`${link.url}-${index}`}>
                         <Box h="200px" w="100%" position="relative">
                            <iframe
                              src={link.url}
                              title={`YouTube video from ${link.domain}`}
                              width="100%"
                              height="100%"
                              frameBorder="0"
                              loading="lazy"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            ></iframe>
                            <Box
                              position="absolute"
                              inset={0}
                              bg="background"
                              opacity={0}
                              transition="opacity 0.18s ease"
                              pointerEvents="none"
                              className="post-card-image-mask"
                            />
                         </Box>
                      </SwiperSlide>
                    ))}
                  </Swiper>
                ) : (
                  <Box h="200px" w="100%" position="relative">
                    <iframe
                      src={youtubeLinks[0].url}
                      title={`YouTube video from ${youtubeLinks[0].domain}`}
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                    <Box
                      position="absolute"
                      inset={0}
                      bg="background"
                      opacity={0}
                      transition="opacity 0.18s ease"
                      pointerEvents="none"
                      className="post-card-image-mask"
                    />
                  </Box>
                )
              ) : (
                 <Box h="200px" w="100%" position="relative">
                    <Image
                      src={default_thumbnail}
                      alt="default thumbnail"
                      objectFit="cover"
                      w="100%"
                      h="100%"
                      loading="lazy"
                      decoding="async"
                      transform="none"
                      transition="none"
                      onError={handleImageError}
                      onLoad={handleImageLoad}
                    />
                    <Box
                      position="absolute"
                      inset={0}
                      bg="background"
                      opacity={0}
                      transition="opacity 0.18s ease"
                      pointerEvents="none"
                      className="post-card-image-mask"
                    />
                 </Box>
              )}
            </Box>

            {/* Title Section with border separator */}
            <Link
              href={`/post/${author}/${post.permlink}`}
              _hover={{ textDecoration: "none" }}
              style={{ display: "block" }}
            >
              <Box
                borderTop="1px solid"
                borderColor="muted"
                p={3}
                textAlign="center"
                cursor="pointer"
                bg="transparent"
                transition="color 0.2s"
                _hover={{
                  "& .post-title-text": { color: "accent" },
                }}
                onMouseEnter={() => {
                  if (matrixHideTimerRef.current) {
                    clearTimeout(matrixHideTimerRef.current);
                    matrixHideTimerRef.current = null;
                  }
                  if (matrixTimerRef.current) {
                    clearTimeout(matrixTimerRef.current);
                  }
                  matrixTimerRef.current = setTimeout(
                    () => setShowMatrix(true),
                    80
                  );
                }}
                onMouseLeave={() => {
                  if (matrixTimerRef.current) {
                    clearTimeout(matrixTimerRef.current);
                    matrixTimerRef.current = null;
                  }
                  if (matrixHideTimerRef.current) {
                    clearTimeout(matrixHideTimerRef.current);
                  }
                  matrixHideTimerRef.current = setTimeout(
                    () => setShowMatrix(false),
                    160
                  );
                }}
                position="relative"
                zIndex={3}
              >
                <Text
                  className="post-title-text"
                  fontSize={"16px"}
                  isTruncated={false}
                  whiteSpace="normal"
                  wordBreak="break-word"
                  noOfLines={2}
                  color="primary"
                  transition="color 0.2s"
                >
                  {title}
                </Text>
              </Box>
            </Link>
          </Box>
          <Box mt="auto">
            {showSlider ? (
              <UpvoteButton
                discussion={post}
                voted={voted}
                setVoted={setVoted}
                activeVotes={activeVotes}
                setActiveVotes={setActiveVotes}
                showSlider={showSlider}
                setShowSlider={setShowSlider}
                onVoteSuccess={(estimatedValue?: number) => {
                  if (estimatedValue) {
                    setPayoutValue((prev) => prev + estimatedValue);
                  }
                }}
                estimateVoteValue={estimateVoteValue}
                isHivePowerLoading={isHivePowerLoading}
                variant="withSlider"
                size="sm"
              />
            ) : (
              <HStack 
                justify="space-between" 
                mt={4}
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
                              {payoutValue.toFixed(2)}
                            </Text>
                          </HStack>
                        </HStack>
                      }
                      votes={activeVotes}
                      post={post}
                    />
                  </Box>
                </Tooltip>
              </HStack>
            )}
          </Box>
        </Box>
      </Box>
    </>
  );
}
