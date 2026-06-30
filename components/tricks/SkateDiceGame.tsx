"use client";

import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  HStack,
  Image,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  ModalHeader,
  Text,
  VStack,
} from "@chakra-ui/react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "@/contexts/LocaleContext";
import { SKATE_DICE, randomFace, trickFromFaces } from "@/lib/utils/skateDiceData";
import { PROMPT_COUNT, SENTENCE_COUNT, splitTemplate } from "@/lib/utils/skateSentences";

const SPIN_MS = 800;
const STAGGER_MS = 400;
const TICK_MS = 90;

interface Props {
  onClose: () => void;
}

export default function SkateDiceGame({ onClose }: Props) {
  const t = useTranslations();

  const [rollCount, setRollCount] = useState(0);
  const [displayFaces, setDisplayFaces] = useState<string[]>(
    SKATE_DICE.map((d) => d.faces[0])
  );
  const [isRolling, setIsRolling] = useState(false);
  const [landed, setLanded] = useState<boolean[]>([true, true, true, true]);
  const [result, setResult] = useState<{
    trick: string;
    sentenceIdx: number;
  } | null>(null);
  const [promptIdx] = useState(() => Math.floor(Math.random() * PROMPT_COUNT));

  // Refs to avoid stale closures inside setInterval / setTimeout
  const finalFacesRef = useRef<string[]>(SKATE_DICE.map((d) => d.faces[0]));
  const landedRef = useRef<boolean[]>([true, true, true, true]);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timeoutsRef.current.forEach(clearTimeout);
    },
    []
  );

  // Rapidly cycle non-landed die faces while rolling
  useEffect(() => {
    if (!isRolling) return;
    const id = setInterval(() => {
      setDisplayFaces(
        SKATE_DICE.map((die, i) =>
          landedRef.current[i]
            ? finalFacesRef.current[i]
            : die.faces[Math.floor(Math.random() * die.faces.length)]
        )
      );
    }, TICK_MS);
    return () => clearInterval(id);
  }, [isRolling]);

  const roll = () => {
    if (isRolling) return;
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    const finals = SKATE_DICE.map(randomFace);
    finalFacesRef.current = finals;

    const initLanded: boolean[] = [false, false, false, false];
    landedRef.current = [...initLanded];
    setLanded([...initLanded]);
    setIsRolling(true);
    setResult(null);
    setRollCount((c) => c + 1);

    // Land each die in sequence with STAGGER_MS offset
    SKATE_DICE.forEach((_, i) => {
      const tid = setTimeout(() => {
        landedRef.current[i] = true;
        setLanded((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
        setDisplayFaces((prev) => {
          const next = [...prev];
          next[i] = finals[i];
          return next;
        });
      }, SPIN_MS + i * STAGGER_MS);
      timeoutsRef.current.push(tid);
    });

    // Show result after the last die lands
    const resultDelay = SPIN_MS + (SKATE_DICE.length - 1) * STAGGER_MS + 300;
    const rid = setTimeout(() => {
      setIsRolling(false);
      setResult({
        trick: trickFromFaces(finals),
        sentenceIdx: Math.floor(Math.random() * SENTENCE_COUNT),
      });
    }, resultDelay);
    timeoutsRef.current.push(rid);
  };

  const renderTaunt = (trickName: string, sentenceIdx: number) => {
    const template = t(`skateDice.sentence${sentenceIdx}`);
    const { before, after } = splitTemplate(template);
    return (
      <>
        {before}
        <Text as="span" color="primary" fontWeight="bold">
          {trickName}
        </Text>
        {after}
      </>
    );
  };

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <ModalHeader
        borderBottom="1px solid"
        borderColor="muted"
        pb={3}
        pt={4}
        px={4}
      >
        <HStack spacing={2}>
          <Image
            src="/images/skatehive-coach.png"
            alt=""
            boxSize="26px"
            objectFit="contain"
          />
          <Text color="primary" fontWeight="bold" fontSize="md">
            {t("skateDice.title")}
          </Text>
        </HStack>
      </ModalHeader>
      <ModalCloseButton color="dim" onClick={onClose} />

      {/* ── Body: reels + result ────────────────────────────────────────────── */}
      <ModalBody px={4} py={5}>
        {/* Dice reels */}
        <HStack spacing={2} justify="center" mb={5}>
          {SKATE_DICE.map((die, i) => {
            const isActive = isRolling && !landed[i];
            return (
              <VStack key={die.key} spacing={1} align="center">
                <Text
                  fontSize="9px"
                  color="dim"
                  textTransform="uppercase"
                  letterSpacing="wider"
                >
                  {die.key}
                </Text>

                {/* Landing pop: new key per land event triggers the scale keyframe */}
                <motion.div
                  key={`${die.key}-${rollCount}-${landed[i] ? "l" : "s"}`}
                  animate={
                    landed[i] && rollCount > 0 ? { scale: [1.3, 0.85, 1] } : {}
                  }
                  transition={{ duration: 0.3, ease: "backOut" }}
                >
                  <Box
                    w="62px"
                    h="62px"
                    bg="muted"
                    border="1px solid"
                    borderColor={isActive ? "primary" : "muted"}
                    borderRadius="none"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    textAlign="center"
                    p={1}
                    transition="border-color 0.15s"
                  >
                    {/* Shake while spinning */}
                    <motion.div
                      animate={isActive ? { y: [-3, 3, -3] } : { y: 0 }}
                      transition={{
                        duration: 0.15,
                        repeat: isActive ? Infinity : 0,
                        ease: "linear",
                      }}
                    >
                      <Text
                        fontSize="11px"
                        fontWeight="bold"
                        color={
                          displayFaces[i] === "SK8" || displayFaces[i] === "✗"
                            ? "dim"
                            : "text"
                        }
                        lineHeight={1.2}
                      >
                        {displayFaces[i]}
                      </Text>
                    </motion.div>
                  </Box>
                </motion.div>
              </VStack>
            );
          })}
        </HStack>

        {/* Result speech bubble or idle prompt */}
        <AnimatePresence exitBeforeEnter>
          {result ? (
            <motion.div
              key={`result-${rollCount}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <Box
                border="1px solid"
                borderColor="muted"
                borderRadius="none"
                p={4}
                textAlign="center"
              >
                <Text fontSize="lg" fontWeight="bold" color="primary" mb={2}>
                  {result.trick}
                </Text>
                <Text fontSize="sm" color="text">
                  {renderTaunt(result.trick, result.sentenceIdx)}
                </Text>
              </Box>
            </motion.div>
          ) : (
            <motion.div
              key="prompt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Text fontSize="sm" color="dim" textAlign="center" px={2}>
                {t(`skateDice.prompt${promptIdx}`)}
              </Text>
            </motion.div>
          )}
        </AnimatePresence>
      </ModalBody>

      {/* ── Footer: action buttons ──────────────────────────────────────────── */}
      <ModalFooter
        borderTop="1px solid"
        borderColor="muted"
        px={4}
        py={3}
        gap={2}
      >
        {result ? (
          <Button
            onClick={roll}
            isDisabled={isRolling}
            variant="outline"
            borderRadius="none"
            borderColor="muted"
            color="text"
            _hover={{ borderColor: "primary", color: "primary" }}
            flex={1}
          >
            {t("skateDice.rollAgain")}
          </Button>
        ) : (
          <Button
            onClick={roll}
            isDisabled={isRolling}
            bg="primary"
            color="background"
            borderRadius="none"
            _hover={{ opacity: 0.85 }}
            _disabled={{ opacity: 0.5 }}
            flex={1}
          >
            {t("skateDice.play")}
          </Button>
        )}
      </ModalFooter>
    </>
  );
}
