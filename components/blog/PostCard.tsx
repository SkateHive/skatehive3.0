import {
  Box,
  Image,
  Text,
  Avatar,
  Flex,
  Icon,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Button,
  Link,
  Tooltip,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  useDisclosure,
} from "@chakra-ui/react";
import React, { useState, useEffect, useMemo } from "react";
import { Discussion } from "@hiveio/dhive";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import "swiper/swiper-bundle.css";
import { FaComment } from "react-icons/fa";
import { LuArrowUpRight } from "react-icons/lu";
import { FiBook } from "react-icons/fi";
import { getPostDate } from "@/lib/utils/GetPostDate";
import { useAioha } from "@aioha/react-ui";
import { useRouter } from "next/navigation";
import { getPayoutValue } from "@/lib/hive/client-functions";
import {
  extractYoutubeLinks,
  LinkWithDomain,
  extractImageUrls,
} from "@/lib/utils/extractImageUrls"; // Import YouTube extraction function
import useHivePower from "@/hooks/useHivePower";
import VoteListPopover from "./VoteListModal";

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
  const metadata = useMemo(() => {
    try {
      return JSON.parse(json_metadata);
    } catch (e) {
      console.error("Error parsing JSON metadata", e);
      return {};
    }
  }, [json_metadata]);

  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [youtubeLinks, setYoutubeLinks] = useState<LinkWithDomain[]>([]);
  const [sliderValue, setSliderValue] = useState(100);
  const [showSlider, setShowSlider] = useState(false);
  const { aioha, user } = useAioha();
  const {
    hivePower,
    isLoading: isHivePowerLoading,
    error: hivePowerError,
    estimateVoteValue,
  } = useHivePower(user);
  const [activeVotes, setActiveVotes] = useState(post.active_votes || []);
  const [payoutValue, setPayoutValue] = useState(
    parseFloat(getPayoutValue(post))
  );
  const [voted, setVoted] = useState(
    post.active_votes?.some(
      (item) => item.voter.toLowerCase() === user?.toLowerCase()
    )
  );
  const router = useRouter();
  const default_thumbnail =
    "https://images.hive.blog/u/" + author + "/avatar/large";
  const [visibleImages, setVisibleImages] = useState<number>(3);
  const {
    isOpen: isPayoutOpen,
    onOpen: openPayout,
    onClose: closePayout,
    onToggle: togglePayout,
  } = useDisclosure();

  // Calculate days remaining for pending payout
  const createdDate = new Date(post.created);
  const now = new Date();
  const timeDifferenceInMs = now.getTime() - createdDate.getTime();
  const timeDifferenceInDays = timeDifferenceInMs / (1000 * 60 * 60 * 24);
  const daysRemaining = Math.max(0, 7 - Math.floor(timeDifferenceInDays));
  const isPending = timeDifferenceInDays < 7;
  // Calculate payout timestamp (creation + 7 days)
  const payoutDate = new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  const payoutDateString = payoutDate.toLocaleString();

  // Debug props changes
  useEffect(() => {
    console.log("PostCard props changed:", {
      author,
      permlink: post.permlink,
      postId: post.id,
      authorType: typeof author,
      permlinkType: typeof post.permlink,
      timestamp: new Date().toISOString(),
    });

    if (
      typeof post.permlink !== "string" ||
      post.permlink.includes("[object")
    ) {
      console.error("CORRUPTED PERMLINK DETECTED IN PROPS:", {
        author,
        permlink: post.permlink,
        post: post,
        timestamp: new Date().toISOString(),
        stack: new Error().stack,
      });
    }
  }, [author, post.permlink, post.id]);

  useEffect(() => {
    let images: string[] = [];
    if (metadata.image) {
      images = Array.isArray(metadata.image)
        ? metadata.image
        : [metadata.image];
    }
    // Extract additional images from markdown content
    const markdownImages = extractImageUrls(body);
    images = images.concat(markdownImages);

    if (images.length > 0) {
      setImageUrls(images);
    } else {
      const ytLinks = extractYoutubeLinks(body);
      if (ytLinks.length > 0) {
        setYoutubeLinks(ytLinks);
        setImageUrls([]);
      } else {
        setImageUrls([default_thumbnail]);
      }
    }
  }, [body, metadata, default_thumbnail]);

  function handleHeartClick() {
    setShowSlider(!showSlider);
  }

  async function handleVote() {
    const vote = await aioha.vote(
      post.author,
      post.permlink,
      sliderValue * 100
    );
    if (vote.success) {
      setVoted(true);
      setActiveVotes([...activeVotes, { voter: user }]);
      // Estimate the value and optimistically update payout
      if (estimateVoteValue) {
        try {
          const estimatedValue = await estimateVoteValue(sliderValue);
          setPayoutValue((prev) => prev + estimatedValue);
        } catch (e) {
          // fallback: do not update payout
        }
      }
    }
    handleHeartClick();
  }

  function viewPost() {
    // Enhanced debugging to catch problematic values
    console.log("PostCard viewPost called with:", {
      author,
      permlink: post.permlink,
      authorType: typeof author,
      permlinkType: typeof post.permlink,
    });

    if (typeof author !== "string" || typeof post.permlink !== "string") {
      console.error("PostCard: Invalid author or permlink types:", {
        author,
        permlink: post.permlink,
        authorType: typeof author,
        permlinkType: typeof post.permlink,
      });
      return;
    }

    // Check for object-like strings
    if (author.includes("[object") || post.permlink.includes("[object")) {
      console.error("Object-like string detected in navigation:", {
        author,
        permlink: post.permlink,
        authorType: typeof author,
        permlinkType: typeof post.permlink,
      });
      return;
    }

    // Use the correct URL format with proper encoding
    const url = `/post/${encodeURIComponent(author)}/${encodeURIComponent(
      post.permlink
    )}`;
    console.log("Navigating to URL:", url);
    router.push(url);
  }

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

  // Modified to only stop propagation
  function stopPropagation(e: React.MouseEvent) {
    e.stopPropagation();
  }

  // Create a proper handler for Swiper click events
  function handleSwiperClick(
    swiper: any,
    event: MouseEvent | TouchEvent | PointerEvent
  ) {
    // Stop the event from bubbling up to the card
    event.stopPropagation();
  }

  // New function to log image load errors
  function handleImageError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
    console.error("Failed to load image:", e.currentTarget.src, e);
  }

  // Extract summary for listView: remove image markdown, allow up to 3 lines, no char limit
  let summarySource = body;
  if (listView) {
    summarySource = summarySource.replace(/!\[[^\]]*\]\([^\)]*\)/g, ""); // Remove ![alt](url)
    summarySource = summarySource.replace(/!\[\]\([^\)]*\)/g, ""); // Remove ![](url)
    // Remove markdown links [text](url)
    summarySource = summarySource.replace(/\[[^\]]*\]\([^\)]*\)/g, "");
    // Remove raw URLs (http/https/ftp)
    summarySource = summarySource.replace(
      /https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/g,
      ""
    );
  }
  // For listView, do not slice to a char limit; let noOfLines handle truncation
  const summary = summarySource
    .replace(/[#*_`>\[\]()!\-]/g, "")
    .replace(/\n+/g, " ");

  // Deduplicate votes by voter (keep the last occurrence)
  const uniqueVotesMap = new Map();
  activeVotes.forEach((vote) => {
    uniqueVotesMap.set(vote.voter, vote);
  });
  const uniqueVotes = Array.from(uniqueVotesMap.values());

  // Helper to convert Asset or string to string
  function assetToString(val: string | { toString: () => string }): string {
    return typeof val === "string" ? val : val.toString();
  }
  // Helper to parse payout strings like "1.234 HBD"
  function parsePayout(
    val: string | { toString: () => string } | undefined
  ): number {
    if (!val) return 0;
    const str = assetToString(val);
    return parseFloat(str.replace(" HBD", "").replace(",", ""));
  }
  const authorPayout = parsePayout(post.total_payout_value);
  const curatorPayout = parsePayout(post.curator_payout_value);
  const payoutTooltip = `Author: $${authorPayout.toFixed(
    3
  )}\nCurators: $${curatorPayout.toFixed(3)}`;

  if (listView) {
    return (
      <Box
        borderBottom="1px solid rgb(46, 46, 46)"
        overflow="hidden"
        height="200px"
        display="flex"
        flexDirection="row"
        bg="background"
        borderRadius="md"
        boxShadow="sm"
      >
        {/* Thumbnail and icons */}
        <Flex
          direction="column"
          w="160px"
          h="100%"
          flexShrink={0}
          alignItems="center"
          justifyContent="flex-start"
          bg="muted"
          py={2}
        >
          <Box
            w="160px"
            h="160px"
            display="flex"
            alignItems="center"
            justifyContent="center"
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
                onError={handleImageError}
              />
            )}
          </Box>
          {/* Icons below thumbnail */}
          <Flex alignItems="center" gap={4} mt={2}>
            <Flex alignItems="center">
              <Icon
                as={LuArrowUpRight}
                onClick={handleHeartClick}
                cursor="pointer"
                color={voted ? "primary" : "gray.500"}
                opacity={voted ? 1 : 0.5}
                boxSize={5}
                _hover={{ bg: "gray.700", borderRadius: "full" }}
              />
              <VoteListPopover
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    ml={1}
                    p={1}
                    _hover={{ textDecoration: "underline" }}
                  >
                    {uniqueVotes.length}
                  </Button>
                }
                votes={activeVotes}
                post={post}
              />
            </Flex>
            <Popover
              placement="top"
              isOpen={isPayoutOpen}
              onClose={closePayout}
              closeOnBlur={true}
            >
              <PopoverTrigger>
                <span
                  style={{ cursor: "pointer" }}
                  onMouseDown={openPayout}
                  onMouseUp={closePayout}
                >
                  <Text fontWeight="bold" fontSize="sm">
                    ${payoutValue.toFixed(2)}
                  </Text>
                </span>
              </PopoverTrigger>
              <PopoverContent
                w="auto"
                bg="gray.800"
                color="white"
                borderRadius="md"
                boxShadow="lg"
                p={2}
              >
                <PopoverArrow />
                <PopoverBody>
                  {isPending ? (
                    <div>
                      <div>
                        <b>Pending</b>
                      </div>
                      <div>
                        {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}{" "}
                        until payout
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        Author: <b>${authorPayout.toFixed(3)}</b>
                      </div>
                      <div>
                        Curators: <b>${curatorPayout.toFixed(3)}</b>
                      </div>
                    </>
                  )}
                </PopoverBody>
              </PopoverContent>
            </Popover>
            <Flex alignItems="center">
              <Icon as={FaComment} />
              <Text ml={1} fontSize="sm">
                {post.children}
              </Text>
            </Flex>
          </Flex>
        </Flex>
        {/* Content */}
        <Flex direction="column" flex={1} p={4} justify="center" minW={0}>
          {/* Always show post date above title */}
          <Text fontSize="xs" color="gray.500" mb={1}>
            {postDate}
          </Text>
          <Link
            href={`/post/${encodeURIComponent(author)}/${encodeURIComponent(
              post.permlink,
            )}`}
            _hover={{ textDecoration: "underline" }}
          >
            <Text
              fontWeight="bold"
              fontSize="xl"
              mb={1}
              isTruncated={false}
              whiteSpace="normal"
              wordBreak="break-word"
            >
              {title}
            </Text>
          </Link>
          <Text
            fontSize="sm"
            color="gray.400"
            mb={2}
            noOfLines={listView ? 3 : 5}
          >
            {summary}
          </Text>
        </Flex>
      </Box>
    );
  }

  const postCardPulseGradient =
    "linear-gradient(90deg, var(--chakra-colors-primary, #38ff8e) 0%, var(--chakra-colors-accent, #00e676) 100%)";
  const postCardBoxShadowAccent =
    "0 0 0 0 var(--chakra-colors-accent, rgba(72, 255, 128, 0.7))";
  const postCardBoxShadowAccent10 =
    "0 0 0 10px var(--chakra-colors-accent, rgba(72, 255, 128, 0))";

  return (
    <>
      <style jsx global>{`
        .custom-swiper {
          --swiper-navigation-color: var(--chakra-colors-primary);
          --swiper-pagination-color: var(--chakra-colors-primary);
        }

        .custom-swiper .swiper-button-next,
        .custom-swiper .swiper-button-prev {
          transition: transform 0.18s cubic-bezier(0.4, 0.2, 0.2, 1);
        }
        .custom-swiper .swiper-button-next:active,
        .custom-swiper .swiper-button-prev:active {
          transform: scale(1.18);
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

        .pulse-green {
          animation: pulse-green 1.5s infinite;
          background: ${postCardPulseGradient};
          color: black;
          font-weight: bold;
          border: none;
        }
        @keyframes pulse-green {
          0% {
            box-shadow: ${postCardBoxShadowAccent};
          }
          70% {
            box-shadow: ${postCardBoxShadowAccent10};
          }
          100% {
            box-shadow: ${postCardBoxShadowAccent};
          }
        }
      `}</style>
      <Box
        position="relative"
        borderBottom="1px solid rgb(46, 46, 46)"
        overflow="hidden"
        height="100%"
        onClick={(e) => {
          console.log("PostCard container clicked", {
            author,
            permlink: post.permlink,
            target: e.target,
            currentTarget: e.currentTarget,
          });
          viewPost();
        }}
        cursor="pointer"
      >
        <Box
          py={4}
          pr={4}
          pl={8}
          display="flex"
          flexDirection="column"
          justifyContent="space-between"
          height="100%"
        >
          {/* Only show author info if not hidden */}
          {!hideAuthorInfo && (
            <Box mb={4}>
              <Flex alignItems="center" minWidth={0}>
                <Link
                  href={`/@${author}`}
                  onClick={stopPropagation}
                  display="flex"
                  alignItems="center"
                  _hover={{ textDecoration: "underline" }}
                >
                  <Avatar
                    size="sm"
                    name={author}
                    src={`https://images.hive.blog/u/${author}/avatar/sm`}
                  />
                  <Text
                    fontWeight="bold"
                    fontSize="3xl"
                    ml={2}
                    color="gray.200"
                    _hover={{ color: "white" }}
                    isTruncated
                  >
                    {author}
                  </Text>
                </Link>
              </Flex>
            </Box>
          )}
          <Flex justifyContent="flex-end">
            <Text fontSize="sm" color="gray.500">
              {postDate}
            </Text>
          </Flex>
          <Link
            href={`/post/${encodeURIComponent(author)}/${encodeURIComponent(
              post.permlink,
            )}`}
            onClick={stopPropagation}
            _hover={{ textDecoration: "underline" }}
          >
            <Text
              fontWeight="bold"
              fontSize="lg"
              textAlign="left"
              mb={2}
              display="flex"
              alignItems="center"
              whiteSpace="normal"
              wordBreak="break-word"
            >
              {title}
            </Text>
          </Link>

          <Box
            flex="1"
            display="flex"
            alignItems="flex-end"
            justifyContent="center"
            zIndex={2}
          >
            {imageUrls.length > 0 ? (
              <Swiper
                spaceBetween={10}
                slidesPerView={1}
                pagination={{ clickable: true }}
                navigation={true}
                modules={[Navigation, Pagination]}
                onSlideChange={handleSlideChange}
                onClick={handleSwiperClick} // Add this line to handle Swiper clicks
                className="custom-swiper"
              >
                {imageUrls.slice(0, visibleImages).map((url, index) => (
                  // Add the stopPropagation to each SwiperSlide instead
                  <SwiperSlide key={index} onClick={stopPropagation}>
                    <Box h="200px" w="100%" sx={{ userSelect: "none" }}>
                      <Image
                        src={url}
                        alt={title}
                        borderRadius="base"
                        objectFit="cover"
                        w="100%"
                        h="100%"
                        loading="lazy"
                        onError={handleImageError}
                      />
                    </Box>
                  </SwiperSlide>
                ))}
              </Swiper>
            ) : youtubeLinks.length > 0 ? (
              <Swiper
                spaceBetween={10}
                slidesPerView={1}
                pagination={{ clickable: true }}
                navigation={true}
                modules={[Navigation, Pagination]}
                className="custom-swiper"
              >
                {youtubeLinks.map((link, index) => (
                  <SwiperSlide key={index} onClick={stopPropagation}>
                    <Box h="200px" w="100%">
                      <iframe
                        src={link.url}
                        title={`YouTube video from ${link.domain}`}
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    </Box>
                  </SwiperSlide>
                ))}
              </Swiper>
            ) : (
              <Box h="200px" w="100%">
                <Image
                  src={default_thumbnail}
                  alt="default thumbnail"
                  borderRadius="base"
                  objectFit="cover"
                  w="100%"
                  h="100%"
                  loading="lazy"
                  onError={handleImageError}
                />
              </Box>
            )}
          </Box>

          <Box mt="auto">
            {showSlider ? (
              <Flex mt={4} alignItems="center" onClick={stopPropagation}>
                <Box width="100%" mr={4}>
                  <Slider
                    aria-label="slider-ex-1"
                    defaultValue={0}
                    min={0}
                    max={100}
                    value={sliderValue}
                    onChange={(val) => setSliderValue(val)}
                  >
                    <SliderTrack
                      bg="gray.700"
                      height="8px"
                      boxShadow="0 0 10px rgba(255, 255, 0, 0.8)"
                    >
                      <SliderFilledTrack bgGradient="linear(to-r, green.400, limegreen, red.400)" />
                    </SliderTrack>
                    <SliderThumb
                      boxSize="30px"
                      bg="transparent"
                      boxShadow={"none"}
                      _focus={{ boxShadow: "none" }}
                      zIndex={1}
                    >
                      <Image
                        src="/images/spitfire.png"
                        alt="thumb"
                        w="100%"
                        h="auto"
                        mr={2}
                        mb={1}
                      />
                    </SliderThumb>
                  </Slider>
                </Box>
                <Button
                  size="xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleVote();
                  }}
                  pl={5}
                  pr={5}
                  cursor="pointer"
                  className="pulse-green"
                >
                  Vote {sliderValue} %
                </Button>
                <Button
                  size="xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleHeartClick();
                  }}
                  ml={1}
                  cursor="pointer"
                >
                  X
                </Button>
              </Flex>
            ) : (
              <Flex
                mt={4}
                justifyContent="center"
                alignItems="center"
                onClick={stopPropagation}
                gap={6}
              >
                <Flex alignItems="center">
                  <Icon
                    as={LuArrowUpRight}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleHeartClick();
                    }}
                    cursor="pointer"
                    color={voted ? "primary" : "gray.500"}
                    opacity={voted ? 1 : 0.5}
                    boxSize={6}
                    _hover={{ bg: "gray.700", borderRadius: "full" }}
                  />
                  <VoteListPopover
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        ml={1}
                        p={1}
                        _hover={{ textDecoration: "underline" }}
                      >
                        {uniqueVotes.length}
                      </Button>
                    }
                    votes={activeVotes}
                    post={post}
                  />
                </Flex>
                <Popover
                  placement="top"
                  isOpen={isPayoutOpen}
                  onClose={closePayout}
                  closeOnBlur={true}
                >
                  <PopoverTrigger>
                    <span
                      style={{ cursor: "pointer" }}
                      onMouseDown={openPayout}
                      onMouseUp={closePayout}
                    >
                      <Text fontWeight="bold" fontSize="sm">
                        ${payoutValue.toFixed(2)}
                      </Text>
                    </span>
                  </PopoverTrigger>
                  <PopoverContent
                    w="auto"
                    bg="gray.800"
                    color="white"
                    borderRadius="md"
                    boxShadow="lg"
                    p={2}
                  >
                    <PopoverArrow />
                    <PopoverBody>
                      {isPending ? (
                        <div>
                          <div>
                            <b>Pending</b>
                          </div>
                          <div>
                            {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}{" "}
                            until payout
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            Author: <b>${authorPayout.toFixed(3)}</b>
                          </div>
                          <div>
                            Curators: <b>${curatorPayout.toFixed(3)}</b>
                          </div>
                        </>
                      )}
                    </PopoverBody>
                  </PopoverContent>
                </Popover>
                <Flex alignItems="center">
                  <Icon as={FaComment} />
                  <Text ml={2} fontSize="sm">
                    {post.children}
                  </Text>
                </Flex>
              </Flex>
            )}
          </Box>
        </Box>
      </Box>
    </>
  );
}
