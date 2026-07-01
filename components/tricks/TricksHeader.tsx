"use client";

import {
  Box,
  Image,
  Modal,
  ModalContent,
  ModalOverlay,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import SkateDiceGame from "./SkateDiceGame";

export default function TricksHeader() {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <>
      <Box
        as="header"
        display="flex"
        flexDirection={{ base: "column", md: "row" }}
        alignItems="center"
        gap={8}
        mb={10}
      >
        {/* Left: heading + subtitle */}
        <Box flex={1}>
          <Text
            as="h1"
            fontFamily="heading"
            fontSize="32px"
            fontWeight="bold"
            color="primary"
            mb={3}
            lineHeight={1.1}
          >
            Skateboard Tricks
          </Text>

          <Text
            fontSize="md"
            color="dim"
            maxW="560px"
            lineHeight={1.6}
          >
            Learn tricks and browse clips filmed by real skaters from the Skatehive
            community. Click any trick for tutorials, GIFs, videos, and posts.
          </Text>
        </Box>

        {/* Right: animated dice — click opens Skate or Dice game */}
        <Box
          flexShrink={0}
          cursor="pointer"
          onClick={onOpen}
          role="button"
          aria-label="Play Skate or Dice"
          sx={{ userSelect: "none" }}
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            whileHover={{ scale: 1.2, rotate: 20 }}
            style={{ display: "inline-block" }}
          >
            <Image
              src="/images/skate-dice.png"
              alt="Click to play Skate or Dice"
              h="64px"
              w="auto"
              objectFit="contain"
              draggable={false}
            />
          </motion.div>
        </Box>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} isCentered size="sm">
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(4px)" />
        <ModalContent
          bg="panel"
          borderRadius="none"
          border="1px solid"
          borderColor="muted"
          position="relative"
          overflow="hidden"
        >
          <SkateDiceGame onClose={onClose} />
        </ModalContent>
      </Modal>
    </>
  );
}
