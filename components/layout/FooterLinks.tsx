import { Box, SimpleGrid, Heading, VStack, Link, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import { useTranslations } from "@/contexts/LocaleContext";

export default function FooterLinks() {
  const t = useTranslations();

  const exploreLinks = [
    { label: t("tricksGuide") || "Tricks Guide", href: "/tricks" },
    { label: t("skateSpots") || "Skate Spots", href: "/spots" },
    { label: t("latestVideos") || "Latest Videos", href: "/videos" },
    { label: t("skateMap") || "Map", href: "/map" },
    { label: t("skateshops") || "Skateshops", href: "/skateshops" },
  ];

  const popularLinks = [
    { label: t("blog") || "Blog", href: "/blog" },
    { label: t("leaderboard") || "Top Skaters", href: "/leaderboard" },
    { label: t("bounties") || "Bounties", href: "/bounties" },
    { label: t("dao") || "DAO", href: "/dao" },
    { label: t("magazine") || "Magazine", href: "/magazine" },
  ];

  return (
    <Box
      as="footer"
      bg="backgroundSecondary"
      borderTop="1px solid"
      borderColor="borderColor"
      py={8}
      px={6}
      mt={12}
    >
      <SimpleGrid
        columns={{ base: 1, md: 2 }}
        spacing={8}
        maxW="container.xl"
        mx="auto"
      >
        {/* Explore Column */}
        <VStack align="flex-start" spacing={3}>
          <Heading size="sm" mb={2} color="primary">
            {t("explore") || "EXPLORE"}
          </Heading>
          {exploreLinks.map((link) => (
            <Link
              key={link.href}
              as={NextLink}
              href={link.href}
              fontSize="sm"
              color="primary"
              _hover={{
                color: "accent",
                textDecoration: "none",
              }}
              transition="color 0.2s"
            >
              {link.label}
            </Link>
          ))}
        </VStack>

        {/* Popular Column */}
        <VStack align="flex-start" spacing={3}>
          <Heading size="sm" mb={2} color="primary">
            {t("popular") || "POPULAR"}
          </Heading>
          {popularLinks.map((link) => (
            <Link
              key={link.href}
              as={NextLink}
              href={link.href}
              fontSize="sm"
              color="primary"
              _hover={{
                color: "accent",
                textDecoration: "none",
              }}
              transition="color 0.2s"
            >
              {link.label}
            </Link>
          ))}
        </VStack>
      </SimpleGrid>

      {/* Footer Credit */}
      <Text
        textAlign="center"
        fontSize="xs"
        color="textSecondary"
        mt={8}
        pt={6}
        borderTop="1px solid"
        borderColor="borderColor"
      >
        Built with Hash
      </Text>
    </Box>
  );
}
