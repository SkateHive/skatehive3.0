"use client";

import React from "react";
import { Box, Container, Flex, Skeleton, SimpleGrid, VStack } from "@chakra-ui/react";

const PLACEHOLDER_CARDS = 12;

/**
 * Shown while the directory's client shell mounts. Mirrors the real card
 * layout so the page does not jump when the data lands — a spinner on a page
 * this dense just reads as "broken".
 */
export default function SkatersLoading() {
  return (
    <Box minH="100vh" py={8}>
      <Container maxW="container.xl">
        <VStack spacing={3} mb={8} align="center">
          <Skeleton height="44px" width={{ base: "80%", md: "420px" }} />
          <Skeleton height="16px" width={{ base: "95%", md: "620px" }} />
          <Skeleton height="16px" width="240px" />
        </VStack>

        <Flex gap={3} mb={5} flexWrap="wrap">
          <Skeleton height="40px" width={{ base: "100%", md: "340px" }} />
          <Skeleton height="40px" width="260px" />
          <Skeleton height="40px" width="180px" />
        </Flex>

        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={3}>
          {Array.from({ length: PLACEHOLDER_CARDS }).map((_, index) => (
            <Flex
              key={index}
              gap={3}
              p={3}
              border="1px solid"
              borderColor="border"
              borderRadius="lg"
              bg="panel"
            >
              <Skeleton borderRadius="full" boxSize="48px" flexShrink={0} />
              <VStack align="stretch" flex="1" spacing={2}>
                <Skeleton height="14px" width="60%" />
                <Skeleton height="12px" width="40%" />
                <Skeleton height="12px" width="85%" />
              </VStack>
            </Flex>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  );
}
