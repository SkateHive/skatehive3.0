"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Box,
  HStack,
  VStack,
  Text,
  Button,
  CloseButton,
  Image,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { APP_CONFIG } from "@/config/app.config";

const APP_STORE_URL = APP_CONFIG.APP_STORE_URL;
const BANNER_DISMISSED_KEY = "ios_app_banner_dismissed_until";
const DISMISS_DURATION_DAYS = 7;

// Set to true to test on any device during development
// In production, this is always false and banner only shows on iPhone (non-Safari)
const DEBUG_FORCE_SHOW = false; // Change to `process.env.NODE_ENV === "development"` to test on any device

// Slide down animation
const slideDown = keyframes`
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

export default function IOSAppBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Only run on client
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return;
    }

    const ua = navigator.userAgent;

    // Check if iOS device (iPhone or iPad)
    const isIOS =
      /iPhone|iPad/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPad with iPadOS 13+

    // Check if Safari - Safari has the native smart app banner from meta tag
    // Safari UA contains "Safari" but NOT "CriOS" (Chrome) or "FxiOS" (Firefox)
    const isSafari =
      /Safari/i.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/i.test(ua);

    // Skip if not iOS (unless debug mode)
    if (!isIOS && !DEBUG_FORCE_SHOW) return;

    // Skip if Safari on iOS - it will use the native meta tag banner
    if (isIOS && isSafari && !DEBUG_FORCE_SHOW) return;

    // Check if user is already in the native app (standalone mode)
    const isStandalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;

    if (isStandalone) return;

    // Check if banner was dismissed
    const dismissedUntil = localStorage.getItem(BANNER_DISMISSED_KEY);
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil)) {
      return;
    }

    // Show banner with a slight delay for better UX
    const timer = setTimeout(() => {
      setIsVisible(true);
      setIsAnimating(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = useCallback(() => {
    // Dismiss for 7 days
    const dismissUntil =
      Date.now() + DISMISS_DURATION_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(BANNER_DISMISSED_KEY, dismissUntil.toString());
    setIsAnimating(false);

    // Wait for fade out animation
    setTimeout(() => setIsVisible(false), 300);
  }, []);

  const handleOpenAppStore = useCallback(() => {
    window.open(APP_STORE_URL, "_blank");
  }, []);

  if (!isVisible) return null;

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bg="rgba(0, 0, 0, 0.95)"
      borderBottom="1px solid #333"
      zIndex={9999}
      animation={isAnimating ? `${slideDown} 0.3s ease-out` : undefined}
      opacity={isAnimating ? 1 : 0}
      transition="opacity 0.3s ease-out"
      backdropFilter="blur(10px)"
      sx={{
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <HStack
        px={3}
        py={2.5}
        spacing={3}
        justify="space-between"
        align="center"
      >
        {/* Close button */}
        <CloseButton
          size="sm"
          color="gray.400"
          _hover={{ color: "white" }}
          onClick={handleDismiss}
          aria-label="Close"
        />

        {/* App icon and info */}
        <HStack spacing={3} flex={1}>
          <Image
            src="/logos/skatehive-logo-rounded.png"
            alt="Skatehive"
            boxSize="40px"
            borderRadius="10px"
            fallbackSrc="/SKATE_HIVE_VECTOR_FIN.svg"
          />

          <VStack align="start" spacing={0}>
            <Text
              color="white"
              fontWeight="bold"
              fontSize="sm"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              SKATEHIVE
            </Text>
            <Text
              color="gray.400"
              fontSize="xs"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              The Infinity Mag
            </Text>
            <HStack spacing={0.5}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Box
                  key={star}
                  as="span"
                  color="#FFD700"
                  fontSize="10px"
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  ★
                </Box>
              ))}
              <Text
                fontSize="xs"
                color="gray.500"
                ml={1}
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                FREE
              </Text>
            </HStack>
          </VStack>
        </HStack>

        {/* GET button - Apple style */}
        <Button
          size="sm"
          bg="#007AFF"
          color="white"
          fontWeight="bold"
          fontSize="sm"
          px={5}
          borderRadius="full"
          _hover={{ bg: "#0056CC" }}
          _active={{ transform: "scale(0.95)" }}
          onClick={handleOpenAppStore}
        >
          GET
        </Button>
      </HStack>
    </Box>
  );
}
