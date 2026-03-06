"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Input,
  Box,
  VStack,
  HStack,
  Text,
  Spinner,
  Alert,
  AlertIcon,
  InputProps,
  useColorModeValue,
  Avatar,
} from "@chakra-ui/react";
import { FaCheck, FaTimes } from "react-icons/fa";
import { useHiveUserValidation } from "@/hooks/useHiveUserValidation";
import useIsMobile from "@/hooks/useIsMobile";

// Chakra polymorphic types can trigger TS "union type too complex" on refs.
// We only need a DOM ref for focus/contain checks, so we relax the JSX typing here.
const InputAny = Input as unknown as React.ComponentType<any>;

interface UsernameSuggestion {
  username: string;
  reputation: number;
}

interface HiveUsernameInputProps
  extends Omit<InputProps, "value" | "onChange"> {
  value: string;
  onChange: (value: string, isValid: boolean) => void;
  showSuggestions?: boolean;
  validateOnChange?: boolean;
  placeholder?: string;
}

export default function HiveUsernameInput({
  value,
  onChange,
  showSuggestions = true,
  validateOnChange = true,
  placeholder = "Enter Hive username",
  ...inputProps
}: HiveUsernameInputProps) {
  const [suggestions, setSuggestions] = useState<UsernameSuggestion[]>([]);
  const [showSuggestionsList, setShowSuggestionsList] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [validationState, setValidationState] = useState<{
    isValid: boolean;
    isLoading: boolean;
    error: string | null;
  }>({
    isValid: false,
    isLoading: false,
    error: null,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const { validateUsername, searchUsernames, getCachedValidation } =
    useHiveUserValidation();

  const isMobile = useIsMobile();

  // Color mode values
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const hoverBg = useColorModeValue("gray.50", "gray.700");
  const suggestionBg = useColorModeValue("white", "gray.800");
  const shadowColor = useColorModeValue("lg", "dark-lg");

  // Handle input change
  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;

      // Clear previous debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Update value immediately
      onChange(newValue, false); // Initially mark as invalid until validation completes

      // Reset states
      setSuggestions([]);
      setShowSuggestionsList(false);
      setIsSearching(false);

      if (!newValue.trim()) {
        setValidationState({ isValid: false, isLoading: false, error: null });
        return;
      }

      // Check cache first for immediate feedback
      const cached = getCachedValidation(newValue);
      if (cached && !cached.isLoading) {
        setValidationState({
          isValid: cached.isValid,
          isLoading: false,
          error: cached.error,
        });
        onChange(newValue, cached.isValid);
        return;
      }

      // Set loading state
      if (validateOnChange) {
        setValidationState({ isValid: false, isLoading: true, error: null });
      }

      // Debounce validation and search
      debounceRef.current = setTimeout(async () => {
        try {
          // Validate username
          if (validateOnChange) {
            const validation = await validateUsername(newValue);
            setValidationState({
              isValid: validation.isValid,
              isLoading: false,
              error: validation.error,
            });
            onChange(newValue, validation.isValid);
          }

          // Search for suggestions
          if (showSuggestions && newValue.length >= 2) {
            setIsSearching(true);
            const searchResults = await searchUsernames(newValue, 5);
            setSuggestions(searchResults);
            setShowSuggestionsList(searchResults.length > 0);
            setIsSearching(false);
          }
        } catch (error) {
          console.error("Error during username validation/search:", error);
          setValidationState({
            isValid: false,
            isLoading: false,
            error: "Validation failed",
          });
          setIsSearching(false);
          onChange(newValue, false);
        }
      }, 300);
    },
    [
      onChange,
      validateOnChange,
      showSuggestions,
      validateUsername,
      searchUsernames,
      getCachedValidation,
    ]
  );

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback(
    (username: string) => {
      onChange(username, true);
      setShowSuggestionsList(false);
      setSuggestions([]);
      setValidationState({ isValid: true, isLoading: false, error: null });

      // Focus back to input
      if (inputRef.current) {
        inputRef.current.focus();
      }
    },
    [onChange]
  );

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestionsList(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Determine border color based on validation state
  const getBorderColor = () => {
    if (!validateOnChange || !value.trim()) return borderColor;
    if (validationState.isLoading) return "blue.300";
    if (validationState.isValid) return "green.300";
    if (validationState.error) return "red.300";
    return borderColor;
  };

  // Get validation icon
  const getValidationIcon = () => {
    if (!validateOnChange || !value.trim()) return null;
    if (validationState.isLoading)
      return <Spinner size="xs" color="blue.500" />;
    if (validationState.isValid) return <FaCheck color="green" size={12} />;
    if (validationState.error) return <FaTimes color="red" size={12} />;
    return null;
  };

  return (
    <Box position="relative" width="100%">
      <HStack spacing={2}>
        <Box flex="1" position="relative">
          <InputAny
            ref={inputRef}
            value={value}
            onChange={handleInputChange}
            placeholder={placeholder}
            borderColor={getBorderColor()}
            fontSize={isMobile ? "16px" : "md"}
            _focus={{
              borderColor: validationState.isValid ? "green.400" : "blue.400",
              boxShadow: `0 0 0 1px ${
                validationState.isValid ? "green.400" : "blue.400"
              }`,
            }}
            pr={
              validationState.isLoading ||
              validationState.isValid ||
              validationState.error
                ? "2.5rem"
                : undefined
            }
            {...inputProps}
          />

          {/* Validation icon */}
          {getValidationIcon() && (
            <Box
              position="absolute"
              right="0.75rem"
              top="50%"
              transform="translateY(-50%)"
              zIndex={2}
            >
              {getValidationIcon()}
            </Box>
          )}
        </Box>
      </HStack>

      {/* Error message */}
      {validateOnChange && validationState.error && value.trim() && (
        <Alert status="error" size="sm" mt={2}>
          <AlertIcon />
          <Text fontSize="xs">{validationState.error}</Text>
        </Alert>
      )}

      {/* Suggestions dropdown */}
      {showSuggestionsList && (suggestions.length > 0 || isSearching) && (
        <Box
          ref={suggestionsRef}
          position="absolute"
          top="100%"
          left={0}
          right={0}
          zIndex={10}
          bg={suggestionBg}
          border="1px solid"
          borderColor={borderColor}
          borderRadius="none"
          boxShadow={shadowColor}
          mt={1}
          maxHeight="200px"
          overflowY="auto"
        >
          {isSearching ? (
            <HStack p={3} justifyContent="center">
              <Spinner size="sm" />
              <Text fontSize="sm" color="gray.500">
                Searching users...
              </Text>
            </HStack>
          ) : (
            <VStack spacing={0} align="stretch">
              {suggestions.map((suggestion) => (
                <HStack
                  key={suggestion.username}
                  p={3}
                  cursor="pointer"
                  _hover={{ bg: hoverBg }}
                  onClick={() => handleSuggestionSelect(suggestion.username)}
                  spacing={3}
                >
                  <Avatar
                    size="xs"
                    src={`https://images.hive.blog/u/${encodeURIComponent(
                      suggestion.username
                    )}/avatar/small`}
                    name={suggestion.username}
                  />
                  <VStack align="start" spacing={0} flex="1">
                    <Text fontSize="sm" fontWeight="medium">
                      @{suggestion.username}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      Reputation: {suggestion.reputation}
                    </Text>
                  </VStack>
                </HStack>
              ))}
            </VStack>
          )}
        </Box>
      )}
    </Box>
  );
}
