"use client";

import React from "react";
import { Box, VStack, Heading } from "@chakra-ui/react";
import GameCartridgeEmbed from "@/components/games/GameCartridgeEmbed";

export default function TestGameModalPage() {
  return (
    <Box minH="100vh" p={8} bg="background">
      <VStack spacing={10} align="center">
        <Heading size="md">Test Game Modal (local)</Heading>
        <GameCartridgeEmbed gameSlug="quest-for-stoken" />
        <GameCartridgeEmbed gameSlug="lougnar" />
      </VStack>
    </Box>
  );
}
