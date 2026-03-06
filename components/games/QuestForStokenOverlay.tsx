"use client";

import React from "react";
import { Box, Text } from "@chakra-ui/react";

interface QuestForStokenOverlayProps {
  children: React.ReactNode;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
  onClose?: () => void;
}

type ControlKey = {
  label: string;
  key: string;
  code: string;
  hint?: string;
  color?: string;
};

/**
 * ROG Ally / Steam Deck style overlay for Quest for Stoken
 * Modern handheld gaming aesthetic with neon accents
 */
export default function QuestForStokenOverlay({
  children,
  iframeRef,
  onClose,
}: QuestForStokenOverlayProps) {
  const sendKey = (k: ControlKey, action: "down" | "up" = "down") => {
    if (!iframeRef?.current?.contentWindow) {
      console.warn('Iframe not ready');
      return;
    }

    const event = new KeyboardEvent(action === "down" ? "keydown" : "keyup", {
      key: k.key,
      code: k.code,
      bubbles: true,
      cancelable: true,
    });

    // Try multiple targets for better compatibility
    try {
      iframeRef.current.contentWindow.document.dispatchEvent(event);
      iframeRef.current.contentWindow.dispatchEvent(event);
      console.log(`Sent ${action} for key ${k.label}`);
    } catch (e) {
      console.error('Failed to send key:', e);
    }
  };

  const tap = (k: ControlKey) => {
    sendKey(k, "down");
    setTimeout(() => sendKey(k, "up"), 90);
  };

  const MOVE_KEYS: ControlKey[] = [
    { label: "W", key: "w", code: "KeyW" },
    { label: "A", key: "a", code: "KeyA" },
    { label: "S", key: "s", code: "KeyS" },
    { label: "D", key: "d", code: "KeyD" },
  ];

  const SPACE_KEY: ControlKey = {
    label: "SPACE",
    key: " ",
    code: "Space",
    hint: "Jump",
  };

  const ACTION_KEYS: ControlKey[] = [
    { label: "O", key: "o", code: "KeyO", hint: "Block", color: "#a7ff00" },
    { label: "J", key: "j", code: "KeyJ", hint: "Attack", color: "#00d4ff" },
    { label: "K", key: "k", code: "KeyK", hint: "Action", color: "#ff00ff" },
    { label: "L", key: "l", code: "KeyL", hint: "Dash", color: "#ffaa00" },
  ];

  return (
    <Box
      position="relative"
      w="100%"
      aspectRatio="16/9"
      bgGradient="linear(135deg, #0f0f1a 0%, #1a1a3e 50%, #0f0f1a 100%)"
      display="flex"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      borderRadius="lg"
    >
      {/* Ambient glow */}
      <Box
        position="absolute"
        inset={0}
        bgGradient="radial(circle at 30% 50%, rgba(138,43,226,0.25), transparent 50%), radial(circle at 70% 50%, rgba(167,255,0,0.15), transparent 50%)"
        pointerEvents="none"
      />

      {/* Screen container */}
      <Box
        position="relative"
        w="100%"
        h="100%"
        bg="#000"
        borderRadius="md"
        overflow="hidden"
        boxShadow="0 0 60px rgba(138,43,226,0.3), 0 0 120px rgba(0,191,255,0.2)"
      >
        {/* Close button */}
        {onClose && (
          <Box
            as="button"
            onClick={onClose}
            position="absolute"
            top="20px"
            right="20px"
            zIndex={20}
            w="50px"
            h="50px"
            borderRadius="full"
            bg="rgba(60,60,90,0.9)"
            border="2px solid rgba(167,255,0,0.7)"
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            transition="all 0.2s"
            boxShadow="0 0 20px rgba(138,43,226,0.4), inset 0 0 15px rgba(255,255,255,0.1)"
            _hover={{
              bg: "rgba(138,43,226,0.6)",
              borderColor: "rgba(167,255,0,1)",
              boxShadow: "0 0 40px rgba(167,255,0,0.8)",
              transform: "scale(1.08)",
            }}
            _active={{
              transform: "scale(0.92)",
              boxShadow: "0 0 50px rgba(167,255,0,1)",
            }}
          >
            <Text fontSize="2xl" fontWeight="black" color="white" textShadow="0 0 10px rgba(167,255,0,0.9)">
              ✕
            </Text>
          </Box>
        )}

        {/* Game iframe */}
        <Box position="absolute" inset={0} zIndex={1}>
          {children}
        </Box>

        {/* Left controls (D-pad + Space) */}
        <Box
          position="absolute"
          bottom="40px"
          left="60px"
          zIndex={10}
          display="flex"
          flexDirection="column"
          gap={4}
        >
          {/* D-pad */}
          <Box position="relative" w="140px" h="140px">
            {/* D-pad background glow */}
            <Box
              position="absolute"
              inset={0}
              bg="radial-gradient(circle, rgba(138,43,226,0.2), transparent 70%)"
              filter="blur(20px)"
            />

            {/* D-pad buttons */}
            <Box
              position="relative"
              display="grid"
              gridTemplateColumns="repeat(3, 1fr)"
              gridTemplateRows="repeat(3, 1fr)"
              gap="2px"
              w="100%"
              h="100%"
            >
              {/* Empty corner */}
              <Box />

              {/* W (Up) */}
              <Box
                as="button"
                onClick={() => tap(MOVE_KEYS[0])}
                bg="linear-gradient(135deg, rgba(80,80,120,0.8), rgba(138,43,226,0.4))"
                borderRadius="md"
                border="2px solid rgba(167,255,0,0.6)"
                display="flex"
                alignItems="center"
                justifyContent="center"
                cursor="pointer"
                transition="all 0.1s"
                boxShadow="0 0 10px rgba(138,43,226,0.3), inset 0 0 20px rgba(255,255,255,0.1)"
                _hover={{
                  bg: "linear-gradient(135deg, rgba(120,120,180,0.9), rgba(138,43,226,0.6))",
                  borderColor: "rgba(167,255,0,0.9)",
                  boxShadow: "0 0 20px rgba(138,43,226,0.6)",
                }}
                _active={{
                  bg: "rgba(138,43,226,0.7)",
                  transform: "scale(0.95)",
                  boxShadow: "0 0 30px rgba(167,255,0,0.8)",
                }}
              >
                <Text fontSize="xl" fontWeight="black" color="white" textShadow="0 0 8px rgba(167,255,0,0.8)">
                  W
                </Text>
              </Box>

              {/* Empty corner */}
              <Box />

              {/* A (Left) */}
              <Box
                as="button"
                onClick={() => tap(MOVE_KEYS[1])}
                bg="linear-gradient(135deg, rgba(80,80,120,0.8), rgba(138,43,226,0.4))"
                borderRadius="md"
                border="2px solid rgba(167,255,0,0.6)"
                display="flex"
                alignItems="center"
                justifyContent="center"
                cursor="pointer"
                transition="all 0.1s"
                boxShadow="0 0 10px rgba(138,43,226,0.3), inset 0 0 20px rgba(255,255,255,0.1)"
                _hover={{
                  bg: "linear-gradient(135deg, rgba(120,120,180,0.9), rgba(138,43,226,0.6))",
                  borderColor: "rgba(167,255,0,0.9)",
                  boxShadow: "0 0 20px rgba(138,43,226,0.6)",
                }}
                _active={{
                  bg: "rgba(138,43,226,0.7)",
                  transform: "scale(0.95)",
                  boxShadow: "0 0 30px rgba(167,255,0,0.8)",
                }}
              >
                <Text fontSize="xl" fontWeight="black" color="white" textShadow="0 0 8px rgba(167,255,0,0.8)">
                  A
                </Text>
              </Box>

              {/* S (Down) */}
              <Box
                as="button"
                onClick={() => tap(MOVE_KEYS[2])}
                bg="linear-gradient(135deg, rgba(80,80,120,0.8), rgba(138,43,226,0.4))"
                borderRadius="md"
                border="2px solid rgba(167,255,0,0.6)"
                display="flex"
                alignItems="center"
                justifyContent="center"
                cursor="pointer"
                transition="all 0.1s"
                boxShadow="0 0 10px rgba(138,43,226,0.3), inset 0 0 20px rgba(255,255,255,0.1)"
                _hover={{
                  bg: "linear-gradient(135deg, rgba(120,120,180,0.9), rgba(138,43,226,0.6))",
                  borderColor: "rgba(167,255,0,0.9)",
                  boxShadow: "0 0 20px rgba(138,43,226,0.6)",
                }}
                _active={{
                  bg: "rgba(138,43,226,0.7)",
                  transform: "scale(0.95)",
                  boxShadow: "0 0 30px rgba(167,255,0,0.8)",
                }}
              >
                <Text fontSize="xl" fontWeight="black" color="white" textShadow="0 0 8px rgba(167,255,0,0.8)">
                  S
                </Text>
              </Box>

              {/* D (Right) */}
              <Box
                as="button"
                onClick={() => tap(MOVE_KEYS[3])}
                bg="linear-gradient(135deg, rgba(80,80,120,0.8), rgba(138,43,226,0.4))"
                borderRadius="md"
                border="2px solid rgba(167,255,0,0.6)"
                display="flex"
                alignItems="center"
                justifyContent="center"
                cursor="pointer"
                transition="all 0.1s"
                boxShadow="0 0 10px rgba(138,43,226,0.3), inset 0 0 20px rgba(255,255,255,0.1)"
                _hover={{
                  bg: "linear-gradient(135deg, rgba(120,120,180,0.9), rgba(138,43,226,0.6))",
                  borderColor: "rgba(167,255,0,0.9)",
                  boxShadow: "0 0 20px rgba(138,43,226,0.6)",
                }}
                _active={{
                  bg: "rgba(138,43,226,0.7)",
                  transform: "scale(0.95)",
                  boxShadow: "0 0 30px rgba(167,255,0,0.8)",
                }}
              >
                <Text fontSize="xl" fontWeight="black" color="white" textShadow="0 0 8px rgba(167,255,0,0.8)">
                  D
                </Text>
              </Box>
            </Box>
          </Box>

          {/* Space button */}
          <Box
            as="button"
            onClick={() => tap(SPACE_KEY)}
            w="140px"
            h="50px"
            bg="linear-gradient(135deg, rgba(80,80,120,0.8), rgba(138,43,226,0.4))"
            borderRadius="lg"
            border="2px solid rgba(167,255,0,0.6)"
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            transition="all 0.1s"
            position="relative"
            boxShadow="0 0 10px rgba(138,43,226,0.3), inset 0 0 20px rgba(255,255,255,0.1)"
            _hover={{
              bg: "linear-gradient(135deg, rgba(120,120,180,0.9), rgba(138,43,226,0.6))",
              borderColor: "rgba(167,255,0,0.9)",
              boxShadow: "0 0 20px rgba(138,43,226,0.6)",
            }}
            _active={{
              bg: "rgba(138,43,226,0.7)",
              transform: "scale(0.98)",
              boxShadow: "0 0 30px rgba(167,255,0,0.8)",
            }}
          >
            <Box
              position="absolute"
              inset={0}
              bg="radial-gradient(circle, rgba(167,255,0,0.15), transparent 70%)"
              filter="blur(15px)"
              pointerEvents="none"
            />
            <Text fontSize="sm" fontWeight="black" color="white" textShadow="0 0 8px rgba(167,255,0,0.8)">
              SPACE
            </Text>
            <Text
              position="absolute"
              bottom="-20px"
              fontSize="xs"
              color="rgba(200,255,150,0.9)"
              fontWeight="semibold"
            >
              {SPACE_KEY.hint}
            </Text>
          </Box>
        </Box>

        {/* Right controls (Action buttons) */}
        <Box
          position="absolute"
          bottom="60px"
          right="80px"
          zIndex={10}
          display="grid"
          gridTemplateColumns="repeat(2, 1fr)"
          gridTemplateRows="repeat(2, 1fr)"
          gap={4}
          w="160px"
          h="160px"
        >
          {ACTION_KEYS.map((btn, idx) => (
            <Box
              key={btn.label}
              as="button"
              onClick={() => tap(btn)}
              position="relative"
              w="70px"
              h="70px"
              borderRadius="full"
              bg={`linear-gradient(135deg, ${btn.color}33, ${btn.color}11)`}
              border={`2px solid ${btn.color}66`}
              display="flex"
              alignItems="center"
              justifyContent="center"
              cursor="pointer"
              transition="all 0.1s"
              gridColumn={idx % 2 === 0 ? 1 : 2}
              gridRow={Math.floor(idx / 2) + 1}
              _hover={{
                bg: `${btn.color}44`,
                boxShadow: `0 0 30px ${btn.color}88`,
              }}
              _active={{
                transform: "scale(0.92)",
                boxShadow: `0 0 40px ${btn.color}`,
              }}
            >
              {/* Button glow */}
              <Box
                position="absolute"
                inset={-10}
                bg={`radial-gradient(circle, ${btn.color}33, transparent 60%)`}
                filter="blur(15px)"
                pointerEvents="none"
              />

              {/* Button label */}
              <Text
                fontSize="2xl"
                fontWeight="black"
                color={btn.color}
                zIndex={1}
                textShadow={`0 0 10px ${btn.color}`}
              >
                {btn.label}
              </Text>

              {/* Hint label */}
              <Text
                position="absolute"
                bottom="-24px"
                fontSize="xs"
                color="rgba(255,255,255,0.5)"
                whiteSpace="nowrap"
              >
                {btn.hint}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
