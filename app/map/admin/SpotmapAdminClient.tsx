"use client";

import React, { useEffect, useRef, useState } from "react";
import NextLink from "next/link";
import {
  Badge,
  Box,
  Button,
  Code,
  Container,
  Flex,
  Heading,
  HStack,
  Input,
  Link,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { ArrowBackIcon } from "@chakra-ui/icons";
import { useTranslations } from "@/contexts/LocaleContext";
import { uploadToIpfsSmart } from "@/lib/utils/ipfsUpload";
import { validateThumbnailOverride } from "@/lib/spotmap/thumbnails";

interface AdminStatus {
  ok: boolean;
  hive_username?: string | null;
  totals?: { hive: number; google_my_maps: number; all: number };
  last_synced_at?: string | null;
  newest_hive_created?: string | null;
  error?: string;
}

// Trimmed-down shape of /api/admin/spotmap/sync's POST response.
interface SyncResponse {
  success: boolean;
  triggered_by?: string;
  started_at?: string;
  finished_at?: string;
  hive?: unknown;
  google_my_maps?: unknown;
  totals?: { hive: number; google_my_maps: number; all: number };
  error?: string;
}

interface SpotSummary {
  id: string;
  name: string;
  source: "hive" | "google_my_maps";
  thumbnail: string | null;
  thumbnail_small: string | null;
}

export default function SpotmapAdminClient() {
  const t = useTranslations("spotmapAdmin");
  const toast = useToast();
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResponse | null>(null);

  const [spots, setSpots] = useState<SpotSummary[]>([]);
  const [spotsLoading, setSpotsLoading] = useState(true);
  const [spotsError, setSpotsError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/spotmap")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) {
          setSpots(
            (data.spots as SpotSummary[]).map((s) => ({
              id: s.id,
              name: s.name,
              source: s.source,
              thumbnail: s.thumbnail,
              thumbnail_small: s.thumbnail_small,
            }))
          );
        } else {
          setSpotsError(data.error ?? "Failed to load spots");
        }
      })
      .catch((err) => {
        if (!cancelled) setSpotsError(err instanceof Error ? err.message : "Failed to load spots");
      })
      .finally(() => {
        if (!cancelled) setSpotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredSpots = search.trim()
    ? spots.filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 30)
    : spots.slice(0, 30);

  function startEditing(spotId: string) {
    setEditingId(spotId);
    setUrlInput("");
  }

  function cancelEditing() {
    setEditingId(null);
    setUrlInput("");
  }

  async function refreshSpot(spotId: string) {
    try {
      const res = await fetch(`/api/spotmap/${spotId}`);
      const data = await res.json();
      if (data.success) {
        setSpots((prev) =>
          prev.map((s) =>
            s.id === spotId
              ? { ...s, thumbnail: data.spot.thumbnail, thumbnail_small: data.spot.thumbnail_small }
              : s
          )
        );
      }
    } catch {
      // Best-effort refresh; the admin can reload the page if the row looks stale.
    }
  }

  async function handleUpload(spotId: string, file: File) {
    setUploadingId(spotId);
    try {
      const result = await uploadToIpfsSmart(file, {
        fileName: file.name,
        creator: status?.hive_username ?? undefined,
      });
      setUrlInput(result.url);
    } catch (err) {
      toast({
        title: t("uploadErrorTitle"),
        description: err instanceof Error ? err.message : "Network error",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setUploadingId(null);
    }
  }

  async function patchThumbnail(spotId: string, thumbnailOverride: string | null) {
    const res = await fetch(`/api/admin/spotmap/spot/${spotId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thumbnail_override: thumbnailOverride }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
  }

  async function handleSave(spotId: string) {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    const validation = validateThumbnailOverride(trimmed);
    if (!validation.ok) {
      toast({
        title: t("invalidImageUrl"),
        description: validation.error,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }
    setSavingId(spotId);
    try {
      await patchThumbnail(spotId, trimmed);
      await refreshSpot(spotId);
      toast({ title: t("saveSuccessTitle"), status: "success", duration: 4000, isClosable: true });
      cancelEditing();
    } catch (err) {
      toast({
        title: t("saveErrorTitle"),
        description: err instanceof Error ? err.message : "Network error",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSavingId(null);
    }
  }

  async function handleClearOverride(spotId: string) {
    setSavingId(spotId);
    try {
      await patchThumbnail(spotId, null);
      await refreshSpot(spotId);
      toast({ title: t("clearSuccessTitle"), status: "success", duration: 4000, isClosable: true });
      cancelEditing();
    } catch (err) {
      toast({
        title: t("saveErrorTitle"),
        description: err instanceof Error ? err.message : "Network error",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSavingId(null);
    }
  }

  async function refreshStatus() {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/admin/spotmap/sync", { method: "GET" });
      const data = (await res.json()) as AdminStatus;
      if (!res.ok) {
        setStatus({ ok: false, error: data.error ?? `HTTP ${res.status}` });
      } else {
        setStatus(data);
      }
    } catch (err) {
      setStatus({
        ok: false,
        error: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setStatusLoading(false);
    }
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  async function runSync(sources?: ("hive" | "google_my_maps")[]) {
    setSyncing(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/admin/spotmap/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sources ? { sources } : {}),
      });
      const data = (await res.json()) as SyncResponse;
      setLastResult(data);
      if (!res.ok || !data.success) {
        toast({
          title: "Sync finished with errors",
          description: data.error ?? "See result below",
          status: "warning",
          duration: 5000,
          isClosable: true,
        });
      } else {
        toast({
          title: "Sync complete",
          description: data.totals
            ? `Now ${data.totals.all} spots in the map`
            : undefined,
          status: "success",
          duration: 4000,
          isClosable: true,
        });
      }
      // Refresh the status counts after sync
      refreshStatus();
    } catch (err) {
      toast({
        title: "Sync request failed",
        description: err instanceof Error ? err.message : "Network error",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSyncing(false);
    }
  }

  // Auth gate display
  if (statusLoading) {
    return (
      <Container maxW="3xl" py={8}>
        <Flex justify="center" py={12}>
          <Spinner color="primary" />
        </Flex>
      </Container>
    );
  }

  if (!status?.ok) {
    return (
      <Container maxW="3xl" py={8}>
        <HStack mb={4} color="gray.400" fontSize="sm">
          <Link as={NextLink} href="/map" _hover={{ color: "primary" }}>
            <ArrowBackIcon /> Back to map
          </Link>
        </HStack>
        <Heading as="h1" size="lg" color="primary" mb={3}>
          Spot Map Admin
        </Heading>
        <Box
          p={4}
          bg="rgba(255, 80, 80, 0.08)"
          border="1px solid"
          borderColor="red.400"
          borderRadius="md"
        >
          <Text color="red.300" fontWeight="bold" mb={1}>
            Access denied
          </Text>
          <Text color="gray.300" fontSize="sm">
            {status?.error ?? "You do not have permission to use this page."}
          </Text>
          <Text color="gray.500" fontSize="xs" mt={2}>
            Admin access requires a logged-in account with a linked Hive identity
            listed in <Code fontSize="xs">ADMIN_USERS</Code>.
          </Text>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxW="3xl" py={8}>
      <HStack mb={4} color="gray.400" fontSize="sm">
        <Link as={NextLink} href="/map" _hover={{ color: "primary" }}>
          <ArrowBackIcon /> Back to map
        </Link>
      </HStack>

      <Heading as="h1" size="lg" color="primary" mb={1}>
        Spot Map Sync
      </Heading>
      <Text color="gray.400" fontSize="sm" mb={6}>
        Signed in as <Code fontSize="xs">@{status.hive_username}</Code>. Sync pulls new
        Hive skatespots since the last run, and re-pulls the Google My Maps KML feed.
      </Text>

      {/* Stats */}
      <HStack
        spacing={6}
        mb={6}
        p={4}
        bg="rgba(20,20,20,0.5)"
        border="1px solid"
        borderColor="whiteAlpha.100"
        borderRadius="md"
      >
        <Stat>
          <StatLabel color="gray.500">Hive spots</StatLabel>
          <StatNumber color="primary">{status.totals?.hive ?? 0}</StatNumber>
        </Stat>
        <Stat>
          <StatLabel color="gray.500">Google spots</StatLabel>
          <StatNumber color="primary">{status.totals?.google_my_maps ?? 0}</StatNumber>
        </Stat>
        <Stat>
          <StatLabel color="gray.500">Total</StatLabel>
          <StatNumber color="primary">{status.totals?.all ?? 0}</StatNumber>
        </Stat>
      </HStack>

      <Text fontSize="xs" color="gray.500" mb={4}>
        Last synced: {status.last_synced_at ? new Date(status.last_synced_at).toLocaleString() : "never"}
        {status.newest_hive_created && (
          <> · Newest Hive spot: {new Date(status.newest_hive_created).toLocaleDateString()}</>
        )}
      </Text>

      {/* Actions */}
      <VStack spacing={3} align="stretch" mb={6}>
        <Button
          bg="primary"
          color="background"
          _hover={{ bg: "accent", color: "text" }}
          onClick={() => runSync()}
          isLoading={syncing}
          loadingText="Syncing… (this can take a minute on the first run)"
          size="lg"
        >
          Sync now — Hive + Google
        </Button>
        <HStack>
          <Button
            flex={1}
            variant="outline"
            borderColor="primary"
            color="primary"
            _hover={{ bg: "primary", color: "background" }}
            onClick={() => runSync(["hive"])}
            isDisabled={syncing}
            size="sm"
          >
            Sync only Hive
          </Button>
          <Button
            flex={1}
            variant="outline"
            borderColor="primary"
            color="primary"
            _hover={{ bg: "primary", color: "background" }}
            onClick={() => runSync(["google_my_maps"])}
            isDisabled={syncing}
            size="sm"
          >
            Sync only Google
          </Button>
        </HStack>
      </VStack>

      {/* Thumbnail overrides */}
      <Box
        p={4}
        mb={6}
        bg="rgba(20,20,20,0.5)"
        border="1px solid"
        borderColor="whiteAlpha.100"
        borderRadius="md"
      >
        <Heading as="h2" size="sm" color="primary" mb={1}>
          {t("thumbnailsHeading")}
        </Heading>
        <Text color="gray.400" fontSize="sm" mb={4}>
          {t("thumbnailsDescription")}
        </Text>

        <Input
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          mb={4}
          size="sm"
          borderColor="whiteAlpha.200"
        />

        {spotsLoading ? (
          <Flex justify="center" py={6}>
            <Spinner size="sm" color="primary" />
          </Flex>
        ) : spotsError ? (
          <Text color="red.300" fontSize="sm">
            {t("loadErrorTitle")}: {spotsError}
          </Text>
        ) : filteredSpots.length === 0 ? (
          <Text color="gray.500" fontSize="sm">
            {t("noResults")}
          </Text>
        ) : (
          <VStack spacing={2} align="stretch">
            {filteredSpots.map((spot) => {
              const isEditing = editingId === spot.id;
              const currentImage = spot.thumbnail_small ?? spot.thumbnail;
              const isUploading = uploadingId === spot.id;
              const isSaving = savingId === spot.id;
              const trimmedUrlInput = isEditing ? urlInput.trim() : "";
              const urlValidation = trimmedUrlInput
                ? validateThumbnailOverride(trimmedUrlInput)
                : null;

              return (
                <Box
                  key={spot.id}
                  p={3}
                  bg="rgba(0,0,0,0.4)"
                  border="1px solid"
                  borderColor="whiteAlpha.100"
                  borderRadius="md"
                >
                  <Flex align="center" justify="space-between" gap={3} wrap="wrap">
                    <HStack spacing={3} minW={0}>
                      <Box
                        w="48px"
                        h="48px"
                        flexShrink={0}
                        borderRadius="md"
                        overflow="hidden"
                        bg="#0a0a0a"
                      >
                        {currentImage && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={currentImage}
                            alt={spot.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        )}
                      </Box>
                      <Box minW={0}>
                        <Text fontSize="sm" color="gray.200" noOfLines={1}>
                          {spot.name}
                        </Text>
                        <HStack spacing={2}>
                          <Badge fontSize="2xs" colorScheme={spot.source === "hive" ? "green" : "blue"}>
                            {spot.source === "hive" ? "Hive" : "Google"}
                          </Badge>
                        </HStack>
                      </Box>
                    </HStack>

                    {!isEditing && (
                      <Button
                        size="xs"
                        variant="outline"
                        borderColor="primary"
                        color="primary"
                        _hover={{ bg: "primary", color: "background" }}
                        onClick={() => startEditing(spot.id)}
                      >
                        {t("replaceImage")}
                      </Button>
                    )}
                  </Flex>

                  {isEditing && (
                    <Box mt={3} pt={3} borderTop="1px solid" borderColor="whiteAlpha.100">
                      <HStack align="flex-start" spacing={4} mb={3} wrap="wrap">
                        <Box>
                          <Text fontSize="2xs" color="gray.500" mb={1}>
                            {t("currentImage")}
                          </Text>
                          <Box w="96px" h="96px" borderRadius="md" overflow="hidden" bg="#0a0a0a">
                            {currentImage && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={currentImage}
                                alt={spot.name}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            )}
                          </Box>
                        </Box>
                        <Box>
                          <Text fontSize="2xs" color="gray.500" mb={1}>
                            {t("newImage")}
                          </Text>
                          <Box
                            w="96px"
                            h="96px"
                            borderRadius="md"
                            overflow="hidden"
                            bg="#0a0a0a"
                            border="1px dashed"
                            borderColor="whiteAlpha.300"
                          >
                            {urlInput.trim() && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={urlInput.trim()}
                                alt=""
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            )}
                          </Box>
                        </Box>
                      </HStack>

                      <Text fontSize="2xs" color="gray.500" mb={1}>
                        {t("imageUrlLabel")}
                      </Text>
                      <HStack mb={3}>
                        <Input
                          size="sm"
                          placeholder={t("imageUrlPlaceholder")}
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          borderColor="whiteAlpha.200"
                        />
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) handleUpload(spot.id, file);
                          }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          borderColor="whiteAlpha.300"
                          color="gray.200"
                          isLoading={isUploading}
                          loadingText={t("uploading")}
                          onClick={() => fileInputRef.current?.click()}
                          flexShrink={0}
                        >
                          {t("uploadButton")}
                        </Button>
                      </HStack>

                      {urlValidation && !urlValidation.ok && (
                        <Text fontSize="2xs" color="red.300" mb={3}>
                          {t("invalidImageUrl")}: {urlValidation.error}
                        </Text>
                      )}

                      <HStack>
                        <Button
                          size="sm"
                          bg="primary"
                          color="background"
                          _hover={{ bg: "accent", color: "text" }}
                          isDisabled={!urlValidation?.ok || isSaving}
                          isLoading={isSaving}
                          loadingText={t("saving")}
                          onClick={() => handleSave(spot.id)}
                        >
                          {t("saveButton")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          color="gray.400"
                          isDisabled={isSaving}
                          onClick={() => handleClearOverride(spot.id)}
                        >
                          {t("clearOverride")}
                        </Button>
                        <Button size="sm" variant="ghost" color="gray.500" onClick={cancelEditing}>
                          {t("cancel")}
                        </Button>
                      </HStack>
                    </Box>
                  )}
                </Box>
              );
            })}
          </VStack>
        )}
      </Box>

      {lastResult && (
        <Box
          p={4}
          bg="rgba(0,0,0,0.5)"
          border="1px solid"
          borderColor="whiteAlpha.200"
          borderRadius="md"
        >
          <Text fontSize="sm" fontWeight="bold" color="gray.300" mb={2}>
            Last sync result
          </Text>
          <Code
            display="block"
            whiteSpace="pre-wrap"
            wordBreak="break-word"
            fontSize="xs"
            color="gray.300"
            bg="transparent"
            p={0}
          >
            {JSON.stringify(lastResult, null, 2)}
          </Code>
        </Box>
      )}
    </Container>
  );
}
