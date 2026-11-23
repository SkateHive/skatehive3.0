"use client";

import React from "react";
import { Box, HStack, VStack, Text, Avatar, Icon } from "@chakra-ui/react";
import { searchOptionId } from "./a11y";
import { SkaterData } from "@/types/leaderboard";

interface SkaterResultProps {
  skater: SkaterData;
  index: number;
  highlightedIndex: number;
  onSelect: (skater: SkaterData) => void;
  onHover?: () => void;
}

export default function SkaterResult({
  skater,
  index,
  highlightedIndex,
  onSelect,
  onHover,
}: SkaterResultProps) {
  return (
    <Box
      px={4}
      py={3}
      cursor="pointer"
      bg={highlightedIndex === index ? "muted" : "transparent"}
      color={highlightedIndex === index ? "primary" : "primary"}
      transition="all 0.2s ease"
      _hover={{ bg: "muted", color: "primary" }}
      onClick={() => onSelect(skater)}
      onMouseEnter={onHover}
      data-index={index}
      id={searchOptionId(index)}
      role="option"
      aria-selected={highlightedIndex === index}
    >
      <HStack spacing={3}>
        <Avatar
          size="sm"
          src={`https://images.hive.blog/u/${skater.hive_author}/avatar/medium`}
          name={skater.hive_author}
        />
        <VStack align="start" spacing={0} flex={1}>
          <Text fontWeight="medium" fontSize="md">
            @{skater.hive_author}
          </Text>
          <HStack spacing={3} fontSize="sm" opacity={0.8}>
            <Text>{skater.points || 0} Points</Text>
            <Text>${(skater.max_voting_power_usd || 0).toFixed(0)} VP</Text>
          </HStack>
        </VStack>
      </HStack>
    </Box>
  );
}
