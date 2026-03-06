"use client";

import React, { useState } from "react";
import { Box, Text, VStack, useDisclosure } from "@chakra-ui/react";
import dynamic from "next/dynamic";
import GameModal from "./GameModal";

const Cartridge3D = dynamic(() => import("@/components/games/Cartridge3D"), {
  ssr: false,
  loading: () => (
    <Box w="100%" h="350px" bg="background" display="flex" alignItems="center" justifyContent="center">
      <Text fontSize="5xl">🎮</Text>
    </Box>
  ),
});

interface GameCartridgeEmbedProps {
  gameSlug: "quest-for-stoken" | "lougnar";
}

const GAME_DATA = {
  "quest-for-stoken": {
    title: "Quest for Stoken",
    description: "The OG SkateHive game. Control your skater and collect STOKEN.",
    thumbnail: "/images/qfs-ogimage.png",
  },
  lougnar: {
    title: "Lougnar",
    description: "The newest SkateHive game built with Excalibur.js.",
    thumbnail: "/images/lougnar-thumb.jpg",
  },
};

export default function GameCartridgeEmbed({ gameSlug }: GameCartridgeEmbedProps) {
  const [hovered, setHovered] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const game = GAME_DATA[gameSlug];

  return (
    <>
      <Box
        position="relative"
        w="100%"
        maxW="400px"
        mx="auto"
        my={4}
        bg="rgba(20,20,20,0.7)"
        borderRadius="xl"
        overflow="hidden"
        cursor="pointer"
        transition="all 0.3s ease"
        _hover={{
          transform: "translateY(-6px)",
          boxShadow: "0 0 30px rgba(167, 255, 0, 0.3)",
        }}
        onClick={onOpen}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        {/* 3D Cartridge */}
        <Box h="350px" position="relative">
          <Cartridge3D imageUrl={game.thumbnail} hovered={hovered} />
          
          {/* Play overlay on hover */}
          <Box
            position="absolute"
            inset={0}
            bg="blackAlpha.700"
            display="flex"
            alignItems="center"
            justifyContent="center"
            opacity={hovered ? 1 : 0}
            transition="opacity 0.3s"
            pointerEvents="none"
          >
            <Text fontSize="4xl" color="primary" fontWeight="bold">
              ▶ PLAY
            </Text>
          </Box>
        </Box>

        {/* Game info */}
        <VStack p={4} align="start" spacing={1}>
          <Text fontSize="lg" fontWeight="bold" color="primary">
            {game.title}
          </Text>
          <Text fontSize="sm" color="gray.400">
            {game.description}
          </Text>
          <Text fontSize="xs" color="gray.500" mt={1}>
            Click to play in full screen →
          </Text>
        </VStack>
      </Box>

      {/* Game Modal */}
      <GameModal
        isOpen={isOpen}
        onClose={onClose}
        gameSlug={gameSlug}
        gameTitle={game.title}
      />
    </>
  );
}
