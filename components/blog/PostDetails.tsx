import { safeCopyToClipboard } from "@/lib/utils/clipboardUtils";
import {
  Box,
  Text,
  Avatar,
  Flex,
  Icon,
  Button,
  Link,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Divider,
  Image,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  useToast,
  IconButton,
  HStack,
  Textarea,
  Tooltip,
  Container,
} from "@chakra-ui/react";
import RelatedPosts from "./RelatedPosts";
import AuthorBio from "./AuthorBio";
import Breadcrumbs, { BreadcrumbItemData } from "@/components/shared/Breadcrumbs";
import React, {
  useState,
  useRef,
  useMemo,
  useCallback,
  useEffect,
} from "react";
import { Discussion } from "@hiveio/dhive";
import { FaHeart, FaRegHeart, FaShareSquare, FaEdit, FaInstagram } from "react-icons/fa";
import { getPostDate } from "@/lib/utils/GetPostDate";
import { useAioha } from "@aioha/react-ui";
import useHiveVote from "@/hooks/useHiveVote";
import useSoftPostOverlay from "@/hooks/useSoftPostOverlay";
import useSoftVoteOverlay from "@/hooks/useSoftVoteOverlay";
import { getPayoutValue } from "@/lib/hive/client-functions";
import useHivePower from "@/hooks/useHivePower";
import VoteListPopover from "./VoteListModal";
import { MarkdownProcessor } from "@/lib/markdown/MarkdownProcessor";
import { EnhancedMarkdownRenderer } from "@/components/markdown/EnhancedMarkdownRenderer";
import { usePostEdit } from "@/hooks/usePostEdit";
import ThumbnailPicker from "@/components/compose/ThumbnailPicker";
import { DEFAULT_VOTE_WEIGHT } from "@/lib/utils/constants";
import useVoteWeight from "@/hooks/useVoteWeight";
import UpvoteStoke from "@/components/graphics/UpvoteStoke";
import { extractSafeUser } from "@/lib/userbase/safeUserMetadata";
import HiveUpgradePromptModal from "@/components/shared/HiveUpgradePromptModal";
import { usePostProseTweaks } from "@/hooks/usePostProseTweaks";
import { PostProseTweaksPanel } from "./PostProseTweaksPanel";
import useIsAdmin from "@/hooks/useIsAdmin";
import InstagramPreviewModal, {
  type CrossPostContext,
} from "@/components/homepage/InstagramPreviewModal";
import { extractPostMedia } from "@/lib/instagram/extractPostMedia";
import {
  buildProseStyleVars,
  resolveReaderBg,
  wrapDropCapFirstLetter,
} from "@/lib/prose/proseStyle";

interface PostDetailsProps {
  post: Discussion;
  onOpenConversation: () => void;
}

// Build a human-friendly date pair. Relative ("3 mo ago") gives quick
// recency; absolute ("Aug 27, 2025") removes ambiguity for old posts.
function formatPostDate(date: string): { relative: string; absolute: string } {
  const created = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  let relative: string;
  if (diffMins < 1) relative = "just now";
  else if (diffMins < 60) relative = `${diffMins}m ago`;
  else if (diffHrs < 24) relative = `${diffHrs}h ago`;
  else if (diffDays < 7) relative = `${diffDays}d ago`;
  else if (diffDays < 30) relative = `${Math.floor(diffDays / 7)}w ago`;
  else if (diffMonths < 12) relative = `${diffMonths}mo ago`;
  else relative = `${diffYears}y ago`;

  const absolute = created.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return { relative, absolute };
}

