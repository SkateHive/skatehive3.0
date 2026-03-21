"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  Box,
  Container,
  Text,
  Spinner,
  Center,
  Button,
  VStack,
  HStack,
  Image,
  Link as ChakraLink,
  Flex,
  Icon,
  Avatar,
  IconButton,
  Tooltip,
  Heading,
  Badge,
} from "@chakra-ui/react";
import { Discussion } from "@hiveio/dhive";
import HiveClient from "@/lib/hive/hiveclient";
import { extractImageUrls } from "@/lib/utils/extractImageUrls";
import { parsePayout } from "@/lib/utils/postUtils";
import { getPostDate } from "@/lib/utils/GetPostDate";
import NextLink from "next/link";
import {
  FaYoutube,
  FaVideo,
  FaPlay,
  FaComment,
  FaArrowUp,
  FaStepForward,
  FaStepBackward,
  FaRandom,
  FaExternalLinkAlt,
  FaRedo,
} from "react-icons/fa";
import { SiIpfs, SiOdysee } from "react-icons/si";
import { trackLandingPageVisit } from "@/lib/analytics/events";
import dynamic from "next/dynamic";
import { useComments } from "@/hooks/useComments";
import type { IconType } from "react-icons";

const VideoRenderer = dynamic(
  () => import("@/components/layout/VideoRenderer"),
  { ssr: false },
);
const HiveMarkdown = dynamic(() => import("@/components/shared/HiveMarkdown"), {
  ssr: false,
});

// ─── Types ───────────────────────────────────────────────

type VideoPlatform = "youtube" | "3speak" | "ipfs" | "odysee" | "other";

interface VideoInfo {
  platform: VideoPlatform;
  embedUrl: string | null;
}

interface PlatformConfig {
  label: string;
  color: string;
  icon: IconType;
}

interface PostMeta {
  platform: VideoPlatform;
  thumbnail: string;
  cleanAuthor: string;
}

// ─── Video detection ─────────────────────────────────────

