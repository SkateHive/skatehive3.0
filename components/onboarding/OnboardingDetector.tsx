"use client";

/**
 * OnboardingDetector
 *
 * - Auto-opens the OnboardingModal on first login (once per browser session).
 * - Shows a persistent floating card until all 3 steps are done.
 * - Bitmask: photo=1, bio=2, intro post=4 — all done when onboarding_step === 7.
 */

import { useEffect, useRef, useState } from "react";
import {
  Box,
  Flex,
  Text,
  Icon,
  IconButton,
  VStack,
  HStack,
  Button,
  useTheme,
} from "@chakra-ui/react";
import { FiCamera, FiFileText, FiEdit3, FiCheck, FiX } from "react-icons/fi";
import dynamic from "next/dynamic";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";
import {
  ONBOARDING_FLAG_PHOTO,
  ONBOARDING_FLAG_BIO,
  ONBOARDING_FLAG_POST,
  ONBOARDING_ALL_DONE,
  DICEBEAR_URL_PATTERN,
} from "./OnboardingModal";

const OnboardingModal = dynamic(() => import("./OnboardingModal"), { ssr: false });

// Accounts created before this date are excluded from onboarding.
const ONBOARDING_LAUNCH_DATE = new Date("2026-04-22");

// sessionStorage keys
const SS_SEEN = "onboarding_modal_seen"; // set after first auto-open
const SS_DONE = "onboarding_done";       // set immediately when modal finishes

function isLocallyDone() {
  return typeof window !== "undefined" && sessionStorage.getItem(SS_DONE) === "true";
}

export default function OnboardingDetector() {
  const { user } = useUserbaseAuth();
  const theme = useTheme();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCardDismissed, setIsCardDismissed] = useState(false);
  const hasAutoOpened = useRef(false);

  // ── Auto-open once per browser session for new users ─────────────────────
  useEffect(() => {
    if (!user) return;
    if (hasAutoOpened.current) return;

    const isDone = ((user.onboarding_step ?? 0) & ONBOARDING_ALL_DONE) === ONBOARDING_ALL_DONE || isLocallyDone();
    if (isDone) return;

    const alreadySeen = typeof window !== "undefined"
      ? sessionStorage.getItem(SS_SEEN) === "true"
      : false;

    if (!alreadySeen) {
      const timeout = setTimeout(() => {
        setIsModalOpen(true);
        sessionStorage.setItem(SS_SEEN, "true");
        hasAutoOpened.current = true;
      }, 1200);
      return () => clearTimeout(timeout);
    }

    hasAutoOpened.current = true;
  }, [user]);

  // ── Clean up SS_DONE once the server confirms onboarding_step === 7 ───────
  useEffect(() => {
    if (!user) return;
    if (((user.onboarding_step ?? 0) & ONBOARDING_ALL_DONE) === ONBOARDING_ALL_DONE) {
      sessionStorage.removeItem(SS_DONE);
    }
  }, [user]);

  // ── Reset on logout ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      hasAutoOpened.current = false;
      setIsCardDismissed(false);
      sessionStorage.removeItem(SS_SEEN);
      sessionStorage.removeItem(SS_DONE);
    }
  }, [user]);

  // ── Nothing to show ───────────────────────────────────────────────────────
  // isLoading intentionally excluded: background refreshes (focus/visibility
  // events) set isLoading=true while user stays non-null, which would unmount
  // the modal mid-flow and reset its state.
  if (!user) return null;

  // Only show onboarding for accounts created after the feature launch date.
  // Existing users are excluded without any database migration.
  const createdAt = new Date(user.created_at);
  if (isNaN(createdAt.getTime()) || createdAt < ONBOARDING_LAUNCH_DATE) return null;

  const step = user.onboarding_step ?? 0;
  const hasCustomAvatar = !!user.avatar_url && !user.avatar_url.includes(DICEBEAR_URL_PATTERN);
  const hasBio = !!user.bio?.trim();
  const effectiveStep = (hasCustomAvatar ? ONBOARDING_FLAG_PHOTO : 0)
    | (hasBio ? ONBOARDING_FLAG_BIO : 0)
    | step;
  const isDone = (effectiveStep & ONBOARDING_ALL_DONE) === ONBOARDING_ALL_DONE || isLocallyDone();
  if (isDone) return null;

  const items = [
    ...(!hasCustomAvatar ? [{ flag: ONBOARDING_FLAG_PHOTO, icon: FiCamera, label: "Add a photo" }] : []),
    ...(!hasBio ? [{ flag: ONBOARDING_FLAG_BIO, icon: FiFileText, label: "Write your bio" }] : []),
    { flag: ONBOARDING_FLAG_POST, icon: FiEdit3, label: "Intro post" },
  ];

  const pendingItems = items.filter(({ flag }) => !(effectiveStep & flag));
  const ctaLabel = pendingItems.length === 1 ? pendingItems[0].label : "finish setup";

  const bgColor = theme.colors.panel || theme.colors.background;
  const borderColor = theme.colors.border;
  const dimColor = theme.colors.dim;

  return (
    <>
      {/* Modal */}
      <OnboardingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Floating card — hidden when dismissed for session OR when modal is open */}
      {!isCardDismissed && !isModalOpen && (
        <Box
          position="fixed"
          bottom={{ base: "70px", md: "24px" }}
          right="16px"
          zIndex={1400}
          bg={bgColor}
          border="1px solid"
          borderColor={borderColor}
          borderRadius="md"
          boxShadow="lg"
          w="200px"
          overflow="hidden"
        >
          {/* Header */}
          <Flex
            align="center"
            justify="space-between"
            px={3}
            py={1.5}
            bg={bgColor}
            borderBottom="1px solid"
            borderColor={borderColor}
          >
            <Text fontSize="2xs" color={dimColor} fontFamily="mono">
              profile.sh
            </Text>
            <IconButton
              aria-label="Dismiss"
              icon={<Icon as={FiX} boxSize={3} />}
              size="xs"
              variant="ghost"
              minW="auto"
              h="auto"
              p={0}
              color={dimColor}
              onClick={() => setIsCardDismissed(true)}
            />
          </Flex>

          {/* Steps checklist */}
          <VStack align="stretch" spacing={0} px={3} py={2}>
            {items.map(({ flag, icon, label }) => {
              const done = Boolean(effectiveStep & flag);
              return (
                <HStack key={flag} spacing={2} py={1}>
                  <Icon
                    as={done ? FiCheck : icon}
                    boxSize={3.5}
                    color={done ? "green.400" : "orange.400"}
                    flexShrink={0}
                  />
                  <Text
                    fontSize="xs"
                    fontFamily="mono"
                    color={done ? "green.400" : "text"}
                    textDecoration={done ? "line-through" : "none"}
                    opacity={done ? 0.6 : 1}
                  >
                    {label}
                  </Text>
                  {!done && (
                    <Text fontSize="2xs" color="orange.400" fontFamily="mono" ml="auto">
                      pending
                    </Text>
                  )}
                </HStack>
              );
            })}
          </VStack>

          {/* CTA */}
          <Box px={3} pb={3}>
            <Button
              size="xs"
              w="full"
              colorScheme="orange"
              fontFamily="mono"
              onClick={() => setIsModalOpen(true)}
            >
              {ctaLabel}
            </Button>
          </Box>
        </Box>
      )}
    </>
  );
}
