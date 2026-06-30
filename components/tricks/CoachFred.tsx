"use client";

import { useState } from "react";
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
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "@/contexts/LocaleContext";
import SkateDiceGame from "./SkateDiceGame";

export default function CoachFred() {
  const t = useTranslations();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [showInvite, setShowInvite] = useState(false);

  const handleFredClick = () => {
    if (isOpen) return;
    setShowInvite((v) => !v);
  };

  const handlePlay = () => {
    setShowInvite(false);
    onOpen();
  };

  const handleClose = () => {
    onClose();
    setShowInvite(false);
  };

  return (
    <>
      {/* ── Fixed right-edge container ──────────────────────────────────────── */}
      <Box
        position="fixed"
        bottom="80px"
        right="0"
        zIndex={1000}
        display="flex"
        flexDirection="row"
        alignItems="flex-end"
        pointerEvents="none"
      >
        {/* Speech bubble — slides in from the right when invite is open */}
        <AnimatePresence>
          {showInvite && (
            <motion.div
              key="invite"
              initial={{ opacity: 0, x: 20, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.92 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              style={{
                marginRight: "8px",
                marginBottom: "20px",
                pointerEvents: "auto",
              }}
            >
              <Box
                bg="panel"
                border="1px solid"
                borderColor="muted"
                borderRadius="none"
                p={3}
                w="164px"
                boxShadow="lg"
              >
                <Text fontSize="sm" color="text" mb={3} fontWeight="medium">
                  {t("skateDice.wannaPlay")}
                </Text>
                <Button
                  size="sm"
                  w="full"
                  bg="primary"
                  color="background"
                  borderRadius="none"
                  _hover={{ opacity: 0.85 }}
                  onClick={handlePlay}
                >
                  {t("skateDice.play")}
                </Button>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Coach Fred sprite — idle float loop */}
        <Box
          cursor="pointer"
          onClick={handleFredClick}
          px={2}
          pb={1}
          pointerEvents="auto"
          aria-label={t("skateDice.wannaPlay")}
          role="button"
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.9 }}
            style={{ display: "inline-block" }}
          >
            <Image
              src="/images/skatehive-coach.png"
              alt={t("skateDice.coachAlt")}
              w="80px"
              h="auto"
              objectFit="contain"
              draggable={false}
              sx={{ userSelect: "none" }}
            />
          </motion.div>
        </Box>
      </Box>

      {/* ── Skate or Dice game modal ────────────────────────────────────────── */}
      <Modal isOpen={isOpen} onClose={handleClose} isCentered size="sm">
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(4px)" />
        <ModalContent
          bg="panel"
          borderRadius="none"
          border="1px solid"
          borderColor="muted"
        >
          <SkateDiceGame onClose={handleClose} />
        </ModalContent>
      </Modal>
    </>
  );
}
