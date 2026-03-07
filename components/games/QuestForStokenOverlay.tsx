"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Box, Text } from "@chakra-ui/react";
import HandheldThreeFrame from "./HandheldThreeFrame";

interface QuestForStokenOverlayProps {
  children: React.ReactNode;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
  onClose?: () => void;
}

type ControlKey = {
  label: string;
  key: string;
  code: string;
};

/**
 * Console V6 — 3D-only controls, no overlay buttons
 * Keyboard logic preserved for input dispatch
 */
export default function QuestForStokenOverlay({
  children,
  iframeRef,
  onClose,
}: QuestForStokenOverlayProps) {
  // Keyboard input dispatch to iframe
  const sendKey = (code: string, key: string, action: "down" | "up") => {
    if (!iframeRef?.current?.contentWindow) return;
    const event = new KeyboardEvent(action === "down" ? "keydown" : "keyup", {
      key, code, bubbles: true, cancelable: true,
    });
    try {
      iframeRef.current.contentWindow.document.dispatchEvent(event);
      iframeRef.current.contentWindow.dispatchEvent(event);
    } catch (e) { /* cross-origin */ }
  };

  // Forward keyboard events to iframe
  useEffect(() => {
    const forwardKeys = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "Space", "KeyO", "KeyJ", "KeyK", "KeyL"]);
    const handleDown = (e: KeyboardEvent) => {
      if (forwardKeys.has(e.code)) sendKey(e.code, e.key, "down");
    };
    const handleUp = (e: KeyboardEvent) => {
      if (forwardKeys.has(e.code)) sendKey(e.code, e.key, "up");
    };
    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);
    return () => {
      window.removeEventListener("keydown", handleDown);
      window.removeEventListener("keyup", handleUp);
    };
  });

  // Fullscreen toggle
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") { e.preventDefault(); toggleFullscreen(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [toggleFullscreen]);

  return (
    <Box position="relative" w="100%" h="100%" overflow="hidden">
      {/* Backdrop — blur + almost transparent */}
      <Box position="absolute" inset={0} bg="rgba(0,0,0,0.45)" backdropFilter="blur(24px)" />

      {/* Frame container — 16:9 */}
      <Box position="relative" zIndex={1} w="min(1300px, 96vw)" aspectRatio="16/9" mx="auto" top="50%" transform="translateY(-50%)">

        {/* Three.js Canvas */}
        <Box position="absolute" inset={0} zIndex={0} pointerEvents="none">
          <HandheldThreeFrame />
        </Box>

        {/* Game iframe — 16:9, sized to fill 3D screen recess without cropping */}
        <Box
          position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)"
          w="55%" sx={{ aspectRatio: "16 / 9" }}
          borderRadius="4px" zIndex={1} bg="#000"
          css={{ "& iframe": { width: "100%", height: "100%", border: "none" } }}
        >
          {children}
        </Box>

        {/* Close button */}
        {onClose && (
          <Box
            as="button" onClick={onClose}
            position="absolute" top="10px" right="10px" zIndex={20}
            w="32px" h="32px" borderRadius="full"
            bg="rgba(30,30,40,0.75)" border="1px solid rgba(60,60,80,0.4)"
            display="flex" alignItems="center" justifyContent="center"
            cursor="pointer" transition="all 0.15s" opacity={0.6}
            _hover={{ opacity: 1, bg: "rgba(60,60,80,0.7)" }}
          >
            <Text fontSize="sm" fontWeight="bold" color="rgba(200,200,210,0.85)">✕</Text>
          </Box>
        )}

        {/* Fullscreen button */}
        <Box
          as="button" onClick={toggleFullscreen}
          position="absolute" top="48px" right="10px" zIndex={20}
          w="32px" h="32px" borderRadius="full"
          bg="rgba(30,30,40,0.75)" border="1px solid rgba(60,60,80,0.4)"
          display="flex" alignItems="center" justifyContent="center"
          cursor="pointer" transition="all 0.15s" opacity={0.6}
          _hover={{ opacity: 1, bg: "rgba(60,60,80,0.7)" }}
          title={isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
        >
          <Text fontSize="xs" color="rgba(200,200,210,0.85)">{isFullscreen ? "⊡" : "⛶"}</Text>
        </Box>
      </Box>
    </Box>
  );
}
