"use client";
import { useState } from "react";
import { Discussion } from "@hiveio/dhive";
import {
  Box,
  SimpleGrid,
  Image,
  Text,
  Badge,
  Spinner,
  Button,
  VStack,
  AspectRatio,
} from "@chakra-ui/react";
import TopBar from "@/components/blog/TopBar";
import MagazineModal from "@/components/shared/MagazineModal";
import { HIVE_CONFIG } from "@/config/app.config";
import { useMagazineIssues, fetchMagazineIssuePosts } from "@/hooks/useCuratedMagazine";

// The magazine route is a COVER SELECTOR: the accumulating archive of published
// editions (from the ops portal) shown as covers → click one to flip through it
// fullscreen. Falls back to the community magazine when nothing is published.
const DEFAULT_COVER = "/images/covers/nogenta_cover.png";

export default function MagazinePage() {
  const { issues, loaded } = useMagazineIssues();
  const [openPosts, setOpenPosts] = useState<Discussion[] | null>(null);
  const [loadingIssue, setLoadingIssue] = useState<number | null>(null);
  const [communityOpen, setCommunityOpen] = useState(false);

  async function openIssue(number: number) {
    setLoadingIssue(number);
    const posts = await fetchMagazineIssuePosts(number);
    setLoadingIssue(null);
    if (posts.length > 0) setOpenPosts(posts);
  }

  return (
    <Box
      id="scrollableDiv"
      maxW="container.lg"
      mx="auto"
      maxH="100vh"
      overflowY="auto"
      p={0}
      sx={{ "&::-webkit-scrollbar": { display: "none" }, scrollbarWidth: "none" }}
    >
      <TopBar viewMode="magazine" setViewMode={() => {}} setQuery={() => {}} />

      <Box p={{ base: 4, md: 6 }}>
        <Text fontSize="2xl" fontWeight="bold" color="text" mb={1}>
          SkateHive Magazine
        </Text>
        <Text color="dim" mb={5}>
          Escolha uma edição para folhear.
        </Text>

        {!loaded ? (
          <VStack py={20}>
            <Spinner color="primary" />
          </VStack>
        ) : issues.length === 0 ? (
          <VStack py={16} spacing={3}>
            <Text color="dim">Nenhuma edição publicada ainda.</Text>
            <Button onClick={() => setCommunityOpen(true)} variant="outline">
              Ver revista da comunidade
            </Button>
          </VStack>
        ) : (
          <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing={4}>
            {issues.map((iss) => (
              <Box
                key={iss.number}
                as="button"
                onClick={() => openIssue(iss.number)}
                textAlign="left"
                borderWidth="1px"
                borderColor="border"
                borderRadius="lg"
                overflow="hidden"
                bg="muted"
                position="relative"
                transition="all .15s"
                _hover={{ borderColor: "primary", transform: "translateY(-2px)" }}
              >
                <AspectRatio ratio={3 / 4}>
                  <Image src={iss.coverUrl || DEFAULT_COVER} alt={iss.title} objectFit="cover" fallbackSrc={DEFAULT_COVER} />
                </AspectRatio>
                {iss.active && (
                  <Badge position="absolute" top={2} left={2} colorScheme="green">
                    No ar
                  </Badge>
                )}
                {loadingIssue === iss.number && (
                  <Box position="absolute" inset={0} bg="blackAlpha.700" display="flex" alignItems="center" justifyContent="center">
                    <Spinner color="white" />
                  </Box>
                )}
                <Box p={2}>
                  <Text fontSize="xs" color="dim">
                    #{iss.number} · {iss.postCount} posts
                  </Text>
                  <Text fontSize="sm" fontWeight="semibold" color="text" noOfLines={1}>
                    {iss.title}
                  </Text>
                </Box>
              </Box>
            ))}
          </SimpleGrid>
        )}
      </Box>

      {/* Fullscreen flipbook of the chosen edition */}
      {openPosts && <MagazineModal isOpen onClose={() => setOpenPosts(null)} posts={openPosts} preserveOrder />}
      {/* Fallback: community magazine when no edition is published */}
      {communityOpen && (
        <MagazineModal
          isOpen
          onClose={() => setCommunityOpen(false)}
          magazineTag={[{ tag: HIVE_CONFIG.COMMUNITY_TAG, limit: 20 }]}
          magazineQuery="created"
        />
      )}
    </Box>
  );
}
