"use client";

import { useEffect } from "react";
import { Box, Button, Center, Container, Heading, Text, VStack } from "@chakra-ui/react";
import NextLink from "next/link";
import { Link as ChakraLink } from "@chakra-ui/react";

/**
 * Scoped to /skaters and /skaters/[country].
 *
 * Without it, anything thrown while rendering the directory escalates to the
 * app-wide global-error boundary, which replaces the entire shell — nav and
 * all — for a failure that only concerns this page.
 */
export default function SkatersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[skaters] page error:", error);
  }, [error]);

  return (
    <Box minH="60vh" py={16}>
      <Container maxW="container.md">
        <Center>
          <VStack spacing={5} textAlign="center">
            <Heading
              as="h1"
              className="fretqwik-title"
              fontSize={{ base: "2xl", md: "4xl" }}
              color="primary"
              letterSpacing="wider"
            >
              Skateboarders Directory
            </Heading>
            <Text color="gray.400" maxW="lg">
              The directory could not be loaded right now. This is usually a hiccup
              talking to the Hive nodes, not something you did.
            </Text>
            <VStack spacing={2}>
              <Button colorScheme="green" onClick={reset}>
                Try again
              </Button>
              <ChakraLink as={NextLink} href="/map" color="primary" fontSize="sm" fontWeight="semibold">
                Browse the skate spot map instead →
              </ChakraLink>
            </VStack>
            {error.digest && (
              <Text color="gray.600" fontSize="xs" fontFamily="mono">
                {error.digest}
              </Text>
            )}
          </VStack>
        </Center>
      </Container>
    </Box>
  );
}