// Many authors paste the post title back into the markdown as the first
// heading. The header already renders the title, so strip a leading
// "# Title" or "Title\n===" if it matches post.title (case-insensitive,
// trimmed). Common variants: optional bold/italic markers, optional
// trailing punctuation.
function stripDuplicateLeadingTitle(body: string, title: string): string {
  if (!body || !title) return body;
  const trimmedBody = body.replace(/^\s+/, "");
  const normalizedTitle = title.trim().toLowerCase();
  if (!normalizedTitle) return body;

  // Read the first non-empty line and compare to title after stripping
  // common markdown markers (# heading, **bold**, *italic*).
  const newlineIdx = trimmedBody.indexOf("\n");
  const firstLine = (newlineIdx === -1 ? trimmedBody : trimmedBody.slice(0, newlineIdx)).trim();
  const restOfBody = newlineIdx === -1 ? "" : trimmedBody.slice(newlineIdx + 1);

  // ATX heading: `# Title`, `## Title`, etc.
  const atxMatch = firstLine.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
  if (atxMatch) {
    const headingText = atxMatch[1]
      .replace(/^[*_]+|[*_]+$/g, "")
      .trim()
      .toLowerCase();
    if (headingText === normalizedTitle) {
      return restOfBody.replace(/^\s+/, "");
    }
  }

  // Setext heading: `Title\n===` or `Title\n---`
  // Need to look at 2nd line for === or ---
  if (restOfBody) {
    const secondNewline = restOfBody.indexOf("\n");
    const secondLine = (secondNewline === -1 ? restOfBody : restOfBody.slice(0, secondNewline)).trim();
    if (/^=+$/.test(secondLine) && firstLine.toLowerCase() === normalizedTitle) {
      const remainder = secondNewline === -1 ? "" : restOfBody.slice(secondNewline + 1);
      return remainder.replace(/^\s+/, "");
    }
  }

  return body;
}

