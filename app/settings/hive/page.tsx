"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Link,
  Spinner,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { FiArrowLeft, FiCheckCircle, FiXCircle } from "react-icons/fi";
import { useAioha } from "@aioha/react-ui";
import { KeyTypes } from "@aioha/aioha";
import { useTranslations } from "@/contexts/LocaleContext";
import { useLinkedIdentities } from "@/contexts/LinkedIdentityContext";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";

// ─── types ────────────────────────────────────────────────────────────────────

interface AuthorityStatus {
  service_account: string;
  has_authority: boolean | null;
}

interface ScheduledPost {
  id: string;
  hive_author: string;
  permlink: string;
  title: string;
  scheduled_at: string;
  status: "pending" | "broadcasted" | "failed" | "cancelled";
  last_error?: string | null;
  broadcasted_at?: string | null;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: ScheduledPost["status"]): string {
  switch (status) {
    case "pending":
      return "warning";
    case "broadcasted":
      return "primary";
    case "failed":
      return "error";
    case "cancelled":
      return "dim";
  }
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function HiveSettingsPage() {
  const t = useTranslations();
  const toast = useToast();
  const { aioha, user: aiohaUser } = useAioha();
  const { hiveIdentity } = useLinkedIdentities();
  const { user: userbaseUser } = useUserbaseAuth();

  // The Hive account we're managing authority for.
  // Keychain user takes precedence so they can sign the Active-key tx.
  const hiveUsername = aiohaUser || hiveIdentity?.handle || null;

  // ── authority state ──────────────────────────────────────────────────────
  const [authorityStatus, setAuthorityStatus] = useState<AuthorityStatus | null>(null);
  const [loadingAuthority, setLoadingAuthority] = useState(false);
  const [isGranting, setIsGranting] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  const fetchAuthorityStatus = useCallback(async () => {
    setLoadingAuthority(true);
    try {
      const res = await fetch("/api/userbase/hive/posting-authority");
      if (res.ok) {
        const data = await res.json();
        setAuthorityStatus(data);
      }
    } finally {
      setLoadingAuthority(false);
    }
  }, []);

  useEffect(() => {
    if (!userbaseUser) return;
    fetchAuthorityStatus();
  }, [userbaseUser, fetchAuthorityStatus]);

  // ── scheduled posts state ────────────────────────────────────────────────
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    if (!userbaseUser) return;
    setLoadingPosts(true);
    try {
      const res = await fetch("/api/userbase/hive/scheduled-posts");
      if (res.ok) {
        const data = await res.json();
        setPosts(data.scheduled_posts ?? []);
      }
    } finally {
      setLoadingPosts(false);
    }
  }, [userbaseUser]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // ── grant ────────────────────────────────────────────────────────────────
  const handleGrant = async () => {
    if (!aiohaUser || !authorityStatus?.service_account) return;
    setIsGranting(true);
    try {
      // Fetch the user's current posting.weight_threshold to satisfy
      // hasGrantedPostingAuthority's check (entry[1] >= weight_threshold).
      // Standard Hive accounts have weight_threshold = 1 but we fetch to be safe.
      let weight = 1;
      try {
        const res = await fetch(
          `https://api.hive.blog`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: 1,
              jsonrpc: "2.0",
              method: "condenser_api.get_accounts",
              params: [[aiohaUser]],
            }),
          }
        );
        const json = await res.json();
        const acc = json?.result?.[0];
        if (acc?.posting?.weight_threshold) {
          weight = acc.posting.weight_threshold;
        }
      } catch {
        // fall back to weight = 1
      }

      const result = await aioha.addAccountAuthority(
        authorityStatus.service_account,
        KeyTypes.Posting,
        weight
      );

      if (!result.success) {
        toast({
          title: t("hiveSettings.grantError"),
          description: (result as any).error ?? "",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
        return;
      }

      toast({
        title: t("hiveSettings.grantSuccess"),
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      await fetchAuthorityStatus();
    } finally {
      setIsGranting(false);
    }
  };

  // ── revoke ───────────────────────────────────────────────────────────────
  const handleRevoke = async () => {
    if (!aiohaUser || !authorityStatus?.service_account) return;
    setIsRevoking(true);
    try {
      const result = await aioha.removeAccountAuthority(
        authorityStatus.service_account,
        KeyTypes.Posting
      );

      if (!result.success) {
        toast({
          title: t("hiveSettings.revokeError"),
          description: (result as any).error ?? "",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
        return;
      }

      // Auto-cancel all pending scheduled posts so they don't accumulate
      if (userbaseUser) {
        await fetch("/api/userbase/hive/scheduled-posts", { method: "DELETE" });
        await fetchPosts();
      }

      toast({
        title: t("hiveSettings.revokeSuccess"),
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      await fetchAuthorityStatus();
    } finally {
      setIsRevoking(false);
    }
  };

  // ── cancel one post ──────────────────────────────────────────────────────
  const handleCancelPost = async (id: string) => {
    setCancellingId(id);
    try {
      const res = await fetch(`/api/userbase/hive/scheduled-posts/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPosts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: "cancelled" as const } : p))
        );
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          title: (data as any)?.error ?? t("hiveSettings.revokeError"),
          status: "error",
          duration: 4000,
          isClosable: true,
        });
      }
    } finally {
      setCancellingId(null);
    }
  };

  // ── status badge label ───────────────────────────────────────────────────
  function statusLabel(status: ScheduledPost["status"]): string {
    switch (status) {
      case "pending": return t("hiveSettings.statusPending");
      case "broadcasted": return t("hiveSettings.statusBroadcasted");
      case "failed": return t("hiveSettings.statusFailed");
      case "cancelled": return t("hiveSettings.statusCancelled");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Box minH="100vh" bg="background" color="primary">
      <Box maxW="container.md" mx="auto" px={{ base: 4, md: 6 }} py={{ base: 8, md: 12 }}>
        <VStack spacing={8} align="stretch">
          {/* Back link */}
          <Box>
            <Link href="/settings" color="dim" fontSize="sm" display="inline-flex" alignItems="center" gap={1}>
              <FiArrowLeft />
              {" "}{t("hiveSettings.backToSettings")}
            </Link>
          </Box>

          {/* Authority panel */}
          <Box border="1px solid" borderColor="border" p={6}>
            <VStack align="stretch" spacing={4}>
              <Box>
                <Heading size="md" color="primary" fontFamily="mono" mb={1}>
                  {t("hiveSettings.authorityTitle")}
                </Heading>
                <Text color="dim" fontSize="sm">
                  {t("hiveSettings.authorityDescription")}
                </Text>
              </Box>

              {/* Service account */}
              {authorityStatus?.service_account && (
                <HStack spacing={2}>
                  <Text color="dim" fontSize="sm">{t("hiveSettings.serviceAccountLabel")}:</Text>
                  <Text color="primary" fontSize="sm" fontFamily="mono">
                    @{authorityStatus.service_account}
                  </Text>
                </HStack>
              )}

              {/* Current status */}
              <HStack spacing={2}>
                {loadingAuthority ? (
                  <>
                    <Spinner size="xs" color="primary" />
                    <Text color="dim" fontSize="sm">{t("hiveSettings.statusLoading")}</Text>
                  </>
                ) : authorityStatus?.has_authority === true ? (
                  <>
                    <FiCheckCircle color="var(--chakra-colors-primary)" />
                    <Text color="primary" fontSize="sm" fontWeight="semibold">
                      {t("hiveSettings.statusGranted")}
                    </Text>
                  </>
                ) : authorityStatus?.has_authority === false ? (
                  <>
                    <FiXCircle color="var(--chakra-colors-error)" />
                    <Text color="error" fontSize="sm">
                      {t("hiveSettings.statusNotGranted")}
                    </Text>
                  </>
                ) : null}
              </HStack>

              {/* Action buttons — only available when logged in with Keychain */}
              {hiveUsername && aiohaUser ? (
                <Flex gap={3} flexWrap="wrap">
                  {authorityStatus?.has_authority === false && (
                    <Button
                      size="sm"
                      bg="primary"
                      color="background"
                      fontWeight="bold"
                      borderRadius="none"
                      onClick={handleGrant}
                      isLoading={isGranting}
                      loadingText={t("hiveSettings.granting")}
                      isDisabled={isGranting || isRevoking}
                      _hover={{ bg: "accent" }}
                    >
                      {t("hiveSettings.grantButton")}
                    </Button>
                  )}
                  {authorityStatus?.has_authority === true && (
                    <Button
                      size="sm"
                      variant="outline"
                      borderColor="error"
                      color="error"
                      fontWeight="bold"
                      borderRadius="none"
                      onClick={handleRevoke}
                      isLoading={isRevoking}
                      loadingText={t("hiveSettings.revoking")}
                      isDisabled={isGranting || isRevoking}
                      _hover={{ borderColor: "error", bg: "transparent" }}
                    >
                      {t("hiveSettings.revokeButton")}
                    </Button>
                  )}
                </Flex>
              ) : hiveUsername && !aiohaUser ? (
                <Text color="warning" fontSize="sm">
                  {t("hiveSettings.needsKeychain")}
                </Text>
              ) : null}
            </VStack>
          </Box>

          {/* Scheduled posts list — only for userbase users */}
          {userbaseUser && (
            <Box border="1px solid" borderColor="border" p={6}>
              <VStack align="stretch" spacing={4}>
                <Heading size="sm" color="primary" fontFamily="mono">
                  {t("hiveSettings.scheduledPostsTitle")}
                </Heading>

                {loadingPosts ? (
                  <HStack spacing={2} py={4} justify="center">
                    <Spinner size="sm" color="primary" />
                  </HStack>
                ) : posts.length === 0 ? (
                  <Text color="dim" fontSize="sm">
                    {t("hiveSettings.noScheduledPosts")}
                  </Text>
                ) : (
                  <VStack align="stretch" spacing={2}>
                    {posts.map((post) => (
                      <Box
                        key={post.id}
                        border="1px solid"
                        borderColor="border"
                        p={3}
                      >
                        <Flex justify="space-between" align="flex-start" gap={3} flexWrap="wrap">
                          <VStack align="stretch" spacing={1} flex={1} minW={0}>
                            <Text
                              fontSize="sm"
                              color="primary"
                              fontWeight="medium"
                              noOfLines={1}
                            >
                              {post.title || post.permlink}
                            </Text>
                            <HStack spacing={3} flexWrap="wrap">
                              <Text fontSize="xs" color="dim">
                                {t("hiveSettings.scheduledFor")}{" "}
                                {new Intl.DateTimeFormat(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }).format(new Date(post.scheduled_at))}
                              </Text>
                              <Text
                                fontSize="xs"
                                color={statusColor(post.status)}
                                fontWeight="medium"
                              >
                                {statusLabel(post.status)}
                              </Text>
                            </HStack>
                            {post.status === "failed" && post.last_error && (
                              <Text fontSize="xs" color="error" noOfLines={2}>
                                {post.last_error}
                              </Text>
                            )}
                          </VStack>

                          {post.status === "pending" && (
                            <Button
                              size="xs"
                              variant="outline"
                              borderColor="dim"
                              color="dim"
                              borderRadius="none"
                              flexShrink={0}
                              isLoading={cancellingId === post.id}
                              onClick={() => handleCancelPost(post.id)}
                              _hover={{ borderColor: "error", color: "error" }}
                            >
                              {t("hiveSettings.cancelPost")}
                            </Button>
                          )}
                        </Flex>
                      </Box>
                    ))}
                  </VStack>
                )}
              </VStack>
            </Box>
          )}
        </VStack>
      </Box>
    </Box>
  );
}
