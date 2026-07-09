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
import { usePostProseTweaks } from "@/hooks/usePostProseTweaks";
import {
  buildProseStyleVars,
  wrapDropCapFirstLetter,
} from "@/lib/prose/proseStyle";

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
  // Full-bleed like the front cover — without an explicit size the page-flip
  // engine measures this page short (minHeight only), so the last page looked
  // detached/dislocated mid-animation.
  width: "100%",
  height: "100%",
  overflow: "hidden",
  background: `linear-gradient(120deg, ${theme.colors.primary} 60%, ${theme.colors.accent} 100%)`,
  color: theme.colors.text,
  justifyContent: "center",
  alignItems: "center",
  backgroundImage:
    "url(https://media1.giphy.com/media/9ZsHm0z5QwSYpV7g01/giphy.gif?cid=6c09b952uxaerotyqa9vct5pkiwvar6l6knjgsctieeg0sh1&ep=v1_gifs_search&rid=giphy.gif&ct=g)",
  backgroundSize: "cover",
  // Tight outline like the front cover — a large offset drop-shadow renders
  // outside the page bounds and reads as a "floating" page during the flip.
  boxShadow: retroBoxShadow(theme),
});

// Blank filler page: in landscape (two-page spread) the flip engine needs an
// EVEN page count — with an odd count the last sheet has only one face and the
// back cover visibly disconnects while flipping. Inserted before the back cover.
const fillerPageStyles = (theme: any) => ({
  ...pageStyles(theme),
  justifyContent: "center",
  alignItems: "center",
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
  // When the posts are an editorial pick (e.g. the curated magazine issue from
  // the ops portal), keep the given selection + order as-is: skip the quality
  // filter and the payout re-sort.
  preserveOrder?: boolean;
}

export default function Magazine(props: MagazineProps) {
  const { theme } = useTheme();
  const flipBookRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  // Magazine shares the post page's reading tweaks. Default values are
  // tuned for editorial typography on every theme (see
  // DEFAULT_POST_PROSE_TWEAKS).
  const { tweaks } = usePostProseTweaks();
  const proseStyleVars = useMemo(
    () => buildProseStyleVars(tweaks),
    [tweaks],
  );

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

    // Editorial issue: trust the curator's selection + order verbatim.
    if (props.preserveOrder) return posts;

    // First apply quality filters (reputation and downvote filtering)
    const qualityFilteredPosts = filterAutoComments(posts);

    // Then sort by payout value
    const sortedPosts = qualityFilteredPosts.sort(
      (a, b) =>
        Number(getPayoutValue(b as any)) - Number(getPayoutValue(a as any))
    );

    return sortedPosts;
  }, [posts, isInitialized, props.preserveOrder]);

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
          {[...filteredPosts.map((post: Discussion, index) => {
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
                  className="hide-scrollbar post-prose"
                  style={proseStyleVars}
                  data-drop-cap={tweaks.dropCap ? "on" : "off"}
                  data-image-frames={tweaks.imageFrames ? "on" : "off"}
                  data-tight-rhythm={tweaks.tightRhythm ? "on" : "off"}
                  data-blockquote={tweaks.blockquoteStyle}
                  data-bg-pattern={tweaks.bgPattern}
                  data-hr-style={tweaks.hrStyle}
                  data-link-underline={tweaks.linkUnderline}
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
                        <EnhancedMarkdownRenderer
                          content={wrapDropCapFirstLetter(post.body)}
                        />
                      </SkateErrorBoundary>
                    </Suspense>
                  )}
                </Box>
              </Box>
            );
          }),
          // Even-ize the page count (cover + posts + back cover) so the back
          // cover is the BACK face of the last sheet. Kept INSIDE the array and
          // filtered — never a bare `&&`/falsy child, because the flip engine
          // clones every child and React.Children.map hands cloneElement(null)
          // for a null/false child, which throws.
          (filteredPosts.length + 2) % 2 === 1 ? (
            <Box key="filler" sx={fillerPageStyles(theme)}>
              <Text color={theme.colors.muted} fontSize="sm">
                — fim da edição —
              </Text>
            </Box>
          ) : null,
          ].filter(Boolean)}
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
          /* Magazine post body now shares typography with the post page
             via .post-prose (see styles/markdown.css). The only flipbook-
             specific tweak is a perf hint for the scrolling region. */
          .post-prose {
            contain: layout style paint;
            will-change: transform;
          }
          .post-prose iframe {
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
