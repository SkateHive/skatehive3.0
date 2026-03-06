"use client";

import React from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  Box,
  IconButton,
} from "@chakra-ui/react";
import { FiX } from "react-icons/fi";
import GameBoyOverlay from "./GameBoyOverlay";

interface GameModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameSlug: "quest-for-stoken" | "lougnar";
  gameTitle: string;
}

const GAME_URLS = {
  "quest-for-stoken": "https://quest-for-stoken.vercel.app/",
  lougnar: "https://quest-for-stoken.vercel.app/lougnar",
};

export default function GameModal({
  isOpen,
  onClose,
  gameSlug,
  gameTitle,
}: GameModalProps) {
  const [iframeKey, setIframeKey] = React.useState(0);

  const gameUrl = GAME_URLS[gameSlug];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full" isCentered>
      <ModalOverlay bg="blackAlpha.500" backdropFilter="blur(20px)" />
      <ModalContent
        bg="transparent"
        maxW="100vw"
        maxH="100vh"
        m={0}
        boxShadow="none"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        {/* Close button */}
        <IconButton
          aria-label="Close"
          icon={<FiX />}
          onClick={onClose}
          position="absolute"
          top={4}
          right={4}
          size="lg"
          colorScheme="whiteAlpha"
          variant="solid"
          bg="blackAlpha.700"
          _hover={{ bg: "blackAlpha.800" }}
          zIndex={10}
        />

        {/* Game Boy Advance console */}
        <Box w="100%" maxW="95vw" p={4}>
          <GameBoyOverlay>
            <iframe
              key={iframeKey}
              src={gameUrl}
              title={gameTitle}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                display: "block",
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </GameBoyOverlay>
        </Box>
      </ModalContent>
    </Modal>
  );
}
