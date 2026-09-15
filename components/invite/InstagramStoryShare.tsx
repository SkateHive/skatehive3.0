"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Icon,
  Input,
  Text,
  useClipboard,
  useToast,
} from "@chakra-ui/react";
import { FaCheck, FaDownload, FaInstagram, FaLink } from "react-icons/fa";
import { toBlob } from "html-to-image";
import { useTranslations } from "@/contexts/LocaleContext";
import { APP_CONFIG } from "@/config/app.config";

/**
 * Instagram has no web share target for Stories — the only documented way to
 * prefill one is the native `instagram-stories://share` SDK, which needs a
 * registered iOS/Android app and a pasteboard we cannot reach from a browser.
 * What does work everywhere is handing the OS a 9:16 image: on mobile the
 * share sheet lists "Instagram > Stories", and the image lands as the story
 * background with no cropping.
 *
 * So this renders a card offscreen, captures it, and shares the file. Desktop
 * has no share sheet and Instagram has no web share endpoint either — no
 * sharer.php, no intent/tweet, no query parameter that can carry an image — so
 * there it downloads the PNG, copies the caption and opens Instagram in a new
 * tab, leaving only the upload itself to the user.
 */

/** Story canvas. Anything else gets letterboxed by Instagram. */
const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

/**
 * The card carries its own palette rather than the live theme tokens. A story
 * is seen outside Skatehive, where "the current theme" means nothing — and the
 * themes run from paper-white to gruvbox, so a themed card would be unreadable
 * in half of them. These are fixed so the export always looks deliberate.
 */
const CARD = {
  base: "#050608",
  ink: "#FFFFFF",
  glow: "#7CFF4F",
  glowDeep: "#1FAE3A",
  haze: "#6C4BFF",
};

interface InstagramStoryShareProps {
  url?: string;
  /** Caption text; also the headline printed on the card. */
  text?: string;
}

