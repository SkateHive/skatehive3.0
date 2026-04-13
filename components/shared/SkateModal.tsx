"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
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
  resizable?: boolean;
  /** When true, north/west handles anchor the opposite edge instead of expanding from centre.
   *  Requires the modal to be detached from Chakra's flex layout via position:fixed.
   *  Do not enable for modals whose inner content constrains its own height (e.g. AirdropModal). */
  preciseResize?: boolean;
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
  resizable = false,
  preciseResize = false,
}) => {
  const theme = useTheme();

  // preciseResize tracks position too so n/w handles move the correct edge
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
    top?: number;
    left?: number;
  } | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  type ResizeDir = "e" | "w" | "s" | "n" | "se" | "sw" | "ne" | "nw";

  const resizeState = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startTop: number;
    startLeft: number;
    dir: ResizeDir;
  } | null>(null);

  // Reset dimensions when modal closes so next open starts fresh
  useEffect(() => {
    if (!isOpen) setDimensions(null);
  }, [isOpen]);

  const startResize = useCallback((e: React.MouseEvent, dir: ResizeDir) => {
    e.preventDefault();
    const el = contentRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    resizeState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
      startTop: rect.top,
      startLeft: rect.left,
      dir,
    };

    const onMove = (ev: MouseEvent) => {
      if (!resizeState.current) return;
      const { startX, startY, startWidth, startHeight, startTop, startLeft, dir } = resizeState.current;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (preciseResize) {
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newTop = startTop;
        let newLeft = startLeft;

        if (dir.includes("e")) newWidth = Math.max(320, startWidth + dx);
        if (dir.includes("w")) {
          newWidth = Math.max(320, startWidth - dx);
          newLeft = startLeft + startWidth - newWidth;
        }
        if (dir.includes("s")) newHeight = Math.max(200, startHeight + dy);
        if (dir.includes("n")) {
          newHeight = Math.max(200, startHeight - dy);
          newTop = startTop + startHeight - newHeight;
        }

        setDimensions({ width: newWidth, height: newHeight, top: newTop, left: newLeft });
      } else {
        const growsH = dir.includes("e") ? dx : dir.includes("w") ? -dx : 0;
        const growsV = dir.includes("s") ? dy : dir.includes("n") ? -dy : 0;
        setDimensions({
          width: growsH !== 0 ? Math.max(320, startWidth + growsH) : startWidth,
          height: growsV !== 0 ? Math.max(200, startHeight + growsV) : startHeight,
        });
      }
    };

    const onUp = () => {
      resizeState.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [preciseResize]);

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

  const handleMinimize = () => minimizeWindow(windowId);
  const handleMaximize = () => {
    if (isMaximized) unmaximizeWindow(windowId);
    else maximizeWindow(windowId);
  };

  if (isMinimized) return null;

  const bgColor = theme.colors.background;
  const headerBgColor = theme.colors.panel || bgColor;
  const borderColor = theme.colors.border;
  const dimColor = theme.colors.dim;

  const resizeSx = resizable && dimensions && !isMaximized
    ? preciseResize
      ? {
          position: "fixed !important",
          top: `${dimensions.top}px !important`,
          left: `${dimensions.left}px !important`,
          width: `${dimensions.width}px !important`,
          maxWidth: "none !important",
          height: `${dimensions.height}px !important`,
          maxHeight: "none !important",
        }
      : {
          width: `${dimensions.width}px !important`,
          maxWidth: "none !important",
          height: `${dimensions.height}px !important`,
          maxHeight: "none !important",
        }
    : undefined;

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
        position="relative"
        display="flex"
        flexDirection="column"
        sx={resizeSx}
      >
        {/* Invisible element used to measure modal viewport coords for resize */}
        {resizable && (
          <div
            ref={contentRef}
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, pointerEvents: "none", zIndex: -1 }}
          />
        )}
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
        <ModalBody
          p={0}
          overflowY="auto"
          flex="1"
          maxH={isMaximized || (resizable && dimensions) ? "none" : "75vh"}
        >
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
        {/* Resize handles — inside the modal borders */}
        {resizable && !isMaximized && (
          <>
            {/* Edges */}
            <Box position="absolute" top="0" left="0" w="full" h="5px" cursor="ns-resize" zIndex={10} onMouseDown={(e) => startResize(e, "n")} />
            <Box position="absolute" bottom="0" left="0" w="full" h="5px" cursor="ns-resize" zIndex={10} onMouseDown={(e) => startResize(e, "s")} />
            <Box position="absolute" top="0" left="0" w="5px" h="full" cursor="ew-resize" zIndex={10} onMouseDown={(e) => startResize(e, "w")} />
            <Box position="absolute" top="0" right="0" w="5px" h="full" cursor="ew-resize" zIndex={10} onMouseDown={(e) => startResize(e, "e")} />
            {/* Corners */}
            <Box position="absolute" top="0" left="0" w="12px" h="12px" cursor="nwse-resize" zIndex={11} onMouseDown={(e) => startResize(e, "nw")} />
            <Box position="absolute" top="0" right="0" w="12px" h="12px" cursor="nesw-resize" zIndex={11} onMouseDown={(e) => startResize(e, "ne")} />
            <Box position="absolute" bottom="0" left="0" w="12px" h="12px" cursor="nesw-resize" zIndex={11} onMouseDown={(e) => startResize(e, "sw")} />
            <Box position="absolute" bottom="0" right="0" w="12px" h="12px" cursor="nwse-resize" zIndex={11} onMouseDown={(e) => startResize(e, "se")} />
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default SkateModal;
