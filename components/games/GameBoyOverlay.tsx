"use client";

import React from "react";
import { Box, Text } from "@chakra-ui/react";

interface GameBoyOverlayProps {
  children: React.ReactNode;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
}

export default function GameBoyOverlay({ children, iframeRef }: GameBoyOverlayProps) {
  const sendKey = (key: string, action: 'down' | 'up' = 'down') => {
    if (!iframeRef?.current?.contentWindow) return;
    
    const event = new KeyboardEvent(action === 'down' ? 'keydown' : 'keyup', {
      key,
      code: key,
      bubbles: true,
      cancelable: true,
    });
    
    iframeRef.current.contentWindow.document.dispatchEvent(event);
  };

  const handleButtonPress = (key: string) => {
    sendKey(key, 'down');
    setTimeout(() => sendKey(key, 'up'), 100);
  };

  return (
    <Box
      position="relative"
      w="100%"
      maxW="1200px"
      mx="auto"
      aspectRatio="2/1"
      bg="linear-gradient(135deg, #7b68ee 0%, #6a5acd 50%, #5a4fb8 100%)"
      borderRadius="3xl"
      boxShadow="0 20px 60px rgba(0,0,0,0.5), inset 0 2px 8px rgba(255,255,255,0.15)"
      p={8}
    >
      {/* Power LED */}
      <Box
        position="absolute"
        top={6}
        right={8}
        w={3}
        h={3}
        borderRadius="full"
        bg="#00ff00"
        boxShadow="0 0 12px #00ff00"
      />

      {/* Screen area (center, larger) */}
      <Box
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        w="65%"
        h="70%"
        bg="#1a1a1a"
        borderRadius="lg"
        border="6px solid #0a0a0a"
        boxShadow="inset 0 6px 16px rgba(0,0,0,0.7)"
        overflow="hidden"
      >
        {/* Game iframe */}
        {children}
      </Box>

      {/* D-pad (left side) - FUNCTIONAL */}
      <Box
        position="absolute"
        bottom="20%"
        left="8%"
        w={24}
        h={24}
      >
        {/* Up */}
        <Box
          position="absolute"
          top={0}
          left="50%"
          transform="translateX(-50%)"
          w={8}
          h={10}
          bg="#1a1a2e"
          borderRadius="sm"
          cursor="pointer"
          transition="all 0.1s"
          _active={{ bg: "#0f0f1a", transform: "translateX(-50%) scale(0.95)" }}
          onClick={() => handleButtonPress('ArrowUp')}
        />
        {/* Down */}
        <Box
          position="absolute"
          bottom={0}
          left="50%"
          transform="translateX(-50%)"
          w={8}
          h={10}
          bg="#1a1a2e"
          borderRadius="sm"
          cursor="pointer"
          transition="all 0.1s"
          _active={{ bg: "#0f0f1a", transform: "translateX(-50%) scale(0.95)" }}
          onClick={() => handleButtonPress('ArrowDown')}
        />
        {/* Left */}
        <Box
          position="absolute"
          left={0}
          top="50%"
          transform="translateY(-50%)"
          w={10}
          h={8}
          bg="#1a1a2e"
          borderRadius="sm"
          cursor="pointer"
          transition="all 0.1s"
          _active={{ bg: "#0f0f1a", transform: "translateY(-50%) scale(0.95)" }}
          onClick={() => handleButtonPress('ArrowLeft')}
        />
        {/* Right */}
        <Box
          position="absolute"
          right={0}
          top="50%"
          transform="translateY(-50%)"
          w={10}
          h={8}
          bg="#1a1a2e"
          borderRadius="sm"
          cursor="pointer"
          transition="all 0.1s"
          _active={{ bg: "#0f0f1a", transform: "translateY(-50%) scale(0.95)" }}
          onClick={() => handleButtonPress('ArrowRight')}
        />
        {/* Center */}
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          w={8}
          h={8}
          bg="#0f0f1a"
          borderRadius="full"
          pointerEvents="none"
        />
      </Box>

      {/* A/B buttons (right side) - FUNCTIONAL */}
      <Box
        position="absolute"
        bottom="22%"
        right="8%"
        display="flex"
        gap={3}
      >
        <Box
          w={16}
          h={16}
          borderRadius="full"
          bg="#a855f7"
          border="3px solid #7e22ce"
          boxShadow="0 4px 8px rgba(0,0,0,0.4)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontSize="xl"
          fontWeight="bold"
          color="white"
          textShadow="0 1px 2px rgba(0,0,0,0.5)"
          cursor="pointer"
          transition="all 0.1s"
          _active={{ transform: "scale(0.9)", boxShadow: "0 2px 4px rgba(0,0,0,0.4)" }}
          onClick={() => handleButtonPress('x')}
        >
          B
        </Box>
        <Box
          w={16}
          h={16}
          borderRadius="full"
          bg="#a855f7"
          border="3px solid #7e22ce"
          boxShadow="0 4px 8px rgba(0,0,0,0.4)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontSize="xl"
          fontWeight="bold"
          color="white"
          textShadow="0 1px 2px rgba(0,0,0,0.5)"
          mt={-3}
          cursor="pointer"
          transition="all 0.1s"
          _active={{ transform: "scale(0.9)", boxShadow: "0 2px 4px rgba(0,0,0,0.4)" }}
          onClick={() => handleButtonPress('z')}
        >
          A
        </Box>
      </Box>

      {/* L/R shoulder buttons - FUNCTIONAL */}
      <Box
        position="absolute"
        top={2}
        left={6}
        fontSize="xs"
        fontWeight="bold"
        color="white"
        bg="#1a1a2e"
        px={3}
        py={1}
        borderRadius="md"
        boxShadow="0 2px 4px rgba(0,0,0,0.3)"
        cursor="pointer"
        transition="all 0.1s"
        _active={{ transform: "translateY(1px)", boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
        onClick={() => handleButtonPress('q')}
      >
        L
      </Box>
      <Box
        position="absolute"
        top={2}
        right={20}
        fontSize="xs"
        fontWeight="bold"
        color="white"
        bg="#1a1a2e"
        px={3}
        py={1}
        borderRadius="md"
        boxShadow="0 2px 4px rgba(0,0,0,0.3)"
        cursor="pointer"
        transition="all 0.1s"
        _active={{ transform: "translateY(1px)", boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
        onClick={() => handleButtonPress('e')}
      >
        R
      </Box>

      {/* START/SELECT buttons (below screen) - FUNCTIONAL */}
      <Box
        position="absolute"
        bottom="8%"
        left="50%"
        transform="translateX(-50%)"
        display="flex"
        gap={3}
      >
        <Box
          px={3}
          py={1}
          bg="#1a1a2e"
          borderRadius="full"
          fontSize="2xs"
          fontWeight="bold"
          color="white"
          boxShadow="0 2px 4px rgba(0,0,0,0.3)"
          cursor="pointer"
          transition="all 0.1s"
          _active={{ transform: "translateY(1px)", boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
          onClick={() => handleButtonPress('Shift')}
        >
          SELECT
        </Box>
        <Box
          px={3}
          py={1}
          bg="#1a1a2e"
          borderRadius="full"
          fontSize="2xs"
          fontWeight="bold"
          color="white"
          boxShadow="0 2px 4px rgba(0,0,0,0.3)"
          cursor="pointer"
          transition="all 0.1s"
          _active={{ transform: "translateY(1px)", boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
          onClick={() => handleButtonPress('Enter')}
        >
          START
        </Box>
      </Box>

      {/* Speaker grille (right side) */}
      <Box
        position="absolute"
        bottom="8%"
        right="4%"
        display="flex"
        flexDirection="column"
        gap={1}
      >
        {[...Array(6)].map((_, i) => (
          <Box
            key={i}
            w={16}
            h={0.5}
            bg="rgba(0,0,0,0.3)"
            borderRadius="full"
          />
        ))}
      </Box>
    </Box>
  );
}
