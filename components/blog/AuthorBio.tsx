import { Box, Flex, Avatar, Text, Button, HStack } from "@chakra-ui/react";
import NextLink from "next/link";
import { useTranslations } from "@/contexts/LocaleContext";

interface AuthorBioProps {
  author: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  postCount?: number;
  followers?: number;
}

export default function AuthorBio({
  author,
  displayName,
  avatarUrl,
  bio,
  postCount,
  followers,
}: AuthorBioProps) {
  const t = useTranslations();
  const authorDisplayName = displayName || author;
  const authorAvatar = avatarUrl || `https://images.hive.blog/u/${author}/avatar/small`;
  
  // Truncate bio to 2-3 lines (approx 120 chars)
  const truncatedBio = bio && bio.length > 120 
    ? `${bio.slice(0, 117)}...` 
    : bio;

  return (
    <Box
      bg="backgroundSecondary"
      borderRadius="md"
      p={6}
      my={6}
      border="1px solid"
      borderColor="borderColor"
    >
      <Flex gap={4} align="flex-start">
        <Avatar
          src={authorAvatar}
          name={authorDisplayName}
          size="lg"
          flexShrink={0}
        />
        
        <Box flex="1" minW={0}>
          <Text fontSize="lg" fontWeight="bold" mb={1}>
            {t("about")} @{author}
          </Text>
          
          {truncatedBio && (
            <Text
              fontSize="sm"
              color="textSecondary"
              mb={2}
              noOfLines={3}
            >
              {truncatedBio}
            </Text>
          )}
          
          <HStack spacing={4} fontSize="sm" color="textSecondary" mb={3}>
            {postCount !== undefined && (
              <Text>
                {postCount} {postCount === 1 ? t("post") : t("posts")}
              </Text>
            )}
            {followers !== undefined && (
              <Text>
                {followers} {followers === 1 ? t("follower") : t("followers")}
              </Text>
            )}
          </HStack>
          
          <Button
            as={NextLink}
            href={`/user/${author}`}
            size="sm"
            variant="outline"
            colorScheme="primary"
            _hover={{
              bg: "primary",
              color: "background",
            }}
          >
            {t("viewProfile")}
          </Button>
        </Box>
      </Flex>
    </Box>
  );
}
