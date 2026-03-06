"use client";

import React, { useState } from "react";
import { Box, Text, useDisclosure } from "@chakra-ui/react";
import dynamic from "next/dynamic";
import GameModal from "./GameModal";

const Cartridge3D = dynamic(() => import("@/components/games/Cartridge3D"), {
  ssr: false,
  loading: () => (
    <Box w="100%" h="300px" display="flex" alignItems="center" justifyContent="center">
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
    thumbnail: "/images/qfs-ogimage.png",
  },
  lougnar: {
    title: "Lougnar",
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
        maxW="350px"
        h="300px"
        mx="auto"
        my={4}
        cursor="pointer"
        transition="transform 0.2s ease"
        _hover={{
          transform: "scale(1.03)",
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
        <Cartridge3D imageUrl={game.thumbnail} hovered={hovered} />
        
        {/* Subtle play hint on hover */}
        <Box
          position="absolute"
          bottom={4}
          left="50%"
          transform="translateX(-50%)"
          opacity={hovered ? 1 : 0}
          transition="opacity 0.3s"
          pointerEvents="none"
        >
          <Text fontSize="sm" color="primary" fontWeight="bold" textShadow="0 0 8px black">
            ▶ Click to play
          </Text>
        </Box>
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
