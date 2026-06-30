"use client";

import NextLink from "next/link";
import { Box, HStack, Image, Text, VStack } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  trick: { name: string; slug: string };
  tutorialThumbnailUrl?: string;
  thumbnailUrl: string | null;
};

function PlaceholderBox({
  onClick,
}: {
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <Box
      as="span"
      display="inline-flex"
      boxSize="64px"
      flexShrink={0}
      border="1px dashed"
      borderColor="muted"
      borderRadius="none"
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      _hover={{ borderColor: "dim" }}
      onClick={onClick}
    >
      <Text as="span" fontSize="2xl" color="dim" lineHeight={1}>
        +
      </Text>
    </Box>
  );
}

export default function TrickCard({ trick, tutorialThumbnailUrl, thumbnailUrl }: Props) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);

  const handleCompose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push("/compose");
  };

  const showTutorial = !!tutorialThumbnailUrl && !imgError;

  return (
    <Box
      as={NextLink}
      href={`/tricks/${trick.slug}`}
      display="block"
      bg="panel"
      border="1px solid"
      borderColor="muted"
      borderRadius="none"
      overflow="hidden"
      _hover={{ borderColor: "primary", bg: "panelHover", textDecoration: "none" }}
      transition="all 0.15s"
      textDecoration="none"
    >
      {showTutorial ? (
        <>
          <Box w="100%" sx={{ aspectRatio: "16 / 9" }} overflow="hidden">
            <Image
              src={tutorialThumbnailUrl}
              alt={trick.name}
              w="100%"
              h="100%"
              objectFit="cover"
              borderRadius="none"
              loading="lazy"
              decoding="async"
              onError={() => setImgError(true)}
            />
          </Box>
          <Box p={3}>
            <Text color="primary" fontWeight="bold" fontSize="md" noOfLines={1}>
              {trick.name}
            </Text>
            <Text fontSize="xs" color="dim">
              View clips →
            </Text>
          </Box>
        </>
      ) : (
        <Box p={4}>
          <HStack spacing={3} align="center">
            {thumbnailUrl ? (
              <Image
                src={thumbnailUrl}
                alt={trick.name}
                boxSize="64px"
                objectFit="cover"
                borderRadius="none"
                flexShrink={0}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <PlaceholderBox onClick={handleCompose} />
            )}
            <VStack align="start" spacing={0} flex={1} minW={0}>
              <Text color="primary" fontWeight="bold" fontSize="md" noOfLines={1}>
                {trick.name}
              </Text>
              <Text fontSize="xs" color="dim">
                View clips →
              </Text>
            </VStack>
          </HStack>
        </Box>
      )}
    </Box>
  );
}