export default function InstagramStoryShare({
  url = "https://skatehive.app",
  text,
}: InstagramStoryShareProps) {
  const t = useTranslations();
  const toast = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  /** Captured ahead of the click — see renderStory. */
  const [ready, setReady] = useState<Blob | null>(null);
  /**
   * Set once the desktop handoff has run. The panel it reveals has to outlive
   * the click: the tab that opens takes focus, and by the time someone has
   * uploaded the image they are back here looking for the link, long after any
   * toast has gone.
   */
  const [handedOff, setHandedOff] = useState(false);
  /**
   * Whether this browser will accept a file through the share sheet. null until
   * detected, so the first paint does not promise the wrong thing.
   *
   * This is the only split that matters, and it is not mobile vs desktop:
   * Firefox on Android never shipped Web Share Level 2, so a phone can land on
   * the same path as a laptop. Detecting the capability instead of sniffing the
   * user agent keeps the two in step.
   */
  const [canShareFiles, setCanShareFiles] = useState<boolean | null>(null);
  /**
   * Coarse pointer, i.e. a phone or tablet. Only used to decide whether
   * opening instagram.com helps or hurts — never to guess at share support,
   * which is detected properly above.
   */
  const [isTouch, setIsTouch] = useState(false);

  const headline = text || t("common.socialShareDefault");
  const caption = `${headline}\n${url}`;
  const linkLabel = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  // Only the bare URL goes on the clipboard for the panel: a story link
  // sticker takes a URL and nothing else, so the headline would have to be
  // deleted by hand before it could be pasted.
  const { onCopy, hasCopied } = useClipboard(url);

  const saveImage = useCallback((blob: Blob) => {
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "skatehive-story.png";
    a.click();
    URL.revokeObjectURL(href);
  }, []);

  const renderStory = useCallback(async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    return toBlob(cardRef.current, {
      width: STORY_WIDTH,
      height: STORY_HEIGHT,
      pixelRatio: 1,
      backgroundColor: CARD.base,
      // The card is positioned offscreen, which html-to-image would otherwise
      // try to "fix" by rescaling the clone.
      skipAutoScale: true,
      cacheBust: false,
    });
  }, []);

  useEffect(() => {
    try {
      const probe = new File([new Uint8Array(1)], "probe.png", {
        type: "image/png",
      });
      setCanShareFiles(Boolean(navigator.canShare?.({ files: [probe] })));
    } catch {
      setCanShareFiles(false);
    }
    setIsTouch(window.matchMedia?.("(pointer: coarse)").matches ?? false);
  }, []);

  // Safari on iOS only honours navigator.share() while the click that triggered
  // it is still the active user gesture, and capturing the card takes long
  // enough to spend that. Capturing on mount means the click has a file in hand
  // and calls share() straight away.
  useEffect(() => {
    let cancelled = false;
    const warm = window.setTimeout(() => {
      renderStory()
        .then((blob) => {
          if (!cancelled && blob) setReady(blob);
        })
        .catch(() => {
          // Left null on purpose: the click path captures again and reports a
          // real failure there, where the user is actually waiting on it.
        });
    }, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(warm);
    };
  }, [renderStory, headline, url]);

  const handleShare = async () => {
    setBusy(true);
    try {
      const blob = ready ?? (await renderStory());
      if (!blob) throw new Error("capture failed");

      const file = new File([blob], "skatehive-story.png", {
        type: "image/png",
      });

      // canShare({ files }) is the only reliable test — Android Chrome exposes
      // navigator.share but refuses files on some versions. Re-checked with the
      // real file, since the mount probe only decided the wording.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: caption });
        return;
      }

      // Desktop has no share sheet, and Instagram publishes no web share
      // endpoint, so no URL can carry the image or the link for us. The image
      // and the tab are handed over now; the link waits in the panel below,
      // because it is needed at the end of the upload, not the start.
      setReady(blob);
      saveImage(blob);
      setHandedOff(true);

      // window.open takes focus, and navigator.clipboard.writeText rejects on
      // an unfocused document — so an auto-copy here would be lost either way.
      // The panel's own Copy button runs under its own click, with focus, which
      // is the only ordering that actually works.
      //
      // Only opened where a browser tab is the destination. On Android an app
      // link hands instagram.com to the Instagram app, which opens on the feed
      // with nothing attached — so a phone that cannot share files is left with
      // the panel and its instructions instead of a dead end.
      if (!isTouch) {
        window.open(
          APP_CONFIG.INSTAGRAM_WEB_URL,
          "_blank",
          "noopener,noreferrer"
        );
      }

      toast({
        title: t("invite.storyDownloaded"),
        description: isTouch
          ? t("invite.storyDownloadedHintApp")
          : t("invite.storyDownloadedHint"),
        status: "success",
        duration: 6000,
        isClosable: true,
      });
    } catch (error: any) {
      // Dismissing the share sheet rejects with AbortError. That is a choice,
      // not a failure, so it must not raise an error toast.
      if (error?.name === "AbortError") return;
      toast({
        title: t("invite.storyFailed"),
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleShare}
        isLoading={busy}
        leftIcon={<Icon as={FaInstagram} boxSize={5} />}
        color="white"
        size="md"
        // Instagram's own gradient, so the button reads as Instagram at a
        // glance next to the flat brand colours of the other share buttons.
        bgGradient="linear(to-tr, #FEDA75, #FA7E1E, #D62976, #962FBF, #4F5BD5)"
        _hover={{ filter: "brightness(1.12)" }}
        _active={{ filter: "brightness(0.95)" }}
      >
        {canShareFiles === false
          ? t("invite.storySaveButton")
          : t("invite.storyButton")}
      </Button>

      {/* The handoff, left standing. Instagram is a round trip: the image goes
          up first and the link sticker is typed at the end, by which point the
          user is back on this tab hunting for the URL. */}
      {handedOff && (
        <Box
          mt={4}
          textAlign="left"
          bg="panel"
          border="1px solid"
          borderColor="primary"
          borderLeftWidth="3px"
          px={4}
          py={3}
        >
          <Text
            fontSize="xs"
            color="dim"
            textTransform="uppercase"
            letterSpacing="0.1em"
            mb={3}
          >
            {t("invite.storyKitTitle")}
          </Text>

          <Flex align="center" gap={2} mb={1}>
            <Icon as={FaCheck} color="success" boxSize={3} />
            <Text fontSize="sm" color="text">
              {t("invite.storyKitImageDone")}
            </Text>
          </Flex>
          <Text fontSize="xs" color="dim" mb={3}>
            {isTouch ? t("invite.storyKitHintApp") : t("invite.storyKitHint")}
          </Text>

          <Text fontSize="xs" color="dim" mb={2}>
            {t("invite.storyKitLinkLabel")}
          </Text>
          <Flex gap={2} mb={3} wrap="wrap">
            <Input
              value={url}
              isReadOnly
              onFocus={(e) => e.target.select()}
              fontFamily="mono"
              fontSize="sm"
              bg="inputBg"
              color="inputText"
              borderColor="inputBorder"
              flex="1 1 220px"
              _hover={{ borderColor: "primary" }}
              _focus={{ borderColor: "primary", boxShadow: "none" }}
            />
            <Button
              onClick={onCopy}
              leftIcon={<Icon as={hasCopied ? FaCheck : FaLink} />}
              bg={hasCopied ? "success" : "primary"}
              color="background"
              _hover={{ bg: "success" }}
              size="md"
            >
              {hasCopied ? t("notifications.success.copied") : t("common.copy")}
            </Button>
          </Flex>

          <Flex gap={2} wrap="wrap">
            <Button
              onClick={() => ready && saveImage(ready)}
              isDisabled={!ready}
              leftIcon={<Icon as={FaDownload} />}
              variant="outline"
              borderColor="border"
              color="text"
              _hover={{ borderColor: "primary", color: "primary" }}
              size="sm"
            >
              {t("invite.storyKitRedownload")}
            </Button>
            {!isTouch && (
              <Button
                as="a"
                href={APP_CONFIG.INSTAGRAM_WEB_URL}
                target="_blank"
                rel="noopener noreferrer"
                leftIcon={<Icon as={FaInstagram} />}
                variant="outline"
                borderColor="border"
                color="text"
                _hover={{ borderColor: "primary", color: "primary" }}
                size="sm"
              >
                {t("invite.storyKitReopen")}
              </Button>
            )}
          </Flex>
        </Box>
      )}

      {/* Kept in the layout (not display:none) because html-to-image can only
          capture a node the browser has actually laid out. */}
      <Box
        position="fixed"
        top={0}
        left="-20000px"
        w={`${STORY_WIDTH}px`}
        h={`${STORY_HEIGHT}px`}
        pointerEvents="none"
        aria-hidden
      >
        <Flex
          ref={cardRef}
          w={`${STORY_WIDTH}px`}
          h={`${STORY_HEIGHT}px`}
          direction="column"
          align="center"
          justify="center"
          textAlign="center"
          px="96px"
          position="relative"
          overflow="hidden"
          bg={CARD.base}
          // Two offset radial washes plus a vertical fade. The washes are what
          // make the headline and the link look lit rather than pasted on.
          backgroundImage={`radial-gradient(circle at 18% 12%, ${CARD.glow}33 0%, transparent 46%), radial-gradient(circle at 86% 88%, ${CARD.haze}3D 0%, transparent 50%), linear-gradient(180deg, #0A0D10 0%, ${CARD.base} 55%, #01020A 100%)`}
        >
          {/* Faint grid: gives the flat background a sense of depth without
              competing with the type. */}
          <Box
            position="absolute"
            inset={0}
            opacity={0.14}
            backgroundImage={`linear-gradient(${CARD.glow}1F 1px, transparent 1px), linear-gradient(90deg, ${CARD.glow}1F 1px, transparent 1px)`}
            backgroundSize="72px 72px"
          />

          <Box position="relative" zIndex={1}>
            <Box
              as="img"
              src="/icon-512x512.png"
              alt=""
              w="200px"
              h="200px"
              mx="auto"
              mb="56px"
              borderRadius="44px"
              boxShadow={`0 0 90px ${CARD.glow}66`}
            />

            <Text
              fontFamily="mono"
              fontSize="34px"
              letterSpacing="0.44em"
              color={CARD.glow}
              textTransform="uppercase"
              mb="64px"
              textShadow={`0 0 28px ${CARD.glow}AA`}
            >
              Skatehive
            </Text>

            {/* The headline carries the glow the background sets up. */}
            <Text
              fontSize="88px"
              lineHeight="1.08"
              fontWeight="extrabold"
              color={CARD.ink}
              letterSpacing="-0.02em"
              textShadow={`0 0 60px ${CARD.glow}59, 0 6px 34px rgba(0,0,0,0.7)`}
            >
              {headline}
            </Text>

            {/* Link plate: the one thing a story viewer has to be able to read
                and retype, so it gets the strongest treatment on the card. */}
            <Flex
              mt="88px"
              align="center"
              justify="center"
              mx="auto"
              px="56px"
              py="38px"
              w="fit-content"
              border="3px solid"
              borderColor={CARD.glow}
              borderRadius="26px"
              bg={`${CARD.glowDeep}1F`}
              boxShadow={`0 0 0 12px ${CARD.glow}14, 0 0 72px ${CARD.glow}80, inset 0 0 44px ${CARD.glow}2E`}
            >
              <Text
                fontFamily="mono"
                fontSize="60px"
                fontWeight="bold"
                color={CARD.glow}
                letterSpacing="0.01em"
                textShadow={`0 0 34px ${CARD.glow}CC`}
              >
                {linkLabel}
              </Text>
            </Flex>

            <Text
              mt="72px"
              fontFamily="mono"
              fontSize="30px"
              letterSpacing="0.2em"
              color={`${CARD.ink}8A`}
              textTransform="uppercase"
            >
              {t("invite.storyTagline")}
            </Text>
          </Box>
        </Flex>
      </Box>
    </>
  );
}
