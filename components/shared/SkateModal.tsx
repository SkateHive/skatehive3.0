"use client";
import React, { useEffect } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalFooter,
  Flex,
  Text,
  Box,
  IconButton,
  useTheme,
} from "@chakra-ui/react";
import { useWindow } from "@/contexts/WindowContext";

interface SkateModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "full" | { base: string; md: string };
  isCentered?: boolean;
  blockScrollOnMount?: boolean;
  onCloseComplete?: () => void;
  closeOnOverlayClick?: boolean;
  motionPreset?: "slideInBottom" | "slideInRight" | "scale" | "none";
  windowId?: string;
}

const SkateModal: React.FC<SkateModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  isCentered = true,
  blockScrollOnMount = true,
  onCloseComplete,
  closeOnOverlayClick = true,
  motionPreset,
  windowId: customWindowId,
}) => {
  const theme = useTheme();
  const {
    registerWindow,
    unregisterWindow,
    minimizeWindow,
    maximizeWindow,
    unmaximizeWindow,
    isWindowMinimized,
    isWindowMaximized,
  } = useWindow();

  const windowId = customWindowId || `modal-${title}`;
  const isMinimized = isWindowMinimized(windowId);
  const isMaximized = isWindowMaximized(windowId);

  // Register window on mount
  useEffect(() => {
    if (isOpen) {
      registerWindow(windowId, title);
    }
    return () => {
      if (isOpen) {
        unregisterWindow(windowId);
      }
    };
  }, [isOpen, windowId, title, registerWindow, unregisterWindow]);

  // Handle minimize
  const handleMinimize = () => {
    minimizeWindow(windowId);
  };

  // Handle maximize/unmaximize toggle
  const handleMaximize = () => {
    if (isMaximized) {
      unmaximizeWindow(windowId);
    } else {
      maximizeWindow(windowId);
    }
  };

  // Don't render if minimized
  if (isMinimized) return null;

  // Get theme colors for consistent styling
  const bgColor = theme.colors.background;
  const headerBgColor = theme.colors.panel || bgColor;
  const borderColor = theme.colors.border;
  const dimColor = theme.colors.dim;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={isMaximized ? "full" : size}
      isCentered={isCentered}
      blockScrollOnMount={blockScrollOnMount}
      onCloseComplete={onCloseComplete}
      closeOnOverlayClick={closeOnOverlayClick}
      motionPreset={motionPreset}
    >
      <ModalOverlay bg="blackAlpha.600" />
      <ModalContent
        bg={bgColor}
        border="1px solid"
        borderColor={borderColor}
        overflow="hidden"
      >
        {/* Custom Terminal-style Header */}
        <Flex
          alignItems="center"
          justifyContent="space-between"
          px={3}
          py={1.5}
          bg={headerBgColor}
          borderBottom="1px solid"
          borderColor={borderColor}
        >
          <Text fontSize="xs" color={dimColor} fontFamily="mono">
            {title}
          </Text>
          <Flex gap={1}>
            <IconButton
              aria-label="Minimize"
              icon={<Box w={2.5} h={2.5} borderRadius="full" bg="yellow.500" />}
              size="xs"
              variant="ghost"
              minW="auto"
              h="auto"
              p={0}
              onClick={handleMinimize}
              _hover={{ bg: "yellow.600" }}
            />
            <IconButton
              aria-label="Maximize"
              icon={<Box w={2.5} h={2.5} borderRadius="full" bg="green.500" />}
              size="xs"
              variant="ghost"
              minW="auto"
              h="auto"
              p={0}
              onClick={handleMaximize}
              _hover={{ bg: "green.600" }}
            />
            <IconButton
              aria-label="Close"
              icon={<Box w={2.5} h={2.5} borderRadius="full" bg="red.500" />}
              size="xs"
              variant="ghost"
              minW="auto"
              h="auto"
              p={0}
              onClick={onClose}
              _hover={{ bg: "red.600" }}
            />
          </Flex>
        </Flex>

        {/* Modal Body */}
        <ModalBody p={0} overflowY="auto" maxH="75vh">
          {children}
        </ModalBody>

        {/* Modal Footer (if provided) */}
        {footer && (
          <ModalFooter
            bg={headerBgColor}
            borderTop="1px solid"
            borderColor={borderColor}
            px={3}
            py={2}
          >
            {footer}
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  );
};

export default SkateModal;