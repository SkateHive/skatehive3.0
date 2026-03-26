"use client";

import { Box, VStack } from "@chakra-ui/react";
import UnifiedSwapSection from "@/components/wallet/UnifiedSwapSection";

export default function SwapPageClient() {
  return (
    <Box
      minH="100vh"
      bg="background"
      pt={{ base: 4, md: 8 }}
      px={{ base: 2, md: 4 }}
    >
      <VStack spacing={{ base: 4, md: 6 }} maxW="480px" mx="auto">
        <UnifiedSwapSection showFeeOption alwaysShowToggle />
      </VStack>
    </Box>
  );
}
