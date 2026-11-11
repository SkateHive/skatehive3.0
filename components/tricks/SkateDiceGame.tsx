"use client";

import { memo, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Flex, HStack, IconButton, Image, Text } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { FaArrowLeft, FaDice } from "react-icons/fa";
import { useTranslations } from "@/contexts/LocaleContext";
import {
  SKATE_DICE,
  trickFromFaces,
  SKATERS_CHOICE_SENTINEL,
  type SkateDie,
} from "@/lib/utils/skateDiceData";
import { PROMPT_COUNT, SENTENCE_COUNT, splitTemplate } from "@/lib/utils/skateSentences";
import MatrixRain from "./MatrixRain";

// Same feel as the mobile app's Coach Fred screen (mobileapp app/skate-dice + SkateRoulette).
const ITEM_H = 56;
const SPINS = 16; // full loops before landing
const REPEAT = SPINS + 6;
const BASE_DURATION = 1500;
const STAGGER = 380; // each column lands later, left → right
const TYPE_MS = 26; // per-character typing speed
const EASE_OUT_CUBIC = [0.33, 1, 0.68, 1] as const;

// Label tints from the mobile app, one per reel.
const DIE_COLORS: Record<string, string> = {
  stance: "#DA552F",
  side: "#2563EB",
  spin: "#059669",
  flip: "#9333EA",
};

// The game screen keeps the mobile app's look in every site theme, on purpose:
// several themes use a dark "primary", which would vanish on this dark stage.
const GAME_GREEN = "#32CD32";
const GAME_GLOW = "rgba(50, 205, 50, 0.6)";
const GAME_GLOW_HOVER = "rgba(50, 205, 50, 0.8)";

const SHAKE_G = 1.8 * 9.81;

interface Props {
  onClose: () => void;
  playRef?: RefObject<HTMLButtonElement>;
}

const Reel = memo(function Reel({ die, targetIndex, spinId, duration }: {
  die: SkateDie;
  targetIndex: number;
  spinId: number;
  duration: number;
}) {
  const faces = useMemo(
    () => Array.from({ length: REPEAT * die.faces.length }, (_, i) => die.faces[i % die.faces.length]),
    [die.faces]
  );
  // Before the first roll the strip sits at rest, so row 1 is in the centre band.
  const finalRow = SPINS * die.faces.length + targetIndex;
  const y = spinId === 0 ? 0 : -(finalRow - 1) * ITEM_H;

  return (
    <Box flex="1" minW={0} textAlign="center">
      <Text fontSize="xs" letterSpacing="0.15em" color="whiteAlpha.600" fontWeight="bold" mb={2} textTransform="uppercase">
        {die.key}
      </Text>
      <Box h={`${ITEM_H * 3}px`} overflow="hidden" borderRadius="12px" bg="#000" position="relative">
        <motion.div
          key={spinId}
          initial={{ y: 0 }}
          animate={{ y }}
          transition={{ duration: spinId === 0 ? 0 : duration / 1000, ease: EASE_OUT_CUBIC }}
        >
          {faces.map((face, i) => (
            <Flex key={i} h={`${ITEM_H}px`} align="center" justify="center" px={1}>
              <Text
                color={DIE_COLORS[die.key]}
                fontWeight="bold"
                fontSize={{
                  base: face.length > 7 ? "11px" : face.length > 5 ? "13px" : "15px",
                  md: face.length > 8 ? "14px" : "17px",
                }}
                lineHeight="1.1"
                noOfLines={2}
              >
                {face}
              </Text>
            </Flex>
          ))}
        </motion.div>
        <Box position="absolute" top={0} left={0} right={0} h={`${ITEM_H}px`} bg="blackAlpha.600" pointerEvents="none" zIndex={2} />
        <Box position="absolute" bottom={0} left={0} right={0} h={`${ITEM_H}px`} bg="blackAlpha.600" pointerEvents="none" zIndex={2} />
        <Box
          position="absolute"
          top={`${ITEM_H}px`}
          left={0}
          right={0}
          h={`${ITEM_H}px`}
          borderTop="2px solid"
          borderBottom="2px solid"
          borderColor={GAME_GREEN}
          bg="rgba(50, 205, 50, 0.06)"
          pointerEvents="none"
          zIndex={1}
        />
      </Box>
    </Box>
  );
});

