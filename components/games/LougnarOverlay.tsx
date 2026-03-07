"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Text } from "@chakra-ui/react";
import HandheldThreeFrame from "./HandheldThreeFrame";

interface LougnarOverlayProps {
  children: React.ReactNode;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
  onClose?: () => void;
}

/**
 * Scales a 1280×720 iframe to fit container without cropping.
 * Forces iframe to real 1280×720 viewport via DOM manipulation.
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

  // Force iframe to 1280×720 via DOM (bypasses inline styles)
  useEffect(() => {
    if (!innerRef.current) return;
    const forceSize = () => {
      const iframe = innerRef.current?.querySelector("iframe");
      if (iframe) {
        iframe.style.width = "1280px";
        iframe.style.height = "720px";
        iframe.style.border = "none";
        iframe.style.display = "block";
      }
    };
    const mo = new MutationObserver(forceSize);
    mo.observe(innerRef.current, { childList: true, subtree: true });
    forceSize();
    return () => mo.disconnect();
  }, []);

  return (
    <Box
      ref={containerRef}
      position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)"
      w="88%" h="70%"
      borderRadius="4px" zIndex={1} overflow="hidden"
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
 * Lougnar Overlay — same industrial console as QFS
 * Only control: mouse click (jump)
 */
export default function LougnarOverlay({
  children,
  iframeRef,
  onClose,
}: LougnarOverlayProps) {
  const gameContainerRef = useRef<HTMLDivElement>(null);

  // Fullscreen — targets game container
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

      {/* Frame container — 16:9, expands on fullscreen */}
      <Box position="relative" zIndex={1} w={isFullscreen ? "100vw" : "min(1300px, 96vw)"} aspectRatio="16/9" mx="auto" top="50%" transform="translateY(-50%)" transition="width 0.2s">

        {/* Game iframe — 1280×720 scaled, BELOW 3D console */}
        <Box position="absolute" inset={0} zIndex={0}>
          <GameIframeContainer>
            {children}
          </GameIframeContainer>
        </Box>

        {/* Three.js Console — ON TOP visually, clicks pass through */}
        <Box position="absolute" inset={0} zIndex={1} pointerEvents="none">
          <HandheldThreeFrame variant="1btn" />
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

        {/* Hint: click game to jump */}
        <Box
          position="absolute" bottom="8%" left="50%" transform="translateX(-50%)" zIndex={10}
          pointerEvents="none" opacity={0.5}
        >
          <Text fontSize="xs" color="rgba(200,200,210,0.6)" textAlign="center">
            🖱️ Click to jump
          </Text>
        </Box>

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
