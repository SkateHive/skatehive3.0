"use client";

import {
  Box,
  Heading,
  Text,
  SimpleGrid,
  Image,
  VStack,
  Badge,
  Flex,
} from "@chakra-ui/react";
import Link from "next/link";

interface GameCartridge {
  slug: string;
  title: string;
  description: string;
  thumbnail: string;
  url: string;
  developer: string;
  tags: string[];
  isNew?: boolean;
}

const GAMES: GameCartridge[] = [
  {
    slug: "quest-for-stoken",
    title: "Quest for Stoken",
    description:
      "The OG skatehive game. Control your skater through challenging levels, perform epic tricks, and collect STOKEN.",
    thumbnail: "/images/qfs-ogimage.png",
    url: "/game",
    developer: "webgnar",
    tags: ["platformer", "arcade", "classic"],
  },
  {
    slug: "lougnar",
    title: "Lougnar",
    description:
      "The newest skatehive game by webgnar. A fresh take on skate gaming built with Excalibur.js.",
    thumbnail: "/images/lougnar-thumb.png",
    url: "/games/lougnar",
    developer: "webgnar",
    tags: ["action", "new"],
    isNew: true,
  },
];

function GameCard({ game }: { game: GameCartridge }) {
  return (
    <Link href={game.url} style={{ textDecoration: "none" }}>
      <Box
        bg="muted"
        borderRadius="lg"
        overflow="hidden"
        border="2px solid"
        borderColor="transparent"
        transition="all 0.3s ease"
        cursor="pointer"
        position="relative"
        _hover={{
          borderColor: "primary",
          transform: "translateY(-4px)",
          boxShadow: "0 0 25px rgba(167, 255, 0, 0.25)",
        }}
        role="group"
      >
        {/* Cartridge top notch */}
        <Box
          h="6px"
          bg="primary"
          mx="25%"
          borderBottomRadius="md"
          opacity={0.6}
          _groupHover={{ opacity: 1 }}
          transition="opacity 0.3s"
        />

        {/* Thumbnail */}
        <Box position="relative" overflow="hidden" h={{ base: "180px", md: "220px" }}>
          <Image
            src={game.thumbnail}
            alt={game.title}
            w="100%"
            h="100%"
            objectFit="cover"
            fallback={
              <Flex
                w="100%"
                h="100%"
                bg="background"
                align="center"
                justify="center"
              >
                <Text fontSize="5xl">🛹</Text>
              </Flex>
            }
          />
          {game.isNew && (
            <Badge
              position="absolute"
              top={2}
              right={2}
              bg="primary"
              color="background"
              fontSize="xs"
              fontWeight="bold"
              px={2}
              py={1}
              borderRadius="md"
            >
              NEW
            </Badge>
          )}
          {/* Play overlay on hover */}
          <Flex
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="rgba(0,0,0,0.6)"
            align="center"
            justify="center"
            opacity={0}
            _groupHover={{ opacity: 1 }}
            transition="opacity 0.3s"
          >
            <Text fontSize="4xl">▶️</Text>
          </Flex>
        </Box>

        {/* Info */}
        <VStack p={4} align="start" spacing={2}>
          <Heading
            as="h3"
            fontSize={{ base: "lg", md: "xl" }}
            color="primary"
            fontWeight="bold"
          >
            {game.title}
          </Heading>
          <Text color="gray.400" fontSize="sm" noOfLines={2}>
            {game.description}
          </Text>
          <Flex gap={2} flexWrap="wrap" align="center">
            <Text color="gray.500" fontSize="xs">
              by @{game.developer}
            </Text>
            {game.tags.map((tag) => (
              <Badge
                key={tag}
                bg="background"
                color="gray.400"
                fontSize="2xs"
                px={2}
                borderRadius="sm"
              >
                {tag}
              </Badge>
            ))}
          </Flex>
        </VStack>

        {/* Cartridge bottom */}
        <Box h="4px" bg="primary" opacity={0.3} _groupHover={{ opacity: 0.6 }} transition="opacity 0.3s" />
      </Box>
    </Link>
  );
}

export default function GamesGallery() {
  return (
    <Box minH="100vh" p={{ base: 4, md: 8 }}>
      {/* Header */}
      <VStack spacing={2} mb={8} textAlign="center">
        <Heading
          as="h1"
          className="fretqwik-title"
          fontSize={{ base: "3xl", md: "5xl" }}
          color="primary"
          letterSpacing="wider"
        >
          🎮 skate games
        </Heading>
        <Text color="gray.400" fontSize={{ base: "sm", md: "md" }} maxW="600px">
          Free skateboarding games built by the community. Pick a cartridge and shred.
        </Text>
      </VStack>

      {/* Games Grid */}
      <SimpleGrid
        columns={{ base: 1, sm: 2, lg: 3 }}
        spacing={6}
        maxW="900px"
        mx="auto"
      >
        {GAMES.map((game) => (
          <GameCard key={game.slug} game={game} />
        ))}
      </SimpleGrid>

      {/* Bottom CTA */}
      <Box textAlign="center" mt={12}>
        <Text color="gray.500" fontSize="sm">
          Want to build a skate game?{" "}
          <Text as="span" color="primary" fontWeight="bold">
            Hit us up on Discord
          </Text>
        </Text>
      </Box>
    </Box>
  );
}