const VIDEO_PATTERNS: {
  platform: VideoPlatform;
  test: RegExp;
  extract?: RegExp;
}[] = [
  {
    platform: "youtube",
    test: /youtu\.?be/i,
    extract:
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  },
  {
    platform: "3speak",
    test: /3speak\.tv/i,
    extract: /3speak\.tv\/watch\?v=([a-zA-Z0-9._-]+\/[a-zA-Z0-9_-]+)/,
  },
  {
    platform: "odysee",
    test: /odysee\.com/i,
    extract: /https?:\/\/odysee\.com\/([^\s"'<>]+)/,
  },
  {
    platform: "ipfs",
    test: /<iframe[^>]*src=["'][^"']*ipfs/i,
    extract: /<iframe[^>]*src=["'](https?:\/\/[^"']*ipfs[^"']*)/i,
  },
  {
    platform: "ipfs",
    test: /https?:\/\/[^\s"'<>]+\.(mp4|webm|mov|avi)(\?[^\s"'<>]*)?/i,
    extract: /(https?:\/\/[^\s"'<>]+\.(mp4|webm|mov)(\?[^\s"'<>]*)?)/i,
  },
  {
    platform: "other",
    test: /<iframe[^>]*src=["']https?:\/\/(www\.)?(youtube|3speak|odysee|rumble)/i,
  },
  { platform: "other", test: /<video[\s>]/i },
];

function detectPlatform(body: string): VideoPlatform {
  if (!body) return "other";
  for (const p of VIDEO_PATTERNS) {
    if (p.test.test(body)) return p.platform;
  }
  return "other";
}

function hasVideoContent(body: string): boolean {
  return !!body && VIDEO_PATTERNS.some((p) => p.test.test(body));
}

function extractVideoInfo(body: string): VideoInfo {
  if (!body) return { platform: "other", embedUrl: null };
  for (const pattern of VIDEO_PATTERNS) {
    if (!pattern.extract || !pattern.test.test(body)) continue;
    const match = body.match(pattern.extract);
    if (!match) continue;
    switch (pattern.platform) {
      case "youtube":
        return {
          platform: "youtube",
          embedUrl: `https://www.youtube.com/embed/${match[1]}?autoplay=1`,
        };
      case "3speak":
        return {
          platform: "3speak",
          embedUrl: `https://play.3speak.tv/watch?v=${match[1]}&mode=iframe&layout=desktop`,
        };
      case "odysee": {
        const url = `https://odysee.com/${match[1]}`;
        return {
          platform: "odysee",
          embedUrl: url.includes("/$/embed/")
            ? url
            : url.replace("odysee.com/", "odysee.com/$/embed/"),
        };
      }
      case "ipfs":
        return { platform: "ipfs", embedUrl: match[1] || match[0] };
    }
  }
  return { platform: "other", embedUrl: null };
}

function getYouTubeThumbnail(body: string): string | null {
  const match = body.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  );
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
}

function computePostMeta(post: Discussion): PostMeta {
  const platform = detectPlatform(post.body);
  const ytThumb =
    platform === "youtube" ? getYouTubeThumbnail(post.body) : null;
  const images = extractImageUrls(post.body);
  return {
    platform,
    thumbnail: ytThumb || images[0] || "/ogimage.png",
    cleanAuthor: post.author.startsWith("@")
      ? post.author.slice(1)
      : post.author,
  };
}

const PLATFORM_CONFIG: Record<VideoPlatform, PlatformConfig> = {
  youtube: { label: "YouTube", color: "red.500", icon: FaYoutube },
  "3speak": { label: "3Speak", color: "purple.400", icon: FaVideo },
  odysee: { label: "Odysee", color: "pink.400", icon: SiOdysee },
  ipfs: { label: "IPFS", color: "cyan.400", icon: SiIpfs },
  other: { label: "Video", color: "primary", icon: FaVideo },
};

const FILTERS: { key: VideoPlatform | "all"; label: string }[] = [
  { key: "all", label: "all" },
  { key: "youtube", label: "youtube" },
  { key: "3speak", label: "3speak" },
  { key: "ipfs", label: "ipfs" },
  { key: "odysee", label: "odysee" },
];

const POSTS_PER_PAGE = 20;
const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 8;

// ─── Playlist Item ───────────────────────────────────────

const PlaylistItem = React.memo(function PlaylistItem({
  post,
  meta,
  isActive,
  index,
  onClick,
}: {
  post: Discussion;
  meta: PostMeta;
  isActive: boolean;
  index: number;
  onClick: () => void;
}) {
  const config = PLATFORM_CONFIG[meta.platform];
  return (
    <HStack
      spacing={3}
      p={2}
      py={3}
      cursor="pointer"
      onClick={onClick}
      bg={isActive ? "whiteAlpha.100" : "transparent"}
      borderLeft="3px solid"
      borderColor={isActive ? "primary" : "transparent"}
      _hover={{ bg: "whiteAlpha.50" }}
      transition="all 0.15s"
      borderRadius="sm"
    >
      <Text
        fontFamily="mono"
        fontSize="xs"
        color="gray.600"
        w="20px"
        textAlign="center"
        flexShrink={0}
      >
        {isActive ? (
          <Icon as={FaPlay} boxSize={2.5} color="primary" />
        ) : (
          index + 1
        )}
      </Text>
      <Box
        position="relative"
        w="120px"
        h="68px"
        flexShrink={0}
        borderRadius="sm"
        overflow="hidden"
        bg="background"
      >
        <Image
          src={meta.thumbnail}
          alt=""
          w="100%"
          h="100%"
          objectFit="cover"
        />
        <Icon
          as={config.icon}
          position="absolute"
          bottom={1}
          right={1}
          boxSize={3}
          color={config.color}
        />
      </Box>
      <VStack align="start" spacing={0.5} flex={1} minW={0}>
        <Text
          fontFamily="mono"
          fontSize="xs"
          color={isActive ? "primary" : "text"}
          noOfLines={2}
          lineHeight="1.4"
          fontWeight={isActive ? "bold" : "normal"}
        >
          {post.title || "Untitled"}
        </Text>
        <HStack spacing={1}>
          <Avatar
            size="2xs"
            name={meta.cleanAuthor}
            src={`https://images.hive.blog/u/${meta.cleanAuthor}/avatar/small`}
          />
          <Text fontFamily="mono" fontSize="2xs" color="gray.500">
            {meta.cleanAuthor}
          </Text>
          <Text fontFamily="mono" fontSize="2xs" color="gray.700">
            · {getPostDate(post.created)}
          </Text>
        </HStack>
      </VStack>
    </HStack>
  );
});

// ─── Comments ────────────────────────────────────────────

function VideoComments({
  author,
  permlink,
}: {
  author: string;
  permlink: string;
}) {
  const { comments, isLoading } = useComments(author, permlink, false);
  return (
    <Box px={4} pb={4} borderTop="1px solid" borderColor="whiteAlpha.100">
      <HStack py={3} spacing={2}>
        <Text fontFamily="mono" fontSize="xs" fontWeight="bold" color="text">
          comments
        </Text>
        <Text fontFamily="mono" fontSize="2xs" color="gray.500">
          {isLoading ? "..." : comments.length}
        </Text>
      </HStack>
      {isLoading ? (
        <Center py={4}>
          <Spinner size="sm" color="primary" />
        </Center>
      ) : comments.length === 0 ? (
        <Text fontFamily="mono" fontSize="xs" color="gray.600" py={2}>
          no comments yet — be the first on the full post page
        </Text>
      ) : (
        <VStack align="stretch" spacing={0} maxH="400px" overflowY="auto">
          {comments.map((c) => (
            <CommentItem key={`${c.author}/${c.permlink}`} comment={c} />
          ))}
        </VStack>
      )}
    </Box>
  );
}

function CommentItem({ comment }: { comment: Discussion }) {
  const author = comment.author;
  const payout = parsePayout(comment.pending_payout_value);
  return (
    <HStack
      align="start"
      spacing={3}
      py={3}
      borderBottom="1px solid"
      borderColor="whiteAlpha.50"
    >
      <ChakraLink as={NextLink} href={`/user/${author}`} flexShrink={0}>
        <Avatar
          size="sm"
          name={author}
          src={`https://images.hive.blog/u/${author}/avatar/small`}
        />
      </ChakraLink>
      <Box flex={1} minW={0}>
        <HStack spacing={2} mb={1}>
          <ChakraLink
            as={NextLink}
            href={`/user/${author}`}
            _hover={{ textDecoration: "none" }}
          >
            <Text
              fontFamily="mono"
              fontSize="xs"
              fontWeight="bold"
              color="gray.300"
              _hover={{ color: "primary" }}
            >
              @{author}
            </Text>
          </ChakraLink>
          <Text fontFamily="mono" fontSize="2xs" color="gray.600">
            {getPostDate(comment.created)}
          </Text>
          {payout > 0 && (
            <Text fontFamily="mono" fontSize="2xs" color="primary">
              ${payout.toFixed(2)}
            </Text>
          )}
        </HStack>
        <Box
          fontFamily="mono"
          fontSize="xs"
          color="gray.400"
          lineHeight="1.5"
          sx={{
            "& p": { mb: 1 },
            "& img": { maxH: "200px", borderRadius: "sm", my: 1 },
            "& a": { color: "primary" },
          }}
        >
          <HiveMarkdown markdown={comment.body} rawIframes />
        </Box>
        <HStack spacing={3} mt={1}>
          <HStack spacing={1}>
            <Icon as={FaArrowUp} boxSize={2.5} color="gray.600" />
            <Text fontFamily="mono" fontSize="2xs" color="gray.600">
              {comment.active_votes?.length || 0}
            </Text>
          </HStack>
          {comment.children > 0 && (
            <HStack spacing={1}>
              <Icon as={FaComment} boxSize={2.5} color="gray.600" />
              <Text fontFamily="mono" fontSize="2xs" color="gray.600">
                {comment.children}
              </Text>
            </HStack>
          )}
        </HStack>
      </Box>
    </HStack>
  );
}

// ─── Countdown Overlay ───────────────────────────────────

const AUTOPLAY_DELAY = 15; // seconds

function CountdownOverlay({
  seconds,
  total,
  nextTitle,
  onCancel,
  onSkip,
}: {
  seconds: number;
  total: number;
  nextTitle: string;
  onCancel: () => void;
  onSkip: () => void;
}) {
  const progress = ((total - seconds) / total) * 100;
  const circumference = 2 * Math.PI * 28;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <Flex
      position="absolute"
      inset={0}
      bg="blackAlpha.800"
      zIndex={10}
      align="center"
      justify="center"
      flexDirection="column"
      gap={4}
    >
      {/* Circular progress */}
      <Box position="relative" cursor="pointer" onClick={onSkip}>
        <svg width="72" height="72" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
          <circle
            cx="32" cy="32" r="28" fill="none" stroke="#a3e635" strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 32 32)"
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <Text
          position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)"
          fontFamily="mono" fontSize="lg" fontWeight="bold" color="white"
        >
          {seconds}
        </Text>
      </Box>

      <VStack spacing={1}>
        <Text fontFamily="mono" fontSize="2xs" color="gray.400">up next</Text>
        <Text fontFamily="mono" fontSize="xs" color="white" noOfLines={1} maxW="300px" textAlign="center">
          {nextTitle}
        </Text>
      </VStack>

      <HStack spacing={3}>
        <Button size="xs" fontFamily="mono" fontSize="2xs" variant="outline"
          borderColor="whiteAlpha.300" color="gray.300" onClick={onCancel}
          _hover={{ borderColor: "white", color: "white" }}>
          cancel
        </Button>
        <Button size="xs" fontFamily="mono" fontSize="2xs" bg="primary" color="background"
          onClick={onSkip} _hover={{ opacity: 0.9 }}>
          play now
        </Button>
      </HStack>
    </Flex>
  );
}

// ─── Main Player ─────────────────────────────────────────

function MainPlayer({ videoInfo }: { videoInfo: VideoInfo }) {
  if (!videoInfo.embedUrl) {
    return (
      <Center w="100%" h="100%" bg="background">
        <Text fontFamily="mono" fontSize="sm" color="gray.500">
          video format not supported
        </Text>
      </Center>
    );
  }
  if (
    videoInfo.platform === "ipfs" ||
    /\.(mp4|webm|mov)(\?|$)/i.test(videoInfo.embedUrl)
  ) {
    return <VideoRenderer src={videoInfo.embedUrl} disableAutoplay={false} />;
  }
  return (
    <iframe
      src={videoInfo.embedUrl}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        border: 0,
      }}
      allowFullScreen
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    />
  );
}

