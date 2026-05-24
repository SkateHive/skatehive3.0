"use client";
import { useState, useRef, useMemo, useEffect, lazy, Suspense } from "react";
import {
  Box,
  Flex,
  VStack,
  Text,
  Heading,
  Badge,
  Image,
} from "@chakra-ui/react";
import HTMLFlipBook from "react-pageflip";
import { Discussion } from "@hiveio/dhive";
import { getPayoutValue, findPosts } from "@/lib/hive/client-functions";
import { filterAutoComments } from "@/lib/utils/postUtils";
const EnhancedMarkdownRenderer = lazy(() =>
  import("@/components/markdown/EnhancedMarkdownRenderer").then((module) => ({
    default: module.EnhancedMarkdownRenderer,
  }))
);
import LoadingComponent from "../homepage/loadingComponent";
import MatrixOverlay from "@/components/graphics/MatrixOverlay";
import { useTheme } from "@/app/themeProvider";
import SkateErrorBoundary from "./SkateErrorBoundary";
import ContentErrorWatcher from "./ContentErrorWatcher";
import { useMagazineTweaks } from "@/hooks/useMagazineTweaks";

function useMagazinePosts(
  query: string,
  tag: { tag: string; limit: number }[]
) {
  const [posts, setPosts] = useState<Discussion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);

  const tagString = JSON.stringify(tag);

  useEffect(() => {
    if (!query || !tag || tag.length === 0) {
      setIsLoading(false);
      setError(null);
      return;
    }

    const hasValidTag = tag.every(
      (t) =>
        t &&
        typeof t.tag === "string" &&
        t.tag.length > 0 &&
        typeof t.limit === "number"
    );

    if (!hasValidTag) {
      console.error("Magazine error: Invalid parameters", { query, tag });
      setError("Invalid parameters");
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);
    setPosts([]);

    findPosts(query, tag)
      .then((data) => {
        if (isMounted) {
          const postsArray = Array.isArray(data) ? data : data ? [data] : [];
          setPosts(postsArray);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Magazine error:", err.message || err);
          setError(err.message || "Error fetching posts");
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tagString]);

  return { posts, error, isLoading };
}

const backgroundGradient = {
  minHeight: "100%",
  width: "100%",
  p: 0,
  m: 0,
  overflow: "hidden",
};

const pageStyles = (theme: any) => ({
  background: `linear-gradient(135deg,${theme.colors.background} 80%,${theme.colors.muted} 100%)`,
  borderRadius: "16px",
  boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.15)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  padding: "32px 28px 48px 28px",
  color: theme.colors.text,
  overflow: "auto",
  position: "relative",
  minHeight: 400,
  zIndex: 1,
  border: `1px solid ${theme.colors.border || "#e0e7ef"}`,
});

const retroBoxShadow = (theme: any) =>
  `0 0 0 2px ${theme.colors.text}, 0 0 8px ${theme.colors.primary}`;

const backCoverStyles = (theme: any) => ({
  ...pageStyles(theme),
  background: `linear-gradient(120deg, ${theme.colors.primary} 60%, ${theme.colors.accent} 100%)`,
  color: theme.colors.text,
  justifyContent: "center",
  alignItems: "center",
  backgroundImage:
    "url(https://media1.giphy.com/media/9ZsHm0z5QwSYpV7g01/giphy.gif?cid=6c09b952uxaerotyqa9vct5pkiwvar6l6knjgsctieeg0sh1&ep=v1_gifs_search&rid=giphy.gif&ct=g)",
  backgroundSize: "cover",
  boxShadow: "0 8px 32px 0 rgba(179,18,23,0.25)",
});

export interface MagazineProps {
  posts?: Discussion[];
  isLoading?: boolean;
  error?: string | null;
  // For community magazine, still accept tag/query
  tag?: { tag: string; limit: number }[];
  query?: string;
  // Allow external control of query
  onQueryChange?: (query: string) => void;
  allowQuerySwitch?: boolean;
  // Custom magazine cover for user profiles
  zineCover?: string;
  // User profile data for personalized magazine
  hiveUsername?: string;
  userProfileImage?: string;
  displayName?: string;
  userLocation?: string;
}

export default function Magazine(props: MagazineProps) {
  const { theme } = useTheme();
  const flipBookRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { tweaks } = useMagazineTweaks();

  // Available query types for Bridge API
  const [currentQuery, setCurrentQuery] = useState(props.query || "created");

  // Update current query when props change
  useEffect(() => {
    if (props.query && props.query !== currentQuery) {
      setCurrentQuery(props.query);
    }
  }, [props.query, currentQuery]);

  // Only use the hook to fetch posts if tag and query are provided and valid
  const shouldFetchPosts = !!(
    props.tag &&
    currentQuery &&
    props.tag.length > 0 &&
    props.tag.every((t) => t && typeof t.tag === "string" && t.tag.length > 0)
  );

  const magazinePosts = useMagazinePosts(currentQuery || "", props.tag || []);

  const isLoading = shouldFetchPosts
    ? magazinePosts.isLoading
    : props.isLoading || false;
  const error = shouldFetchPosts ? magazinePosts.error : props.error || null;

  const posts = useMemo(() => {
    const finalPosts = shouldFetchPosts
      ? magazinePosts.posts
      : props.posts || [];
    return finalPosts;
  }, [magazinePosts.posts, props.posts, shouldFetchPosts]);

  // Optimize initialization for better performance
  useEffect(() => {
    let animationFrame: number;
    const initializeAsync = () => {
      animationFrame = requestAnimationFrame(() => {
        setIsInitialized(true);
      });
    };

    // Start initialization immediately but defer heavy operations
    initializeAsync();

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current && isInitialized) {
      audioRef.current.volume = 0.2; // Set to 20% volume
    }
  }, [isInitialized]);

  // Memoize filtered and sorted posts for performance
  const filteredPosts = useMemo(() => {
    if (!posts || !isInitialized) return [];

    // First apply quality filters (reputation and downvote filtering)
    const qualityFilteredPosts = filterAutoComments(posts);

    // Then sort by payout value
    const sortedPosts = qualityFilteredPosts.sort(
      (a, b) =>
        Number(getPayoutValue(b as any)) - Number(getPayoutValue(a as any))
    );

    return sortedPosts;
  }, [posts, isInitialized]);

  const playSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0.02;
      audioRef.current.play();
    }
  };

  if (isLoading || !isInitialized) {
    return <LoadingComponent />;
  }

  if (error) {
    console.log("Magazine error:", error);
    return (
      <Flex justify="center" align="center" w="100%" h="100%" p={5}>
        <Text color={"white"}>Error loading posts</Text>
      </Flex>
    );
  }

  if (!filteredPosts.length) {
    return (
      <Flex justify="center" align="center" w="100vw" h="100vh" p={5}>
        <Text>No posts available</Text>
      </Flex>
    );
  }

  return (
    <ContentErrorWatcher>
      <VStack
        {...backgroundGradient}
        width="100%"
        height="100%"
        alignItems="flex-start"
        justifyContent="flex-start"
        spacing={0}
        sx={{
          "&::-webkit-scrollbar": { display: "none" },
          scrollbarWidth: "none",
          overflowY: "hidden",
        }}
      >
        <audio ref={audioRef} src="/pageflip.mp3" preload="auto" />
        <HTMLFlipBook
          className="flipbook hide-scrollbar"
          width={1000}
          height={1300}
          minWidth={0}
          maxWidth={10000}
          minHeight={0}
          maxHeight={10000}
          startPage={0}
          size="stretch"
          drawShadow={false}
          flippingTime={600} // Reduced from 1000ms for snappier feel
          usePortrait
          startZIndex={0}
          autoSize={false} // Disable auto-sizing to prevent reflows
          maxShadowOpacity={0.1} // Reduced shadow for better performance
          showCover={false}
          mobileScrollSupport={false} // Disable to reduce event listeners
          swipeDistance={30} // Reduced sensitivity for better performance
          clickEventForward={false}
          useMouseEvents
          renderOnlyPageLengthChange={true}
          showPageCorners={false}
          disableFlipByClick={false}
          style={{ width: "100%", height: "100vh" }}
          ref={flipBookRef}
          onInit={(instance: any) => {
            flipBookRef.current = instance;
          }}
          onFlip={() => {
            playSound();
            // Pause all native <video> elements (3speak SDK, IPFS videos)
            document.querySelectorAll(".flipbook video").forEach((video) => {
              const vid = video as HTMLVideoElement;
              if (!vid.paused) vid.pause();
            });
            // Pause iframes we still embed directly (YouTube after the user
            // clicks the lite-poster, Vimeo, Odysee, skatehype). 3speak iframes
            // no longer exist — handled by the native <video> branch above.
            document.querySelectorAll(".flipbook iframe").forEach((iframe) => {
              const ifr = iframe as HTMLIFrameElement;
              if (ifr.src.includes("youtube.com/embed")) {
                ifr.contentWindow?.postMessage(
                  JSON.stringify({
                    event: "command",
                    func: "pauseVideo",
                    args: [],
                  }),
                  "*"
                );
              } else if (ifr.src.includes("skatehype.com/ifplay.php")) {
                const oldSrc = ifr.src;
                ifr.src = "";
                setTimeout(() => {
                  ifr.src = oldSrc;
                }, 100);
              }
            });
          }}
          onUpdate={() => {}}
        >
          <Box
            width="100%"
            height="100%"
            position="relative"
            overflow="hidden"
            borderRadius="0px 16px 0px 0px"
            boxShadow={retroBoxShadow(theme)}
          >
            {/* Cover image - full bleed */}
            <Image
              src={props.zineCover || "/images/covers/nogenta_cover.png"}
              alt="SkateHive Cover"
              position="absolute"
              top={0}
              left={0}
              width="100%"
              height="100%"
              objectFit="cover"
              loading="lazy"
              zIndex={0}
            />

            {/* 3D shadow effect on right edge */}
            <Box
              position="absolute"
              top={0}
              right={0}
              width="40px"
              height="100%"
              zIndex={1}
              background="linear-gradient(to left, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)"
              pointerEvents="none"
            />

            {/* Matrix effect as overlay (optional) */}
            {!props.zineCover && (
              <Box
                position="absolute"
                top={0}
                left={0}
                width="100%"
                height="100%"
                zIndex={1}
                pointerEvents="none"
              >
                <MatrixOverlay coverMode />
              </Box>
            )}

            {/* Magazine cover text layout - Skateboarder magazine style */}
            <Box
              position="absolute"
              top={0}
              left={0}
              width="100%"
              height="100%"
              zIndex={2}
              pointerEvents="none"
            >
              {/* Horizontal username at top left */}
              {(props.displayName || props.hiveUsername) && (
                <Text
                  position="absolute"
                  top="20px"
                  left="20px"
                  fontSize="2xl"
                  fontWeight="bold"
                  color={theme.colors.primary}
                  textTransform="uppercase"
                  style={{
                    fontFamily: `'Joystix', 'VT323', 'Fira Mono', 'monospace'`,
                    textShadow:
                      "0 4px 32px #000, 0 8px 48px #000, 0 0 8px #000, 0 0 2px #000",
                    letterSpacing: "2px",
                  }}
                >
                  {props.displayName || props.hiveUsername}
                </Text>
              )}

              {/* Vertical "ZINE" text on left side */}
              <Text
                position="absolute"
                left="20px"
                top="50%"
                fontSize="6xl"
                fontWeight="black"
                color={theme.colors.primary}
                textTransform="uppercase"
                style={{
                  fontFamily: `'Joystix', 'VT323', 'Fira Mono', 'monospace'`,
                  textShadow:
                    "0 4px 32px #000, 0 8px 48px #000, 0 0 8px #000, 0 0 2px #000",
                  letterSpacing: "8px",
                  writingMode: "vertical-rl",
                  transform: "translateY(-50%)",
                }}
              >
                {props.hiveUsername ? "ZINE" : "SKATEHIVE"}
              </Text>

              {/* Profile picture in bottom left corner */}
              {props.hiveUsername && (
                <Image
                  src={
                    props.userProfileImage ||
                    `https://images.hive.blog/u/${props.hiveUsername}/avatar/small`
                  }
                  alt={props.hiveUsername}
                  position="absolute"
                  bottom="20px"
                  left="20px"
                  boxSize="80px"
                  borderRadius="full"
                  border={`4px solid ${theme.colors.primary}`}
                  boxShadow="0 4px 32px #000, 0 8px 48px #000"
                />
              )}
            </Box>
          </Box>
          {filteredPosts.map((post: Discussion, index) => {
            const isLeftPage = index % 2 === 0;
            const pageBorderRadius = isLeftPage
              ? "16px 0 0 0px"
              : "0 16px 0px 0";
            return (
              <Box
                key={`${post.author}/${post.permlink}`}
                sx={{ ...pageStyles(theme), borderRadius: pageBorderRadius }}
                position="relative"
                width="100%"
                height="100%"
                overflow="hidden"
                display="flex"
                flexDirection="column"
              >
                <Flex align="center" gap={2} mb={3} className="magazine-meta">
                  <Image
                    src={`https://images.hive.blog/u/${post.author}/avatar/small`}
                    alt={post.author}
                    boxSize="28px"
                    borderRadius="full"
                    flexShrink={0}
                  />
                  <Text
                    as="span"
                    color={theme.colors.primary}
                    className="magazine-meta-handle"
                  >
                    @{post.author}
                  </Text>
                  <Text as="span" className="magazine-meta-sep">
                    ·
                  </Text>
                  <Text as="span" className="magazine-meta-date">
                    {new Date(post.created).toLocaleDateString()}
                  </Text>
                  <Box flex={1} />
                  <Badge
                    bg={theme.colors.primary}
                    color={theme.colors.background}
                    className="magazine-meta-payout"
                  >
                    ${Number(getPayoutValue(post as any)).toFixed(2)}
                  </Badge>
                </Flex>
                <Heading
                  as="h2"
                  className="magazine-title"
                  color={theme.colors.primary}
                >
                  {post.title}
                </Heading>
                <Box className="magazine-rule" />
                <Box
                  flex="1 1 0%"
                  minHeight={0}
                  overflowY="auto"
                  overflowX="hidden"
                  width="100%"
                  className="hide-scrollbar magazine-content"
                  data-body-font={tweaks.bodyFont}
                  data-body-color={tweaks.bodyColor}
                  data-drop-cap={tweaks.dropCap ? "on" : "off"}
                  data-pull-quote={tweaks.pullQuote ? "on" : "off"}
                  data-image-frames={tweaks.imageFrames ? "on" : "off"}
                  data-tight-rhythm={tweaks.tightRhythm ? "on" : "off"}
                >
                  {!isInitialized ? (
                    <Box
                      display="flex"
                      justifyContent="center"
                      alignItems="center"
                      height="100%"
                    >
                      <LoadingComponent />
                    </Box>
                  ) : (
                    <Suspense
                      fallback={
                        <Box
                          display="flex"
                          justifyContent="center"
                          alignItems="center"
                          height="100%"
                        >
                          <LoadingComponent />
                        </Box>
                      }
                    >
                      <SkateErrorBoundary>
                        <EnhancedMarkdownRenderer content={post.body} />
                      </SkateErrorBoundary>
                    </Suspense>
                  )}
                </Box>
              </Box>
            );
          })}
          <Box sx={backCoverStyles(theme)}>
            <Heading color={theme.colors.primary}>Back Cover</Heading>
            <Text color={theme.colors.text}>Last Page</Text>
          </Box>
        </HTMLFlipBook>
        <style jsx global>{`
          /* ─── Post meta row (chrome — stays in pixel font) ─ */
          .magazine-meta {
            font-family: 'Joystix', 'VT323', 'Fira Mono', monospace;
          }
          .magazine-meta-handle {
            font-size: 0.85rem;
            font-weight: bold;
            letter-spacing: 0.5px;
          }
          .magazine-meta-sep {
            color: rgba(255, 255, 255, 0.25);
            margin: 0 2px;
          }
          .magazine-meta-date {
            font-size: 0.72rem;
            color: rgba(255, 255, 255, 0.5);
            letter-spacing: 0.5px;
          }
          .magazine-meta-payout {
            font-size: 0.7rem !important;
            font-weight: bold !important;
            letter-spacing: 0.5px;
            padding: 4px 8px !important;
            border-radius: 6px !important;
            min-width: 50px;
            display: inline-flex !important;
            align-items: center;
            justify-content: center;
            font-family: 'Joystix', 'VT323', 'Fira Mono', monospace !important;
          }
          /* ─── Post title (fixed area regardless of length) ─ */
          .magazine-title {
            font-family: 'Joystix', 'VT323', 'Fira Mono', monospace;
            font-size: 1.35rem !important;
            font-weight: 700 !important;
            line-height: 1.2 !important;
            letter-spacing: 0.5px;
            margin: 0 0 0.6rem 0 !important;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
            min-height: 2.4em;
            text-transform: uppercase;
          }
          .magazine-rule {
            height: 1px;
            background: var(--chakra-colors-primary, #adff2f);
            opacity: 0.22;
            margin: 0 0 1rem 0;
          }
          .magazine-content {
            color: var(--chakra-colors-text, #fff);
            contain: layout style paint;
            will-change: transform;
            --magazine-body-font: 'Georgia', 'Cambria', 'Times New Roman', serif;
            --magazine-body-color: #ece4cf;
            --magazine-accent: var(--chakra-colors-primary, #adff2f);
          }
          /* ─── Body font variants ─────────────────────────── */
          .magazine-content[data-body-font="serif"] {
            --magazine-body-font: 'Georgia', 'Cambria', 'Times New Roman', serif;
          }
          .magazine-content[data-body-font="sans"] {
            --magazine-body-font: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
          }
          .magazine-content[data-body-font="pixel"] {
            --magazine-body-font: 'Joystix', 'VT323', 'Fira Mono', monospace;
          }
          .magazine-content p,
          .magazine-content li,
          .magazine-content blockquote,
          .magazine-content blockquote p {
            font-family: var(--magazine-body-font);
          }
          /* ─── Body color variants ────────────────────────── */
          .magazine-content[data-body-color="warm"] {
            --magazine-body-color: #ece4cf;
          }
          .magazine-content[data-body-color="neon"] {
            --magazine-body-color: var(--chakra-colors-text, #adff2f);
          }
          .magazine-content[data-body-color="white"] {
            --magazine-body-color: #ffffff;
          }
          .magazine-content p,
          .magazine-content li {
            color: var(--magazine-body-color);
          }
          .magazine-content a {
            color: var(--magazine-accent);
            text-decoration: underline;
            text-underline-offset: 2px;
          }
          /* ─── Tight rhythm ───────────────────────────────── */
          .magazine-content[data-tight-rhythm="on"] p {
            margin: 0 0 1.1em 0;
            line-height: 1.7;
            font-size: 1.02rem;
            letter-spacing: 0.01em;
          }
          .magazine-content[data-tight-rhythm="on"] h1,
          .magazine-content[data-tight-rhythm="on"] h2,
          .magazine-content[data-tight-rhythm="on"] h3,
          .magazine-content[data-tight-rhythm="on"] h4 {
            margin-top: 1.6em;
            margin-bottom: 0.4em;
            line-height: 1.2;
          }
          .magazine-content[data-tight-rhythm="on"] ul,
          .magazine-content[data-tight-rhythm="on"] ol {
            margin: 0 0 1.1em 1.5em;
          }
          .magazine-content[data-tight-rhythm="on"] li {
            margin-bottom: 0.4em;
            line-height: 1.6;
          }
          /* ─── Drop cap on the first paragraph of the post ─── */
          /* EnhancedMarkdownRenderer wraps content in nested divs, so the first <p>
             ends up at variable depth — target the first <p> in document order. */
          .magazine-content[data-drop-cap="on"] p:first-of-type:first-child::first-letter {
            font-family: var(--magazine-body-font);
            font-size: 3.6em;
            float: left;
            line-height: 0.85;
            margin: 0.05em 0.12em 0 0;
            font-weight: 700;
            color: var(--magazine-accent);
          }
          /* ─── Pull-quote blockquote ──────────────────────── */
          .magazine-content[data-pull-quote="on"] blockquote {
            position: relative;
            font-style: italic;
            font-size: 1.18em;
            line-height: 1.55;
            padding: 1.4em 1.6em 1.4em 2.4em;
            margin: 2em 0;
            border: none;
            border-left: 3px solid var(--magazine-accent);
            background: rgba(173, 255, 47, 0.04);
            border-radius: 0 6px 6px 0;
          }
          .magazine-content[data-pull-quote="on"] blockquote::before {
            content: '\\201C';
            position: absolute;
            top: 0.05em;
            left: 0.35em;
            font-family: Georgia, serif;
            font-size: 2.6em;
            line-height: 1;
            color: var(--magazine-accent);
            opacity: 0.4;
          }
          .magazine-content[data-pull-quote="on"] blockquote p {
            margin: 0;
            color: var(--magazine-body-color);
          }
          /* ─── Image frames ───────────────────────────────── */
          .magazine-content[data-image-frames="on"] img {
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 6px 22px rgba(0, 0, 0, 0.45);
          }
          /* ─── Inner markdown headings (post body h1-h6) ──── */
          .magazine-content h1,
          .magazine-content h2,
          .magazine-content h3,
          .magazine-content h4,
          .magazine-content h5,
          .magazine-content h6 {
            font-family: var(--magazine-body-font);
            color: var(--magazine-accent);
            font-weight: 700;
            letter-spacing: -0.005em;
            line-height: 1.25;
            margin: 1.6em 0 0.4em 0;
          }
          .magazine-content h1 {
            font-size: 1.3rem;
          }
          .magazine-content h2 {
            font-size: 1.15rem;
          }
          .magazine-content h3 {
            font-size: 1.05rem;
          }
          .magazine-content h4 {
            font-size: 1rem;
          }
          .magazine-content h5,
          .magazine-content h6 {
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: rgba(173, 255, 47, 0.7);
          }
          /* First inline heading shouldn't have huge top margin */
          .magazine-content > div > *:first-child,
          .magazine-content > div > div:first-child > *:first-child {
            margin-top: 0 !important;
          }
          .magazine-content iframe {
            max-width: 100%;
            width: 100%;
            display: block;
            margin: 0 auto;
            will-change: transform;
            transform: translateZ(0);
          }
          .flipbook {
            will-change: transform;
            transform: translateZ(0);
            touch-action: pan-y pinch-zoom;
          }
          .flipbook * {
            touch-action: manipulation;
          }
          /* Hide vertical scrollbar for the post body area */
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .hide-scrollbar {
            -ms-overflow-style: none; /* IE and Edge */
            scrollbar-width: none; /* Firefox */
          }
          /* Aggressively hide all scrollbars within the flipbook and its children */
          .flipbook,
          .flipbook * {
            scrollbar-width: none !important; /* Firefox */
            -ms-overflow-style: none !important; /* IE and Edge */
          }
          .flipbook::-webkit-scrollbar,
          .flipbook *::-webkit-scrollbar {
            display: none !important; /* Chrome, Safari */
          }
        `}</style>
      </VStack>
    </ContentErrorWatcher>
  );
}
