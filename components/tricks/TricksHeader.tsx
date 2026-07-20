"use client";

import {
  Box,
  Button,
  Image,
  Modal,
  ModalContent,
  ModalOverlay,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { useTranslations } from "@/contexts/LocaleContext";
import SkateDiceGame from "./SkateDiceGame";

export default function TricksHeader() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const t = useTranslations("tricks");

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
            {t("title")}
          </Text>

          <Text
            fontSize="md"
            color="dim"
            maxW="560px"
            lineHeight={1.6}
          >
            {t("subtitle")}
          </Text>
        </Box>

        {/* Right: animated dice — click opens Skate or Dice game */}
        <Button
          variant="unstyled"
          onClick={onOpen}
          aria-label={t("diceAriaLabel")}
          flexShrink={0}
          cursor="pointer"
          display="flex"
          h="auto"
          minW="auto"
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
              alt={t("diceImageAlt")}
              h="64px"
              w="auto"
              objectFit="contain"
              draggable={false}
            />
          </motion.div>
        </Button>
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
