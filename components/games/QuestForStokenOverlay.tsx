"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Text } from "@chakra-ui/react";
import HandheldThreeFrame from "./HandheldThreeFrame";

interface QuestForStokenOverlayProps {
  children: React.ReactNode;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
  onClose?: () => void;
}

/**
 * Scales a 1280×720 iframe to fit its container without cropping.
 * The game canvas is fixed at 1280×720 with position:absolute centering.
 * We give the iframe a real 1280×720 viewport, then visually scale it down.
 */
function GameIframeContainer({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const sw = rect.width / 1280;
      const sh = rect.height / 720;
      setScale(Math.min(sw, sh));
    };
    update();
    window.addEventListener("resize", update);
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => { window.removeEventListener("resize", update); ro.disconnect(); };
  }, []);

  // Force iframe to 1280×720 via DOM (bypasses inline styles from GameModal)
  useEffect(() => {
    if (!innerRef.current) return;
    const mo = new MutationObserver(() => {
      const iframe = innerRef.current?.querySelector("iframe");
      if (iframe) {
        iframe.style.width = "1280px";
        iframe.style.height = "720px";
        iframe.style.border = "none";
        iframe.style.display = "block";
      }
    });
    mo.observe(innerRef.current, { childList: true, subtree: true });
    // Also apply immediately
    const iframe = innerRef.current.querySelector("iframe");
    if (iframe) {
      iframe.style.width = "1280px";
      iframe.style.height = "720px";
      iframe.style.border = "none";
      iframe.style.display = "block";
    }
    return () => mo.disconnect();
  }, []);

  return (
    <Box
      ref={containerRef}
      position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)"
      w="55%" sx={{ aspectRatio: "16 / 9" }}
      borderRadius="4px" zIndex={1} bg="#000" overflow="hidden"
    >
      <Box
        ref={innerRef}
        position="absolute"
        top="50%" left="50%"
        w="1280px" h="720px"
        style={{
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

/**
 * Console V7 — no-crop iframe scaling + game-only fullscreen
 */
export default function QuestForStokenOverlay({
  children,
  iframeRef,
  onClose,
}: QuestForStokenOverlayProps) {
  const gameContainerRef = useRef<HTMLDivElement>(null);

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

  // Fullscreen — targets the game container, not the browser
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = useCallback(() => {
    const target = gameContainerRef.current || document.documentElement;
    if (!document.fullscreenElement) {
      target.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
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
    <Box ref={gameContainerRef} position="relative" w="100%" h="100%" overflow="hidden">
      {/* Backdrop — blur + almost transparent */}
      <Box position="absolute" inset={0} bg="rgba(0,0,0,0.25)" backdropFilter="blur(28px)" />

      {/* Frame container — 16:9 */}
      <Box position="relative" zIndex={1} w="min(1300px, 96vw)" aspectRatio="16/9" mx="auto" top="50%" transform="translateY(-50%)">

        {/* Three.js Canvas */}
        <Box position="absolute" inset={0} zIndex={0} pointerEvents="none">
          <HandheldThreeFrame />
        </Box>

        {/* Game iframe — 1280×720 scaled to fit */}
        <GameIframeContainer>
          {children}
        </GameIframeContainer>

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

        {/* Fullscreen button — fullscreens the game, not the browser */}
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