const cinemaFrameStyles = {
  "& > div": {
    position: "absolute !important",
    inset: "0 !important",
    minWidth: "100% !important",
    paddingTop: "0 !important",
    display: "flex !important",
    alignItems: "center !important",
    justifyContent: "center !important",
  },
  "& picture": {
    position: "absolute !important",
    inset: 0,
    display: "flex !important",
    alignItems: "center !important",
    justifyContent: "center !important",
  },
  "& video": {
    objectFit: "contain !important",
    width: "100% !important",
    height: "100% !important",
    maxHeight: "100% !important",
    marginBottom: "0 !important",
    position: "absolute !important",
    inset: 0,
  },
} as Record<string, any>;

// ─── Main Component ──────────────────────────────────────

export default function VideosContent() {
  const [posts, setPosts] = useState<Discussion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [filter, setFilter] = useState<VideoPlatform | "all">("all");
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const playlistRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<{ author?: string; permlink?: string }>({});

  useEffect(() => {
    trackLandingPageVisit({ page: "videos" });
    loadPosts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPosts = useCallback(async (initial = false) => {
    if (initial) setIsLoading(true);
    else setIsLoadingMore(true);
    try {
      const collected: Discussion[] = [];
      let { author: cursorAuthor, permlink: cursorPermlink } = initial
        ? {}
        : cursorRef.current;
      for (
        let attempt = 0;
        attempt < MAX_ATTEMPTS && collected.length < POSTS_PER_PAGE;
        attempt++
      ) {
        const result = await HiveClient.call("bridge", "get_ranked_posts", {
          sort: "created",
          tag: "hive-173115",
          limit: BATCH_SIZE,
          start_author: cursorAuthor,
          start_permlink: cursorPermlink,
        });
        if (!result || result.length === 0) {
          setHasMore(false);
          break;
        }
        const fresh = (cursorAuthor ? result.slice(1) : result) as Discussion[];
        if (fresh.length === 0) {
          setHasMore(false);
          break;
        }
        collected.push(
          ...fresh.filter((p: Discussion) => hasVideoContent(p.body)),
        );
        const last = result[result.length - 1];
        cursorAuthor = last.author;
        cursorPermlink = last.permlink;
        if (result.length < BATCH_SIZE) {
          setHasMore(false);
          break;
        }
      }
      if (collected.length > 0) {
        const toAdd = collected.slice(0, POSTS_PER_PAGE);
        setPosts((prev) => {
          const next = initial ? toAdd : [...prev, ...toAdd];
          const seen = new Set<string>();
          return next.filter((p) => {
            const key = `${p.author}/${p.permlink}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        });
        const lastAdded = toAdd[toAdd.length - 1];
        cursorRef.current = {
          author: lastAdded.author,
          permlink: lastAdded.permlink,
        };
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error loading video posts:", error);
      setHasMore(false);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  const postMetaMap = useMemo(() => {
    const map = new Map<string, PostMeta>();
    for (const post of posts)
      map.set(`${post.author}/${post.permlink}`, computePostMeta(post));
    return map;
  }, [posts]);

  const filteredPosts = useMemo(() => {
    if (filter === "all") return posts;
    return posts.filter(
      (p) => postMetaMap.get(`${p.author}/${p.permlink}`)?.platform === filter,
    );
  }, [posts, filter, postMetaMap]);

  const activePost = filteredPosts[activeIndex] || null;
  const activeVideoInfo = useMemo(
    () => (activePost ? extractVideoInfo(activePost.body) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activePost?.author, activePost?.permlink],
  );

  const cleanAuthor = activePost?.author?.startsWith("@")
    ? activePost.author.slice(1)
    : activePost?.author || "";
  const payout = activePost ? parsePayout(activePost.pending_payout_value) : 0;

  const goTo = useCallback(
    (index: number) => {
      setActiveIndex((prev) => {
        if (index < 0 || index >= filteredPosts.length) return prev;
        setTimeout(() => {
          document
            .getElementById(`playlist-item-${index}`)
            ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 50);
        return index;
      });
    },
    [filteredPosts.length],
  );

  const cancelCountdown = useCallback(() => {
    setCountdown(null);
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  const goNext = useCallback(() => {
    cancelCountdown();
    setActiveIndex((prev) => {
      if (shuffle && filteredPosts.length > 1) {
        let next;
        do {
          next = Math.floor(Math.random() * filteredPosts.length);
        } while (next === prev);
        return next;
      }
      return prev < filteredPosts.length - 1 ? prev + 1 : 0;
    });
  }, [filteredPosts.length, shuffle, cancelCountdown]);

  const goPrev = useCallback(() => {
    cancelCountdown();
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredPosts.length - 1));
  }, [filteredPosts.length, cancelCountdown]);

  // Start autoplay countdown
  const startCountdown = useCallback(() => {
    if (!autoPlay || filteredPosts.length <= 1) return;
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(AUTOPLAY_DELAY);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
          goNext();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [autoPlay, filteredPosts.length, goNext]);

  const skipCountdown = useCallback(() => {
    cancelCountdown();
    goNext();
  }, [cancelCountdown, goNext]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  // Cancel countdown when user manually selects a video
  const goToAndCancel = useCallback((index: number) => {
    cancelCountdown();
    goTo(index);
  }, [cancelCountdown, goTo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "n" || e.key === "N") goNext();
      if (e.key === "p" || e.key === "P") goPrev();
      if (e.key === "s" || e.key === "S") setShuffle((s) => !s);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  useEffect(() => {
    if (activeIndex >= filteredPosts.length - 3 && hasMore && !isLoadingMore)
      loadPosts(false);
  }, [activeIndex, filteredPosts.length, hasMore, isLoadingMore, loadPosts]);

  const videosHeader = (
    <VStack spacing={3} mb={6} mt={4} align={{ base: "center", md: "start" }}>
      <HStack spacing={3} align="center">
        <Icon as={FaVideo} boxSize={{ base: 6, md: 8 }} color="primary" />
        <Heading
          as="h1"
          className="fretqwik-title"
          fontSize={{ base: "4xl", md: "6xl" }}
          fontWeight="extrabold"
          color="primary"
          letterSpacing="wider"
        >
          Videos
        </Heading>
      </HStack>
      <Text fontSize={{ base: "sm", md: "md" }} color="gray.400" maxW="2xl">
        Community skate clips from the Hive blockchain. YouTube, 3Speak, IPFS and more.
      </Text>
      {posts.length > 0 && (
        <Badge colorScheme="green" fontSize="sm" px={3} py={1}>
          {posts.length} Videos
        </Badge>
      )}
    </VStack>
  );

  if (isLoading) {
    return (
      <Box minH="100vh">
        <Container maxW="container.xl" px={{ base: 2, md: 4 }}>
          {videosHeader}
          <Center py={20}>
            <VStack spacing={3}>
              <Spinner size="lg" color="primary" />
              <Text fontFamily="mono" fontSize="xs" color="gray.500">
                loading videos...
              </Text>
            </VStack>
          </Center>
        </Container>
      </Box>
    );
  }

  if (posts.length === 0) {
    return (
      <Box minH="100vh">
        <Container maxW="container.xl" px={{ base: 2, md: 4 }}>
          {videosHeader}
          <Center py={20}>
            <VStack spacing={2}>
              <Icon as={FaVideo} boxSize={8} color="gray.600" />
              <Text fontFamily="mono" fontSize="sm" color="gray.500">
                no skate videos found yet
              </Text>
            </VStack>
          </Center>
        </Container>
      </Box>
    );
  }

  return (
    <Box minH="100vh">
      <Container maxW="container.xl" px={{ base: 2, md: 4 }}>
        {videosHeader}
        <Flex
          direction={{ base: "column", lg: "row" }}
          gap={0}
          border="1px solid"
          borderColor="whiteAlpha.100"
          borderRadius="md"
          overflow="hidden"
          bg="background"
        >
          {/* Player Column */}
          <Box
            flex={1}
            minW={0}
            overflowY={{ base: "visible", lg: "auto" }}
            maxH={{ base: "none", lg: "calc(100vh - 80px)" }}
          >
            <Box
              w="100%"
              sx={{ aspectRatio: "16 / 9" }}
              bg="background"
              position="relative"
              overflow="hidden"
              css={cinemaFrameStyles}
            >
              {activePost && activeVideoInfo && (
                <MainPlayer videoInfo={activeVideoInfo} />
              )}
              {countdown !== null && (
                <CountdownOverlay
                  seconds={countdown}
                  total={AUTOPLAY_DELAY}
                  nextTitle={
                    filteredPosts[
                      shuffle
                        ? Math.floor(Math.random() * filteredPosts.length)
                        : activeIndex < filteredPosts.length - 1
                          ? activeIndex + 1
                          : 0
                    ]?.title || "Next video"
                  }
                  onCancel={cancelCountdown}
                  onSkip={skipCountdown}
                />
              )}
            </Box>

            <Box
              p={4}
              bg="background"
              borderTop="1px solid"
              borderColor="whiteAlpha.100"
            >
              <HStack spacing={1} mb={3}>
                <Tooltip label="Previous (P)" hasArrow>
                  <IconButton
                    aria-label="Previous"
                    icon={<FaStepBackward />}
                    size="xs"
                    variant="ghost"
                    color="gray.400"
                    onClick={goPrev}
                    _hover={{ color: "primary" }}
                  />
                </Tooltip>
                <Tooltip label="Next (N)" hasArrow>
                  <IconButton
                    aria-label="Next"
                    icon={<FaStepForward />}
                    size="xs"
                    variant="ghost"
                    color="gray.400"
                    onClick={goNext}
                    _hover={{ color: "primary" }}
                  />
                </Tooltip>
                <Tooltip
                  label={`Shuffle ${shuffle ? "on" : "off"} (S)`}
                  hasArrow
                >
                  <IconButton
                    aria-label="Shuffle"
                    icon={<FaRandom />}
                    size="xs"
                    variant="ghost"
                    color={shuffle ? "primary" : "gray.400"}
                    onClick={() => setShuffle((s) => !s)}
                    _hover={{ color: "primary" }}
                  />
                </Tooltip>
                <Tooltip
                  label={`Auto-play ${autoPlay ? "on" : "off"}`}
                  hasArrow
                >
                  <IconButton
                    aria-label="Auto-play"
                    icon={<FaRedo />}
                    size="xs"
                    variant="ghost"
                    color={autoPlay ? "primary" : "gray.400"}
                    onClick={() => { setAutoPlay((a) => !a); cancelCountdown(); }}
                    _hover={{ color: "primary" }}
                  />
                </Tooltip>
                {autoPlay && countdown === null && (
                  <Tooltip label="Start countdown to next video" hasArrow>
                    <IconButton
                      aria-label="Start countdown"
                      icon={<FaStepForward />}
                      size="xs"
                      variant="ghost"
                      color="gray.500"
                      onClick={startCountdown}
                      _hover={{ color: "primary" }}
                    />
                  </Tooltip>
                )}
                <Box flex={1} />
                {activeVideoInfo && (
                  <HStack
                    spacing={1}
                    px={2}
                    py={0.5}
                    bg="whiteAlpha.50"
                    borderRadius="sm"
                  >
                    <Icon
                      as={PLATFORM_CONFIG[activeVideoInfo.platform].icon}
                      boxSize={3}
                      color={PLATFORM_CONFIG[activeVideoInfo.platform].color}
                    />
                    <Text fontFamily="mono" fontSize="2xs" color="gray.400">
                      {PLATFORM_CONFIG[activeVideoInfo.platform].label}
                    </Text>
                  </HStack>
                )}
                <Text fontFamily="mono" fontSize="2xs" color="gray.600">
                  {activeIndex + 1} / {filteredPosts.length}
                </Text>
              </HStack>

              <Text
                fontFamily="mono"
                fontSize="sm"
                fontWeight="bold"
                color="text"
                mb={2}
                noOfLines={2}
              >
                {activePost?.title || "Untitled"}
              </Text>

              <HStack justify="space-between" align="center">
                <ChakraLink
                  as={NextLink}
                  href={`/user/${cleanAuthor}`}
                  _hover={{ textDecoration: "none" }}
                >
                  <HStack spacing={2}>
                    <Avatar
                      size="xs"
                      name={cleanAuthor}
                      src={`https://images.hive.blog/u/${cleanAuthor}/avatar/small`}
                    />
                    <Text
                      fontFamily="mono"
                      fontSize="xs"
                      color="gray.400"
                      _hover={{ color: "primary" }}
                    >
                      @{cleanAuthor}
                    </Text>
                    {activePost && (
                      <Text fontFamily="mono" fontSize="2xs" color="gray.600">
                        {getPostDate(activePost.created)}
                      </Text>
                    )}
                  </HStack>
                </ChakraLink>
                <HStack spacing={4}>
                  <HStack spacing={1}>
                    <Icon as={FaArrowUp} boxSize={3} color="gray.500" />
                    <Text fontFamily="mono" fontSize="xs" color="gray.500">
                      {activePost?.active_votes?.length || 0}
                    </Text>
                  </HStack>
                  <HStack spacing={1}>
                    <Icon as={FaComment} boxSize={3} color="gray.500" />
                    <Text fontFamily="mono" fontSize="xs" color="gray.500">
                      {activePost?.children || 0}
                    </Text>
                  </HStack>
                  {payout > 0 && (
                    <Text
                      fontFamily="mono"
                      fontSize="xs"
                      color="primary"
                      fontWeight="bold"
                    >
                      ${payout.toFixed(2)}
                    </Text>
                  )}
                  <ChakraLink
                    as={NextLink}
                    href={`/post/${cleanAuthor}/${activePost?.permlink}`}
                    _hover={{ textDecoration: "none" }}
                  >
                    <Tooltip label="Open full post" hasArrow>
                      <span>
                        <Icon
                          as={FaExternalLinkAlt}
                          boxSize={3}
                          color="gray.500"
                          _hover={{ color: "primary" }}
                          cursor="pointer"
                        />
                      </span>
                    </Tooltip>
                  </ChakraLink>
                </HStack>
              </HStack>
            </Box>

            {activePost && (
              <VideoComments
                author={activePost.author}
                permlink={activePost.permlink}
              />
            )}
          </Box>

          {/* Playlist Sidebar */}
          <Box
            w={{ base: "100%", lg: "420px" }}
            flexShrink={0}
            bg="background"
            borderLeft={{ base: "none", lg: "1px solid" }}
            borderTop={{ base: "1px solid", lg: "none" }}
            borderColor="whiteAlpha.100"
            display="flex"
            flexDirection="column"
            maxH={{ base: "50vh", lg: "calc(100vh - 120px)" }}
            overflowY={{ base: "auto", lg: "hidden" }}
          >
            <Box
              px={4}
              py={3}
              borderBottom="1px solid"
              borderColor="whiteAlpha.100"
            >
              <HStack justify="space-between" align="center" mb={2}>
                <Text
                  fontFamily="mono"
                  fontSize="sm"
                  fontWeight="bold"
                  color="text"
                >
                  community videos
                </Text>
                <Text fontFamily="mono" fontSize="xs" color="gray.500">
                  {filteredPosts.length} videos
                </Text>
              </HStack>
              <HStack spacing={1} flexWrap="wrap">
                {FILTERS.map((f) => (
                  <Button
                    key={f.key}
                    size="xs"
                    h="26px"
                    fontFamily="mono"
                    fontSize="xs"
                    variant="ghost"
                    color={filter === f.key ? "primary" : "gray.500"}
                    bg={filter === f.key ? "whiteAlpha.100" : "transparent"}
                    borderRadius="sm"
                    onClick={() => {
                      setFilter(f.key);
                      setActiveIndex(0);
                    }}
                    _hover={{ color: "primary", bg: "whiteAlpha.50" }}
                    px={3}
                  >
                    {f.label}
                  </Button>
                ))}
              </HStack>
            </Box>

            <Box ref={playlistRef} flex={1} overflowY="auto" py={1}>
              {filteredPosts.map((post, i) => (
                <Box
                  key={`${post.author}/${post.permlink}`}
                  id={`playlist-item-${i}`}
                >
                  <PlaylistItem
                    post={post}
                    meta={postMetaMap.get(`${post.author}/${post.permlink}`)!}
                    isActive={i === activeIndex}
                    index={i}
                    onClick={() => goToAndCancel(i)}
                  />
                </Box>
              ))}
              {hasMore && (
                <Center py={3}>
                  {isLoadingMore ? (
                    <Spinner size="sm" color="primary" />
                  ) : (
                    <Button
                      size="xs"
                      fontFamily="mono"
                      fontSize="2xs"
                      variant="ghost"
                      color="gray.500"
                      onClick={() => loadPosts(false)}
                      _hover={{ color: "primary" }}
                    >
                      load more
                    </Button>
                  )}
                </Center>
              )}
            </Box>
          </Box>
        </Flex>
      </Container>
    </Box>
  );
}
