"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  HStack,
  IconButton,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { FaFileAlt, FaPen, FaRegClock, FaTrash } from "react-icons/fa";
import { FiCopy } from "react-icons/fi";
import { useTranslations } from "@/contexts/LocaleContext";
import {
  COMPOSE_TEMPLATES,
  ComposeDraft,
  deleteComposeDraft,
  readComposeDrafts,
} from "@/lib/compose/drafts";

function formatDraftDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function ComposeWorkspacePage() {
  const t = useTranslations();
  const router = useRouter();
  const [drafts, setDrafts] = useState<ComposeDraft[]>([]);

  useEffect(() => {
    setDrafts(readComposeDrafts());
  }, []);

  const sortedDrafts = useMemo(() => {
    return [...drafts].sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
    );
  }, [drafts]);

  const handleDeleteDraft = (id: string) => {
    deleteComposeDraft(id);
    setDrafts(readComposeDrafts());
  };

  return (
    <Box minH="100vh" bg="background" color="text" px={{ base: 4, md: 8 }} py={8}>
      <Box maxW="1180px" mx="auto">
        <Flex
          align={{ base: "flex-start", md: "center" }}
          justify="space-between"
          gap={4}
          direction={{ base: "column", md: "row" }}
          mb={8}
        >
          <Box>
            <Heading as="h1" size="lg" letterSpacing="0" mb={2}>
              {t("createWorkspace.title")}
            </Heading>
            <Text color="dim" maxW="680px">
              {t("createWorkspace.subtitle")}
            </Text>
          </Box>
          <Button
            leftIcon={<FaPen />}
            bg="primary"
            color="background"
            borderRadius="none"
            px={6}
            onClick={() => router.push("/compose?new=1")}
            _hover={{ bg: "accent" }}
          >
            {t("createWorkspace.blankPost")}
          </Button>
        </Flex>

        <Grid templateColumns={{ base: "1fr", lg: "1.2fr 1fr" }} gap={6}>
          <Box>
            <HStack justify="space-between" mb={3}>
              <Heading as="h2" size="md" letterSpacing="0">
                {t("createWorkspace.continueDraft")}
              </Heading>
              <Badge colorScheme="green" variant="outline">
                {sortedDrafts.length}
              </Badge>
            </HStack>

            <VStack align="stretch" spacing={3}>
              {sortedDrafts.length === 0 ? (
                <Box border="1px solid" borderColor="border" bg="panel" p={5}>
                  <Text fontWeight="semibold">{t("createWorkspace.noDrafts")}</Text>
                  <Text color="dim" fontSize="sm" mt={1}>
                    {t("createWorkspace.noDraftsDescription")}
                  </Text>
                </Box>
              ) : (
                sortedDrafts.map((draft) => (
                  <Flex
                    key={draft.id}
                    border="1px solid"
                    borderColor="border"
                    bg="panel"
                    p={4}
                    gap={4}
                    align="center"
                    justify="space-between"
                  >
                    <HStack spacing={3} minW={0}>
                      <Box color="primary" flexShrink={0}>
                        <FaFileAlt />
                      </Box>
                      <Box minW={0}>
                        <Text fontWeight="semibold" noOfLines={1}>
                          {draft.title.trim() || t("createWorkspace.untitledDraft")}
                        </Text>
                        <HStack color="dim" fontSize="sm" spacing={2} mt={1}>
                          <FaRegClock />
                          <Text>{formatDraftDate(draft.updatedAt)}</Text>
                          {draft.hashtags.length > 0 && (
                            <Text noOfLines={1}>
                              {draft.hashtags.map((tag) => `#${tag}`).join(" ")}
                            </Text>
                          )}
                        </HStack>
                      </Box>
                    </HStack>
                    <HStack spacing={2} flexShrink={0}>
                      <Button
                        size="sm"
                        borderRadius="none"
                        variant="outline"
                        borderColor="primary"
                        color="primary"
                        onClick={() => router.push(`/compose?draft=${encodeURIComponent(draft.id)}`)}
                      >
                        {t("createWorkspace.continueEditing")}
                      </Button>
                      <IconButton
                        size="sm"
                        variant="ghost"
                        color="dim"
                        aria-label={t("createWorkspace.deleteDraft")}
                        icon={<FaTrash />}
                        onClick={() => handleDeleteDraft(draft.id)}
                      />
                    </HStack>
                  </Flex>
                ))
              )}
            </VStack>
          </Box>

          <Box>
            <Heading as="h2" size="md" letterSpacing="0" mb={3}>
              {t("createWorkspace.createFromTemplate")}
            </Heading>
            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr", lg: "1fr" }} gap={3}>
              {COMPOSE_TEMPLATES.map((template) => (
                <Box
                  key={template.id}
                  border="1px solid"
                  borderColor="border"
                  bg="panel"
                  p={4}
                >
                  <HStack align="flex-start" spacing={3}>
                    <Box color="primary" pt={1}>
                      <FiCopy />
                    </Box>
                    <Box>
                      <Text fontWeight="semibold">
                        {t(`createWorkspace.templates.${template.titleKey}`)}
                      </Text>
                      <Text color="dim" fontSize="sm" mt={1}>
                        {t(`createWorkspace.templates.${template.descriptionKey}`)}
                      </Text>
                      <Button
                        mt={3}
                        size="sm"
                        borderRadius="none"
                        variant="outline"
                        borderColor="primary"
                        color="primary"
                        onClick={() => router.push(`/compose?template=${encodeURIComponent(template.id)}`)}
                      >
                        {t("createWorkspace.useTemplate")}
                      </Button>
                    </Box>
                  </HStack>
                </Box>
              ))}
            </Grid>
          </Box>
        </Grid>
      </Box>
    </Box>
  );
}