export default function SkateDiceGame({ onClose, playRef }: Props) {
  const t = useTranslations();

  const [spinId, setSpinId] = useState(0);
  const [targets, setTargets] = useState<number[]>([0, 1, 0, 0]);
  const [trick, setTrick] = useState<string | null>(null);
  const [template, setTemplate] = useState("");
  const [typed, setTyped] = useState(0);
  const [ready, setReady] = useState(false); // intro finished → typing may run

  const spinningRef = useRef(false);
  const lastRollRef = useRef(0);
  const motionAskedRef = useRef(false);
  const rollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Opening line: desktop gets "press Space", touch devices may get "shake the phone".
  useEffect(() => {
    const touch = window.matchMedia?.("(pointer: coarse)").matches;
    const keys = touch
      ? Array.from({ length: PROMPT_COUNT }, (_, i) => `skateDice.prompt${i}`)
      : ["skateDice.prompt0", "skateDice.prompt1", "skateDice.promptDesktop"];
    setTemplate(t(keys[Math.floor(Math.random() * keys.length)]));
    const timer = setTimeout(() => setReady(true), 950);
    return () => clearTimeout(timer);
  }, [t]);

  useEffect(
    () => () => {
      if (rollTimerRef.current) clearTimeout(rollTimerRef.current);
    },
    []
  );

  const trickLabel = trick === SKATERS_CHOICE_SENTINEL ? t("skateDice.skatersChoice") : trick ?? "";
  const { before, after } = splitTemplate(template);
  const total = before.length + trickLabel.length + after.length;

  // Typing effect — runs once the intro is done and again for every new line.
  useEffect(() => {
    if (!ready || !template) return;
    setTyped(0);
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setTyped(n);
      if (n >= total) clearInterval(id);
    }, TYPE_MS);
    return () => clearInterval(id);
  }, [ready, template, trickLabel, total]);

  const roll = useCallback(() => {
    if (spinningRef.current) return;
    spinningRef.current = true;
    lastRollRef.current = Date.now();
    navigator.vibrate?.(30);

    const picks = SKATE_DICE.map((d) => Math.floor(Math.random() * d.faces.length));
    setTargets(picks);
    setSpinId((id) => id + 1);

    const totalMs = BASE_DURATION + (SKATE_DICE.length - 1) * STAGGER;
    // Only one roll runs at a time, so a single timer is enough.
    rollTimerRef.current = setTimeout(() => {
      rollTimerRef.current = null;
      spinningRef.current = false;
      navigator.vibrate?.([20, 40, 20]);
      setTrick(trickFromFaces(SKATE_DICE.map((d, i) => d.faces[picks[i]])));
      setTemplate(t(`skateDice.sentence${Math.floor(Math.random() * SENTENCE_COUNT)}`));
    }, totalMs + 80);
  }, [t]);

  // iOS only hands out motion events after a tap asks for them, so the first PLAY asks.
  const onPlay = () => {
    const DME = (typeof window !== "undefined" ? window.DeviceMotionEvent : undefined) as
      | (typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> })
      | undefined;
    if (!motionAskedRef.current && DME?.requestPermission) {
      motionAskedRef.current = true;
      DME.requestPermission().catch(() => {});
    }
    roll();
  };

  // Shake to roll on phones; desktops simply never fire the event.
  useEffect(() => {
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      if (Math.hypot(a.x, a.y, a.z) > SHAKE_G && Date.now() - lastRollRef.current > 1500) roll();
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [roll]);

  // Space bar rolls on desktop (a focused button already handles its own Space/Enter).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const el = e.target as HTMLElement;
      if (el.closest("button, input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
      roll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [roll]);

  const shownBefore = before.slice(0, Math.min(typed, before.length));
  const shownTrick = trickLabel.slice(0, Math.max(0, Math.min(typed - before.length, trickLabel.length)));
  const shownAfter = after.slice(0, Math.max(0, typed - before.length - trickLabel.length));
  const typing = typed < total;

  return (
    // Only very short screens (phones in landscape) scroll; taller ones keep the fixed layout.
    <Flex
      direction="column"
      h="100%"
      sx={{ "@media (max-height: 500px)": { overflowY: "auto", overscrollBehavior: "contain" } }}
      bg="#070709"
      color="white"
    >
      {/* Header */}
      <HStack justify="space-between" px={4} pt={4} pb={2} flexShrink={0}>
        <IconButton
          aria-label={t("common.back")}
          icon={<FaArrowLeft />}
          onClick={onClose}
          variant="ghost"
          color={GAME_GREEN}
          fontSize="22px"
          _hover={{ bg: "whiteAlpha.100" }}
        />
        <Text fontWeight="bold" fontSize={{ base: "2xl", md: "3xl" }} letterSpacing="0.12em" color={GAME_GREEN}>
          {t("skateDice.coachName")}
        </Text>
        <Box w="40px" />
      </HStack>

      {/* Reels + PLAY */}
      <Box px={5} pt={3} pb={5} position="relative" zIndex={3} flexShrink={0}>
        <Box
          bg="#0F0E11"
          borderRadius="22px"
          border="2px solid #1F1E24"
          p="14px"
        >
          <HStack spacing={2} align="stretch">
            {SKATE_DICE.map((die, i) => (
              <Reel
                key={die.key}
                die={die}
                targetIndex={targets[i]}
                spinId={spinId}
                duration={BASE_DURATION + i * STAGGER}
              />
            ))}
          </HStack>
        </Box>

        <Box
          as="button"
          ref={playRef}
          onClick={onPlay}
          mt="22px"
          w="100%"
          py={{ base: 4, md: 5 }}
          borderRadius="18px"
          bg={GAME_GREEN}
          color="black"
          display="flex"
          alignItems="center"
          justifyContent="center"
          gap={3}
          boxShadow={`0 0 24px ${GAME_GLOW}`}
          transition="transform 0.1s, box-shadow 0.2s"
          _hover={{ boxShadow: `0 0 34px ${GAME_GLOW_HOVER}` }}
          _active={{ transform: "scale(0.98)" }}
        >
          <FaDice size={26} />
          <Text as="span" color="black" fontWeight="bold" fontSize="2xl" letterSpacing="0.15em">
            {t("skateDice.play")}
          </Text>
        </Box>
      </Box>

      {/* Stage: matrix rain, Fred slides up, speech balloon types */}
      <Box
        flex="1"
        minH={{ base: 0, md: "360px" }}
        // On very short screens keep Fred visible and let the modal scroll to him.
        sx={{ "@media (max-height: 500px)": { minHeight: "260px" } }}
        position="relative"
        overflow="hidden"
      >
        <MatrixRain color={GAME_GREEN} />

        <motion.div
          initial={{ y: 420 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.65, ease: EASE_OUT_CUBIC }}
          style={{ position: "absolute", left: 0, right: 0, bottom: "-12%", aspectRatio: "8 / 7" }}
        >
          <Image
            src="/images/coach-fred.webp"
            alt={t("skateDice.coachAlt")}
            w="100%"
            h="100%"
            objectFit="contain"
            draggable={false}
            sx={{ imageRendering: "pixelated" }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.65, duration: 0.28 }}
          style={{ position: "absolute", top: 6, left: 16, right: 16, zIndex: 2 }}
        >
          <Box
            bg="white"
            borderRadius="26px"
            py={{ base: 4, md: "18px" }}
            px={{ base: 5, md: "22px" }}
            border="3px solid #0c0c0c"
            boxShadow="0 4px 8px rgba(0,0,0,0.5)"
            position="relative"
            _before={{
              content: '""',
              position: "absolute",
              bottom: "-18px",
              right: "70px",
              borderLeft: "14px solid transparent",
              borderRight: "14px solid transparent",
              borderTop: "18px solid #0c0c0c",
            }}
            _after={{
              content: '""',
              position: "absolute",
              bottom: "-12px",
              right: "73px",
              borderLeft: "11px solid transparent",
              borderRight: "11px solid transparent",
              borderTop: "14px solid #ffffff",
            }}
          >
            <Text as="span" position="absolute" w="1px" h="1px" overflow="hidden" sx={{ clip: "rect(0 0 0 0)" }} aria-live="polite">
              {before}
              {trickLabel}
              {after}
            </Text>
            <Text fontSize={{ base: "md", md: "lg" }} lineHeight="1.45" color="#15151a" minH="1.45em" aria-hidden>
              {shownBefore}
              {shownTrick && (
                <Text as="span" fontWeight="bold" color="#0a8f2c">
                  {shownTrick}
                </Text>
              )}
              {shownAfter}
              {typing && (
                <Text as="span" fontWeight="bold" color="#0a8f2c">
                  ▋
                </Text>
              )}
            </Text>
          </Box>
        </motion.div>
      </Box>
    </Flex>
  );
}
