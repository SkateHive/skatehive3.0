"use client";
import React, { useState } from "react";
import {
  Box,
  Text,
  Input,
  Button,
  VStack,
  HStack,
  useTheme,
} from "@chakra-ui/react";
import SkateModal from "./SkateModal";

interface SkateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: "alert" | "confirm" | "prompt";
  placeholder?: string;
  defaultValue?: string;
  tip?: string;
  onConfirm?: (value?: string) => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
}

/**
 * SkateDialog - Unified dialog component for alerts, confirms, and prompts
 * Based on SkateModal for consistent styling across the app
 * 
 * Usage:
 * - alert: Simple message with OK button
 * - confirm: Message with Cancel/Confirm buttons
 * - prompt: Input field + Cancel/Confirm buttons (like SEO prompt)
 */
const SkateDialog: React.FC<SkateDialogProps> = ({
  isOpen,
  onClose,
  title = "This page says",
  message,
  type = "alert",
  placeholder = "",
  defaultValue = "",
  tip,
  onConfirm,
  onCancel,
  confirmText = type === "alert" ? "OK" : "Confirm",
  cancelText = "Cancel",
  confirmColor = "limegreen",
}) => {
  const theme = useTheme();
  const [inputValue, setInputValue] = useState(defaultValue);

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm(type === "prompt" ? inputValue : undefined);
    }
    onClose();
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && type === "prompt") {
      handleConfirm();
    }
  };

  return (
    <SkateModal
      isOpen={isOpen}
      onClose={handleCancel}
      title={title}
      size="md"
      closeOnOverlayClick={false}
    >
      <Box p={6}>
        <VStack spacing={4} align="stretch">
          {/* Main message */}
          <Text fontSize="sm" color="text">
            {message}
          </Text>

          {/* Optional tip */}
          {tip && (
            <Text fontSize="xs" color="dim" fontStyle="italic">
              {tip}
            </Text>
          )}

          {/* Input field for prompt type */}
          {type === "prompt" && (
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              size="md"
              bg="background"
              borderColor="border"
              _focus={{
                borderColor: "primary",
                boxShadow: `0 0 0 1px ${theme.colors.primary}`,
              }}
              autoFocus
            />
          )}

          {/* Buttons */}
          <HStack spacing={3} justify="flex-end">
            {type !== "alert" && (
              <Button
                onClick={handleCancel}
                variant="outline"
                size="md"
                flex={1}
                bg="panel"
                borderColor="border"
                color="text"
                _hover={{ bg: "background" }}
              >
                {cancelText}
              </Button>
            )}
            <Button
              onClick={handleConfirm}
              size="md"
              flex={1}
              bg={confirmColor}
              color="black"
              fontWeight="bold"
              _hover={{ opacity: 0.8 }}
            >
              {confirmText}
            </Button>
          </HStack>
        </VStack>
      </Box>
    </SkateModal>
  );
};

export default SkateDialog;
