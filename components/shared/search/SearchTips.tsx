"use client";

import React from "react";
import { Box, VStack, Text } from "@chakra-ui/react";

interface SearchTipsProps {
  show: boolean;
}

export default function SearchTips({ show }: SearchTipsProps) {
  if (!show) return null;

  return (
    <Box p={4} borderTop="1px solid" borderColor="secondary">
      <VStack spacing={2} align="start">
        <Text color="primary" fontSize="sm" fontWeight="medium">
          Search Tips
        </Text>
        <VStack spacing={1} align="start">
          <Text fontSize="sm" color="secondary">
            Type usernames to find skaters
          </Text>
          <Text fontSize="sm" color="secondary">
            Search pages and commands by name
          </Text>
          <Text fontSize="sm" color="secondary">
            Navigate with ↑↓, select with Enter
          </Text>
        </VStack>
      </VStack>
    </Box>
  );
}