export default function PostDetails({
  post,
  onOpenConversation,
}: PostDetailsProps) {
  const { title, author, body, created } = post;
  const safeUser = useMemo(
    () => extractSafeUser(post.json_metadata),
    [post.json_metadata],
  );

  // Extract tags for related posts
  const postTags = useMemo(() => {
    try {
      let meta: any = post.json_metadata;
      if (typeof meta === "string") meta = JSON.parse(meta);
      if (Array.isArray(meta?.tags)) {
        return meta.tags.filter((t: any) => typeof t === "string" && t.length > 1);
      }
    } catch {
      // Silent fail
    }
    return [];
  }, [post.json_metadata]);

  const softPost = useSoftPostOverlay(post.author, post.permlink, safeUser);
  const softVote = useSoftVoteOverlay(post.author, post.permlink);
  const displayAuthor =
    softPost?.user.display_name || softPost?.user.handle || author;
  const displayAvatar =
    softPost?.user.avatar_url ||
    `https://images.hive.blog/u/${author}/avatar/sm`;
  const postDate = useMemo(() => getPostDate(created), [created]);
  const postDateFull = useMemo(() => formatPostDate(created), [created]);
  const primaryTag = postTags[0];
  const { user: walletUser } = useAioha();
  const { vote, effectiveUser, canVote } = useHiveVote();
  const userVoteWeight = useVoteWeight(effectiveUser || "");
  const [sliderValue, setSliderValue] = useState(userVoteWeight);
  const [showSlider, setShowSlider] = useState(false);
  const [activeVotes, setActiveVotes] = useState(post.active_votes || []);
  const [payoutValue, setPayoutValue] = useState(
    parseFloat(getPayoutValue(post)),
  );
  const hasSoftVote =
    !!softVote && softVote.status !== "failed" && softVote.weight > 0;
  const [voted, setVoted] = useState(
    hasSoftVote ||
      post.active_votes?.some(
        (item) => item.voter.toLowerCase() === effectiveUser?.toLowerCase(),
      ),
  );
  const toast = useToast();

  // UpvoteStoke state management
  const [stokeInstances, setStokeInstances] = useState<
    Array<{
      id: number;
      value: number;
      isVisible: boolean;
    }>
  >([]);

  // Track previous payout value to detect changes
  const prevPayoutValueRef = useRef(payoutValue);

  // Moderator-only: cross-post a mag post to @skatehive Instagram. Multiple
  // media → carousel; single → image/Reel. Built lazily from the post body.
  const isModerator = useIsAdmin();
  const [isIgOpen, setIsIgOpen] = useState(false);
  const igMediaItems = useMemo(() => extractPostMedia(post.body || ""), [post.body]);
  // Stable reference — PostDetails re-renders on its own payout/animation/slider
  // state; an inline object would re-run the dialog's preview fetch and wipe the
  // moderator's in-progress caption/collaborator edits.
  const igContext: CrossPostContext = useMemo(
    () => ({
      hiveAuthor: post.author,
      hivePermlink: post.permlink,
      title: post.title || "",
      body: post.body,
      tags: postTags,
      imageUrl:
        igMediaItems.length >= 2
          ? igMediaItems.find((m) => m.type === "image")?.url ?? null
          : igMediaItems[0]?.type === "image"
          ? igMediaItems[0].url
          : null,
      videoUrl:
        igMediaItems.length < 2 && igMediaItems[0]?.type === "video"
          ? igMediaItems[0].url
          : null,
      mediaItems: igMediaItems.length >= 2 ? igMediaItems : undefined,
      permalinkUrl: `${
        typeof window !== "undefined" ? window.location.origin : "https://skatehive.app"
      }/post/${post.author}/${post.permlink}`,
    }),
    [post.author, post.permlink, post.title, post.body, postTags, igMediaItems]
  );

  const readingTime = useMemo(() => {
    const wordCount = (post.body || "").split(/\s+/).filter((w) => w.length > 0).length;
    return Math.ceil(wordCount / 200);
  }, [post.body]);

  // Helper function to trigger UpvoteStoke animation
  const triggerUpvoteStoke = useCallback((estimatedValue: number) => {
    const newInstance = {
      id: Date.now(),
      value: estimatedValue,
      isVisible: true,
    };
    setStokeInstances((prev) => [...prev, newInstance]);

    // Remove the instance after animation completes
    setTimeout(() => {
      setStokeInstances((prev) =>
        prev.filter((instance) => instance.id !== newInstance.id),
      );
    }, 4000); // Total animation duration from UpvoteStoke.tsx
  }, []);

  // Watch for payoutValue changes and trigger animation
  useEffect(() => {
    const currentPayout = payoutValue;
    const previousPayout = prevPayoutValueRef.current;

    // Only trigger if the value increased (not on very first render)
    if (currentPayout > previousPayout) {
      const increase = currentPayout - previousPayout;
      triggerUpvoteStoke(increase);
    }

    // Update the ref with current value
    prevPayoutValueRef.current = currentPayout;
  }, [payoutValue, triggerUpvoteStoke]);

  // Use the post edit hook (handles Keychain + stored-posting-key paths)
  const {
    isEditing,
    editedContent,
    isSaving,
    selectedThumbnail,
    setEditedContent,
    setSelectedThumbnail,
    handleEditClick,
    handleCancelEdit,
    handleSaveEdit,
    showUpgradeModal,
    upgradeAction,
    closeUpgradeModal,
    canEditThisPost,
  } = usePostEdit(post);

  // Edit-button visibility: any user whose effective Hive identity matches
  // the post's author, whether they're on Keychain or using a stored key.
  const isAuthor = canEditThisPost;

  const {
    hivePower,
    isLoading: isHivePowerLoading,
    error: hivePowerError,
    estimateVoteValue,
  } = useHivePower(effectiveUser || "");

  // Update slider value when user's vote weight changes
  useEffect(() => {
    setSliderValue(userVoteWeight);
  }, [userVoteWeight]);

  useEffect(() => {
    setActiveVotes(post.active_votes || []);
    setPayoutValue(parseFloat(getPayoutValue(post)));
    setVoted(
      hasSoftVote ||
        post.active_votes?.some(
          (item) => item.voter.toLowerCase() === effectiveUser?.toLowerCase(),
        ) ||
        false,
    );
  }, [post, effectiveUser, hasSoftVote]);

  // Process markdown content once.
  // We strip a leading "# Title" / "Title\n===" line if it duplicates
  // post.title — the title is already shown in the header above the body,
  // and many authors copy it into the markdown as well.
  const processedMarkdown = useMemo(() => {
    const raw = isEditing ? editedContent : body;
    const deduped = stripDuplicateLeadingTitle(raw, title);
    const withCap = wrapDropCapFirstLetter(deduped);
    return MarkdownProcessor.process(withCap);
  }, [body, editedContent, isEditing, title]);

  // Reader typography tweaks (driven by PostProseTweaksPanel via localStorage)
  const { tweaks: proseTweaks } = usePostProseTweaks();

  // Resolve every enum/numeric tweak into the final CSS variable values
  // consumed by `.post-prose` rules in styles/markdown.css. Memoized so we
  // don't allocate a new style object on every re-render.
  const proseStyleVars = useMemo(
    () => buildProseStyleVars(proseTweaks),
    [proseTweaks],
  );

  // Reader column background — applied to the markdownRef Box around the
  // prose, not the prose itself. Falls through to theme when "theme".
  const readerBg = useMemo(
    () => resolveReaderBg(proseTweaks),
    [proseTweaks],
  );

  // Page-level background override (applies to the document body). Theme
  // mode = no override; transparent/custom paint the body directly. Cleanup
  // on unmount or when leaving the post page so other routes keep theme bg.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    const prevBg = body.style.background;
    if (proseTweaks.pageBg === "custom") {
      body.style.background = proseTweaks.pageBgCustom;
    } else if (proseTweaks.pageBg === "transparent") {
      body.style.background = "transparent";
    } else {
      body.style.background = "";
    }
    return () => {
      body.style.background = prevBg;
    };
  }, [proseTweaks.pageBg, proseTweaks.pageBgCustom]);

  // Memoize payout calculations
  const payoutData = useMemo(() => {
    const createdDate = new Date(post.created);
    const now = new Date();
    const timeDifferenceInMs = now.getTime() - createdDate.getTime();
    const timeDifferenceInDays = timeDifferenceInMs / (1000 * 60 * 60 * 24);
    const isPending = timeDifferenceInDays < 7;
    const daysRemaining = isPending
      ? Math.max(0, 7 - Math.floor(timeDifferenceInDays))
      : 0;

    const assetToString = (val: string | { toString: () => string }): string =>
      typeof val === "string" ? val : val.toString();

    const parsePayout = (
      val: string | { toString: () => string } | undefined,
    ): number => {
      if (!val) return 0;
      const str = assetToString(val);
      return parseFloat(str.replace(" HBD", "").replace(",", ""));
    };

    return {
      isPending,
      daysRemaining,
      authorPayout: parsePayout(post.total_payout_value),
      curatorPayout: parsePayout(post.curator_payout_value),
    };
  }, [post.created, post.total_payout_value, post.curator_payout_value]);

  // Compose gradient and box shadows using theme color names directly
  const boxShadowAccent = `0 0 0 0 var(--chakra-colors-accent, #48BB78B3)`;

  const markdownRef = useRef<HTMLDivElement>(null);

  // Popover state for payout split
  const [isPayoutOpen, setIsPayoutOpen] = useState(false);
  const openPayout = useCallback(() => setIsPayoutOpen(true), []);
  const closePayout = useCallback(() => setIsPayoutOpen(false), []);

  // Memoize event handlers
  const handleHeartClick = useCallback(() => {
    setShowSlider(!showSlider);
  }, [showSlider]);

  const handleShare = useCallback(async () => {
    const postUrl = `${window.location.origin}/post/${author}/${post.permlink}`;

    await safeCopyToClipboard(postUrl, {
      successMessage: "Link copied!",
      errorMessage: "Failed to copy",
      showToast: (options) =>
        toast({
          title: options.title,
          description:
            options.status === "success"
              ? "Post URL has been copied to clipboard"
              : "Could not copy URL to clipboard",
          status: options.status,
          duration: 2000,
          isClosable: true,
        }),
    });
  }, [author, post.permlink, toast]);

  const handleVote = useCallback(async () => {
    if (!canVote) return;
    try {
      const voteResult = await vote(
        post.author,
        post.permlink,
        sliderValue * 100,
      );
      if (voteResult.success) {
        setVoted(true);
        if (effectiveUser) {
          setActiveVotes([...activeVotes, { voter: effectiveUser }]);
        }
        // Estimate the value and optimistically update payout
        if (estimateVoteValue) {
          try {
            const estimatedValue = await estimateVoteValue(sliderValue);
            setPayoutValue((prev) => prev + estimatedValue);
            // UpvoteStoke will trigger automatically when payoutValue changes
          } catch (e) {
            // fallback: do not update payout
          }
        }
      }
    } catch (error) {
      toast({
        title: "Failed to vote",
        description: "Please try again",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setShowSlider(false);
    }
  }, [
    vote,
    post.author,
    post.permlink,
    sliderValue,
    activeVotes,
    effectiveUser,
    estimateVoteValue,
    canVote,
    toast,
  ]);

  // Build breadcrumbs
  const breadcrumbs = useMemo(() => {
    const items: BreadcrumbItemData[] = [
      { label: "Home", href: "/" },
      { label: "Blog", href: "/blog" },
    ];
    
    // Add category if available from tags
    if (postTags.length > 0) {
      const mainTag = postTags[0];
      items.push({ 
        label: mainTag.charAt(0).toUpperCase() + mainTag.slice(1), 
        href: `/blog/tag/${mainTag}` 
      });
    }
    
    // Add post title as current page
    items.push({ 
      label: title || "Post", 
      isCurrentPage: true 
    });
    
    return items;
  }, [title, postTags]);

  return (
    <Box
      data-component="PostDetails"
      borderRadius="base"
      overflow="hidden"
      bg="background"
      mb={3}
      p={2}
      w="100%"
      mt={{ base: "0px", md: "10px" }}
    >
      {/* Breadcrumbs Navigation */}
      <Box px={2} pt={2}>
        <Breadcrumbs items={breadcrumbs} />
      </Box>

      <Box
        data-subcomponent="PostDetails/Header"
        bg="background"
        px={{ base: 2, md: 3 }}
        pt={{ base: 2, md: 3 }}
        pb={{ base: 3, md: 3 }}
        mb={3}
        borderBottom="1px solid"
        borderColor="muted"
      >
        {/* Title — leads on both mobile and desktop */}
        <Text
          as="h1"
          fontSize={{ base: "xl", md: "2xl" }}
          fontWeight="bold"
          color="colorBackground"
          lineHeight="1.2"
          mb={2}
        >
          {title}
        </Text>

        {/* Meta layout: stacks at true-mobile widths (<sm), single row at sm+
            so the narrow desktop post column still gets a tidy single line. */}
        <Flex
          direction={{ base: "column", sm: "row" }}
          alignItems={{ base: "stretch", sm: "center" }}
          justifyContent="space-between"
          gap={{ base: 2, sm: 2 }}
          w="100%"
        >
          {/* Author block — avatar + 2-line name/date stack on mobile,
              keeps horizontal flow on larger widths via baseline + wrap. */}
          <Flex alignItems="center" gap={2.5} minW="0" flexShrink={1}>
            <Avatar
              size="sm"
              name={displayAuthor}
              src={displayAvatar}
            />
            <Box minW="0">
              <Link
                href={`/user/${author}`}
                color="colorBackground"
                fontWeight="semibold"
                fontSize="sm"
                _hover={{ color: "primary" }}
                display="block"
                lineHeight="1.25"
                isTruncated
              >
                {displayAuthor}
              </Link>
              <Text
                fontSize="xs"
                color="colorBackground"
                opacity={0.6}
                lineHeight="1.3"
                mt="2px"
              >
                <Tooltip
                  label={postDateFull.absolute}
                  placement="bottom"
                  hasArrow
                >
                  <span>{postDateFull.relative}</span>
                </Tooltip>
                {readingTime > 0 && (
                  <> · {readingTime} min read</>
                )}
              </Text>
            </Box>
          </Flex>

          {/* Stats + actions — full-width bar on mobile (payout left, actions
              right), tight cluster on sm+. */}
          <Flex
            alignItems="center"
            gap={1}
            justifyContent={{ base: "space-between", sm: "flex-end" }}
            flexShrink={0}
            w={{ base: "100%", sm: "auto" }}
          >
            <Popover
              placement="top"
              isOpen={isPayoutOpen}
              onClose={closePayout}
              closeOnBlur={true}
            >
              <PopoverTrigger>
                <Box position="relative">
                  <span
                    style={{ cursor: "pointer" }}
                    onMouseDown={openPayout}
                    onMouseUp={closePayout}
                  >
                    <Text
                      fontWeight="bold"
                      color="primary"
                      fontSize="sm"
                    >
                      ${payoutValue.toFixed(2)}
                    </Text>
                  </span>
                  {stokeInstances.map((instance) => (
                    <UpvoteStoke
                      key={instance.id}
                      estimatedValue={instance.value}
                      isVisible={instance.isVisible}
                    />
                  ))}
                </Box>
              </PopoverTrigger>
              <PopoverContent
                w="auto"
                bg="gray.800"
                color="white"
                borderRadius="none"
                boxShadow="lg"
                p={2}
              >
                <PopoverArrow />
                <PopoverBody>
                  {payoutData.isPending ? (
                    <div>
                      <div>
                        <b>Pending</b>
                      </div>
                      <div>
                        {payoutData.daysRemaining} day
                        {payoutData.daysRemaining !== 1 ? "s" : ""} until payout
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        Author: <b>${payoutData.authorPayout.toFixed(3)}</b>
                      </div>
                      <div>
                        Curators: <b>${payoutData.curatorPayout.toFixed(3)}</b>
                      </div>
                    </>
                  )}
                </PopoverBody>
              </PopoverContent>
            </Popover>

            <Divider orientation="vertical" h="16px" mx={1} />

            <HStack spacing={{ base: 0, md: 1 }}>
              <IconButton
                aria-label="Share post"
                icon={<FaShareSquare />}
                size="sm"
                variant="ghost"
                color="primary"
                onClick={handleShare}
                _hover={{ bg: "transparent", color: "accent" }}
                fontSize="14px"
                minW="auto"
                h="auto"
                p={1}
              />
              {isModerator && igMediaItems.length > 0 && (
                <IconButton
                  aria-label="Cross-post to Instagram"
                  title={
                    igMediaItems.length >= 2
                      ? `Cross-post to Instagram (carousel · ${igMediaItems.length})`
                      : "Cross-post to Instagram"
                  }
                  icon={<FaInstagram />}
                  size="sm"
                  variant="ghost"
                  color="primary"
                  onClick={() => setIsIgOpen(true)}
                  _hover={{ bg: "transparent", color: "accent" }}
                  fontSize="14px"
                  minW="auto"
                  h="auto"
                  p={1}
                />
              )}
              {isAuthor && (
                <IconButton
                  aria-label="Edit post"
                  icon={<FaEdit />}
                  size="sm"
                  variant="ghost"
                  color="primary"
                  onClick={handleEditClick}
                  _hover={{ bg: "transparent", color: "accent" }}
                  fontSize="14px"
                  minW="auto"
                  h="auto"
                  p={1}
                />
              )}
              <IconButton
                aria-label={voted ? "Unvote" : "Vote"}
                icon={voted ? <FaHeart /> : <FaRegHeart />}
                size="sm"
                variant="ghost"
                color={voted ? "accent" : "primary"}
                onClick={handleHeartClick}
                _hover={{ bg: "transparent", color: "accent" }}
                fontSize="14px"
                minW="auto"
                h="auto"
                p={1}
              />
              <VoteListPopover
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    minW="auto"
                    px={1}
                    _active={{ bg: "transparent" }}
                    color={voted ? "accent" : "primary"}
                    _hover={{ textDecoration: "underline" }}
                    fontSize="sm"
                    h="auto"
                    p={1}
                  >
                    {activeVotes.length}
                  </Button>
                }
                votes={activeVotes}
                post={post}
              />
            </HStack>
          </Flex>
        </Flex>

        {showSlider ? (
          <Flex
            data-subcomponent="PostDetails/VoteControls"
            mt={2}
            alignItems="center"
            w="100%"
          >
            <Box width="100%" mr={2}>
              <Slider
                aria-label="slider-ex-1"
                min={0}
                max={100}
                value={sliderValue}
                onChange={(val) => setSliderValue(val)}
              >
                <SliderTrack
                  bg="muted"
                  height="8px"
                  boxShadow={boxShadowAccent}
                >
                  <SliderFilledTrack bgGradient="linear(to-r, success, warning, error)" />
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
              onClick={handleVote}
              bgGradient="linear(to-r, primary, accent)"
              color="background"
              _hover={{ bg: "accent" }}
              fontWeight="bold"
              className="subtle-pulse"
            >
              &nbsp;&nbsp;&nbsp;Vote {sliderValue} %&nbsp;&nbsp;&nbsp;
            </Button>
            <Button
              size="xs"
              onClick={handleHeartClick}
              ml={2}
              bg="muted"
              color="primary"
              _hover={{ bg: "muted", opacity: 0.8 }}
            >
              X
            </Button>
          </Flex>
        ) : null}
      </Box>

      <Box
        mt={2}
        ref={markdownRef}
        background={readerBg}
        maxHeight={{ base: "none", md: "1000px" }}
        overflowY={{ base: "visible", md: "auto" }}
        css={{
          "@media (min-width: 768px)": {
            "&::-webkit-scrollbar": {
              width: "8px",
            },
            "&::-webkit-scrollbar-track": {
              background: "var(--chakra-colors-muted)",
              borderRadius: "2px",
            },
            "&::-webkit-scrollbar-thumb": {
              background: "var(--chakra-colors-primary)",
              borderRadius: "2px",
              border: "1px solid var(--chakra-colors-background)",
              cursor: "grab",
            },
            "&::-webkit-scrollbar-thumb:hover": {
              background: "var(--chakra-colors-accent)",
              cursor: "grabbing",
            },
            // Firefox scrollbar
            scrollbarWidth: "thin",
            scrollbarColor:
              "var(--chakra-colors-primary) var(--chakra-colors-muted)",
          },
        }}
      >
        {isEditing ? (
          <Box>
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              minHeight="400px"
              maxHeight="700px"
              bg="background"
              border="1px solid"
              borderColor="primary"
              color="colorBackground"
              _focus={{ borderColor: "accent" }}
              resize="vertical"
              fontFamily="monospace"
              fontSize="sm"
              css={{
                "&::-webkit-scrollbar": {
                  width: "none",
                },
                scrollbarWidth: "none",
              }}
            />

            {/* Thumbnail Picker */}
            <Box mt={4}>
              <ThumbnailPicker
                show={true}
                markdown={editedContent}
                selectedThumbnail={selectedThumbnail}
                setSelectedThumbnail={setSelectedThumbnail}
              />
            </Box>

            <Flex mt={3} gap={2} justifyContent="flex-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelEdit}
                color="muted"
                _hover={{ bg: "transparent", color: "primary" }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                isLoading={isSaving}
                loadingText="Saving..."
                bgGradient="linear(to-r, primary, accent)"
                color="background"
                _hover={{ bg: "accent" }}
                fontWeight="bold"
              >
                Save Changes
              </Button>
            </Flex>
          </Box>
        ) : (
          <Box
            className="post-prose"
            style={proseStyleVars}
            data-drop-cap={proseTweaks.dropCap ? "on" : "off"}
            data-image-frames={proseTweaks.imageFrames ? "on" : "off"}
            data-tight-rhythm={proseTweaks.tightRhythm ? "on" : "off"}
            data-blockquote={proseTweaks.blockquoteStyle}
            data-bg-pattern={proseTweaks.bgPattern}
            data-hr-style={proseTweaks.hrStyle}
            data-link-underline={proseTweaks.linkUnderline}
          >
            <EnhancedMarkdownRenderer
              content={processedMarkdown.contentWithPlaceholders}
            />
          </Box>
        )}
      </Box>

      {/* Author Bio Section */}
      <Container maxW="container.xl" px={4}>
        <AuthorBio
          author={softPost?.user.handle || author}
          displayName={displayAuthor}
          avatarUrl={displayAvatar}
          postCount={undefined}
          followers={undefined}
        />
      </Container>

      {/* Related Posts Section */}
      <Container maxW="container.xl" px={4}>
        <RelatedPosts
          currentAuthor={post.author}
          currentPermlink={post.permlink}
          tags={postTags}
          limit={4}
        />
      </Container>

      {/* Hive Upgrade Prompt Modal for lite users */}
      <HiveUpgradePromptModal
        isOpen={showUpgradeModal}
        onClose={closeUpgradeModal}
        action={upgradeAction}
      />

      {/* Reader typography tweaks — floating FAB on post pages */}
      <PostProseTweaksPanel />

      {/* Moderator: cross-post this mag post to @skatehive (carousel when
          it has 2+ media, otherwise a single image/Reel). */}
      {isModerator && isIgOpen && (
        <InstagramPreviewModal
          isOpen={isIgOpen}
          onClose={() => setIsIgOpen(false)}
          mode="moderator"
          context={igContext}
          userHandle={walletUser || effectiveUser || null}
        />
      )}
    </Box>
  );
}
