"use client";

import React from "react";
import { Box, Text } from "@chakra-ui/react";
import LougnarThreeFrame from "./LougnarThreeFrame";

interface LougnarOverlayProps {
  children: React.ReactNode;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
  onClose?: () => void;
}

export default function LougnarOverlay({ children, iframeRef, onClose }: LougnarOverlayProps) {
  return (
    <Box position="relative" w="100%" h="100%" overflow="hidden">
      {/* Backdrop */}
      <Box
        position="absolute"
        inset={0}
        bgGradient="radial(circle at 50% 35%, rgba(255,100,0,0.25), transparent 55%), radial(circle at 50% 75%, rgba(0,150,255,0.12), transparent 60%), linear-gradient(135deg, #08080e 0%, #0c0c14 50%, #08080e 100%)"
      />
      
      {/* Vignette */}
      <Box
        position="absolute"
        inset={0}
        bgGradient="radial(circle at 50% 50%, transparent 35%, rgba(0,0,0,0.9) 90%)"
        pointerEvents="none"
      />

      {/* Frame container */}
      <Box
        position="relative"
        zIndex={1}
        w="min(1280px, 94vw)"
        aspectRatio="16/9"
        mx="auto"
        top="50%"
        transform="translateY(-50%)"
      >
        {/* Layer 0: Three.js */}
        <Box position="absolute" inset="-40px" zIndex={0} pointerEvents="none">
          <LougnarThreeFrame />
        </Box>

        {/* Layer 1: Game iframe — LARGE */}
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          w="72%"
          h="82%"
          borderRadius="12px"
          overflow="hidden"
          zIndex={1}
          bg="#000"
        >
          {children}
        </Box>

        {/* Layer 2: Close button */}
        {onClose && (
          <Box
            as="button"
            onClick={onClose}
            position="absolute"
            top="12px"
            right="12px"
            zIndex={20}
            w="44px"
            h="44px"
            borderRadius="full"
            bg="rgba(60,60,70,0.9)"
            border="2px solid rgba(255,140,0,0.7)"
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            transition="all 0.2s"
            boxShadow="0 0 15px rgba(255,100,0,0.3)"
            _hover={{
              bg: "rgba(255,100,0,0.4)",
              boxShadow: "0 0 30px rgba(255,100,0,0.6)",
              transform: "scale(1.08)",
            }}
          >
            <Text fontSize="xl" fontWeight="black" color="white">
              ✕
            </Text>
          </Box>
        )}

        {/* Layer 3: JUMP button — bottom center, large */}
        <Box
          position="absolute"
          bottom="20px"
          left="50%"
          transform="translateX(-50%)"
          zIndex={10}
          display="flex"
          flexDirection="column"
          alignItems="center"
          gap={1}
        >
          <Box
            as="button"
            w="160px"
            h="56px"
            borderRadius="full"
            bg="linear-gradient(135deg, rgba(255,100,0,0.4), rgba(255,140,0,0.2))"
            border="2px solid rgba(255,140,0,0.6)"
            display="flex"
            alignItems="center"
            justifyContent="center"
            gap={2}
            cursor="pointer"
            transition="all 0.1s"
            boxShadow="0 0 20px rgba(255,100,0,0.3), inset 0 0 20px rgba(255,255,255,0.05)"
            _hover={{
              bg: "rgba(255,100,0,0.5)",
              boxShadow: "0 0 40px rgba(255,100,0,0.6)",
            }}
            _active={{
              transform: "scale(0.95)",
              boxShadow: "0 0 50px rgba(255,100,0,0.8)",
            }}
            onClick={() => {
              // Send click event to iframe
              if (iframeRef?.current?.contentWindow) {
                try {
                  const clickEvent = new MouseEvent("click", {
                    bubbles: true,
                    cancelable: true,
                  });
                  iframeRef.current.contentWindow.document.dispatchEvent(clickEvent);
                } catch (e) {
                  console.error("Click dispatch failed:", e);
                }
              }
            }}
          >
            <Text
              fontSize="xl"
              fontWeight="black"
              color="#ff8c00"
              textShadow="0 0 10px rgba(255,100,0,0.8)"
            >
              🖱️ JUMP
            </Text>
          </Box>
          <Text fontSize="xs" color="rgba(255,200,150,0.6)">
            or click screen
          </Text>
        </Box>

        {/* Layer 4: Top hint */}
        <Box
          position="absolute"
          top="16px"
          left="50%"
          transform="translateX(-50%)"
          zIndex={10}
          bg="rgba(0,0,0,0.5)"
          px={4}
          py={2}
          borderRadius="full"
          border="1px solid rgba(255,140,0,0.2)"
        >
          <Text
            fontSize="sm"
            color="rgba(255,200,150,0.8)"
            fontWeight="bold"
            letterSpacing="wider"
          >
            🚀 CLICK TO JUMP
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
