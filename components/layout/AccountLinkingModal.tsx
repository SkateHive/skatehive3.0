"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  HStack,
  VStack,
  Text,
  Icon,
  useToast,
  Spinner,
  Badge,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { useRouter } from "next/navigation";
import SkateModal from "@/components/shared/SkateModal";
import { useAioha } from "@aioha/react-ui";
import { KeyTypes } from "@aioha/aioha";
import { useSignMessage } from "wagmi";
import { FaEthereum, FaHive, FaLink, FaCheck } from "react-icons/fa";
import { SiFarcaster } from "react-icons/si";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";
import { useFarcasterSession } from "@/hooks/useFarcasterSession";
import {
  LinkingOpportunity,
} from "@/hooks/useAccountLinkingOpportunities";

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function OpportunityRow({
  opportunity,
  onLink,
  isLinking,
}: {
  opportunity: LinkingOpportunity;
  onLink: () => void;
  isLinking: boolean;
}) {
  const iconMap = {
    hive: FaHive,
    evm: FaEthereum,
    farcaster: SiFarcaster,
  };

  const colorMap = {
    hive: "red.400",
    evm: "blue.300",
    farcaster: "purple.400",
  };

  const sourceLabel = {
    wallet: "connected",
    hive_metadata: "from hive profile",
    farcaster_verifications: "verified on farcaster",
  };

  const displayName =
    opportunity.handle ||
    (opportunity.address ? shortenAddress(opportunity.address) : opportunity.externalId);

  return (
    <HStack
      py={2}
      px={2}
      bg={opportunity.alreadyLinked ? "whiteAlpha.50" : "whiteAlpha.100"}
      borderRadius="sm"
      border="1px solid"
      borderColor={opportunity.alreadyLinked ? "whiteAlpha.100" : "primary"}
      opacity={opportunity.alreadyLinked ? 0.6 : 1}
    >
      <Icon
        as={iconMap[opportunity.type]}
        boxSize={4}
        color={colorMap[opportunity.type]}
      />
      <VStack align="start" spacing={0} flex={1}>
        <HStack spacing={2}>
          <Text fontFamily="mono" fontSize="sm" color="text">
            {displayName}
          </Text>
          {opportunity.alreadyLinked && (
            <Icon as={FaCheck} boxSize={3} color="green.400" />
          )}
        </HStack>
        <Text fontFamily="mono" fontSize="2xs" color="gray.500">
          {sourceLabel[opportunity.source]}
        </Text>
      </VStack>
      {opportunity.alreadyLinked ? (
        <Text fontFamily="mono" fontSize="2xs" color="green.400">
          linked
        </Text>
      ) : (
        <Button
          size="xs"
          variant="outline"
          fontFamily="mono"
          fontSize="2xs"
          color="primary"
          borderColor="primary"
          onClick={onLink}
          isLoading={isLinking}
          _hover={{ bg: "primary", color: "background" }}
        >
          link →
        </Button>
      )}
    </HStack>
  );
}

interface AccountLinkingModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunities?: LinkingOpportunity[];
  isLoading?: boolean;
  onRefresh?: () => Promise<void> | void;
  skipPreview?: boolean; // Set true for faster linking without preview modal
}

export default function AccountLinkingModal({
  isOpen,
  onClose,
  opportunities = [],
  isLoading = false,
  onRefresh,
}: AccountLinkingModalProps) {
  const toast = useToast();
  const router = useRouter();
  const { aioha, user: hiveUser } = useAioha();
  const { signMessageAsync } = useSignMessage();
  const { profile: farcasterProfile } = useFarcasterSession();
  const { bumpIdentitiesVersion, refresh: refreshUserbase, user: userbaseUser } = useUserbaseAuth();
  const refresh = useCallback(async () => {
    if (onRefresh) {
      await onRefresh();
    }
  }, [onRefresh]);

  const [linkingType, setLinkingType] = useState<string | null>(null);
  const [justLinked, setJustLinked] = useState(false);

  // Filter to only show unlinked opportunities
  const unlinkedOpportunities = opportunities.filter((o) => !o.alreadyLinked);
  const linkedOpportunities = opportunities.filter((o) => o.alreadyLinked);

  // Auto-close modal when all opportunities are linked after a successful link operation
  useEffect(() => {
    if (justLinked && !isLoading && unlinkedOpportunities.length === 0) {
      const timer = setTimeout(() => {
        toast({
          status: "success",
          title: "all accounts linked",
          description: "your identities have been successfully connected",
          duration: 3000,
        });
        onClose();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [justLinked, isLoading, unlinkedOpportunities.length, onClose, toast]);

  // Reset justLinked flag when modal closes
  useEffect(() => {
    if (!isOpen) {
      setJustLinked(false);
    }
  }, [isOpen]);

  const routeAfterLink = useCallback((type: "hive" | "evm" | "farcaster", handle?: string) => {
    const username = handle || userbaseUser?.handle || hiveUser;
    if (!username) return;

    const viewMode = type === "hive" ? "" : type === "evm" ? "?view=zora" : "?view=farcaster";
    router.push(`/profile/${username}${viewMode}`);
  }, [router, userbaseUser, hiveUser]);

  const linkHive = useCallback(async (handle: string) => {
    setLinkingType("hive");
    try {
      // Step 1: Get challenge and sign
      const challengeRes = await fetch("/api/userbase/identities/hive/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      const challengeData = await challengeRes.json();
      if (!challengeRes.ok) throw new Error(challengeData?.error || "Challenge failed");

      const signResult = await aioha.signMessage(challengeData.message, KeyTypes.Posting);
      if (!signResult?.success) throw new Error(signResult?.error || "Signing failed");

      // Step 2: Verify immediately (no preview modal)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const verifyRes = await fetch("/api/userbase/identities/hive/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle,
          signature: signResult.result,
          public_key: signResult.publicKey,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const verifyData = await verifyRes.json();

      // Step 3: Handle merge if needed
      if (!verifyRes.ok) {
        if (verifyRes.status === 409 && verifyData?.merge_required) {
          // Show merge confirmation
          const shouldMerge = window.confirm(
            `@${handle} is already linked to another account. Merge accounts?\n\nThis will combine all identities into your current account.`
          );

          if (!shouldMerge) {
            throw new Error("Merge cancelled");
          }

          const mergeRes = await fetch("/api/userbase/merge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "hive",
              identifier: handle,
              source_user_id: verifyData.existing_user_id,
              signature: signResult.result,
              public_key: signResult.publicKey,
            }),
          });
          if (!mergeRes.ok) {
            const mergeData = await mergeRes.json();
            throw new Error(mergeData?.error || "Merge failed");
          }

          toast({
            status: "success",
            title: "Accounts merged successfully!",
            description: `@${handle} is now linked to your account`,
            duration: 4000,
          });
          await refreshUserbase();
        } else {
          throw new Error(verifyData?.error || "Verification failed");
        }
      } else {
        // Success - show what was linked
        const linkedCount = 1; // Hive account
        const extraInfo = [];

        if (verifyData.identity) {
          extraInfo.push(`@${handle}`);
        }

        toast({
          status: "success",
          title: "Hive account linked!",
          description: `@${handle} and related identities are now connected`,
          duration: 4000,
        });
      }

      bumpIdentitiesVersion();
      await refresh();
      setJustLinked(true);

      // Route to Hive profile
      setTimeout(() => {
        routeAfterLink("hive", handle);
      }, 1000);

    } catch (error: any) {
      const errorMessage = error?.name === 'AbortError'
        ? 'Request timed out. Please try again.'
        : error?.message || 'Unknown error';

      toast({
        status: "error",
        title: "linking failed",
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setLinkingType(null);
    }
  }, [aioha, toast, bumpIdentitiesVersion, refresh, refreshUserbase, routeAfterLink, router, userbaseUser, hiveUser]);

  const linkEvm = useCallback(async (address: string) => {
    setLinkingType("evm");
    try {
      // Get challenge
      const challengeRes = await fetch("/api/userbase/identities/evm/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const challengeData = await challengeRes.json();
      if (!challengeRes.ok) throw new Error(challengeData?.error || "Challenge failed");

      // Sign with wallet
      const signature = await signMessageAsync({ message: challengeData.message });

      // Verify immediately
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const verifyRes = await fetch("/api/userbase/identities/evm/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        throw new Error(verifyData?.error || "Verification failed");
      }

      toast({
        status: "success",
        title: "Wallet linked!",
        description: `${shortenAddress(address)} is now connected`,
        duration: 4000,
      });

      bumpIdentitiesVersion();
      await refresh();
      setJustLinked(true);

      // Route to Zora profile
      setTimeout(() => {
        routeAfterLink("evm");
      }, 1000);

    } catch (error: any) {
      const errorMessage = error?.name === 'AbortError'
        ? 'Request timed out. Please try again.'
        : error?.message || 'Unknown error';

      toast({
        status: "error",
        title: "linking failed",
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setLinkingType(null);
    }
  }, [signMessageAsync, toast, bumpIdentitiesVersion, refresh, routeAfterLink]);

  const linkFarcaster = useCallback(async (
    handle: string | undefined,
    externalId: string | undefined
  ) => {
    if (!externalId || !farcasterProfile) return;
    setLinkingType("farcaster");
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch("/api/userbase/identities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "farcaster",
          handle: handle || farcasterProfile.username,
          external_id: externalId,
          address: farcasterProfile.custody,
          metadata: {
            verifications: farcasterProfile.verifications || [],
            pfp_url: farcasterProfile.pfpUrl,
            display_name: farcasterProfile.displayName,
            bio: farcasterProfile.bio,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Linking failed");
      }

      const displayHandle = handle || farcasterProfile.username;
      const verifiedCount = farcasterProfile.verifications?.length || 0;

      toast({
        status: "success",
        title: "Farcaster linked!",
        description: `@${displayHandle}${verifiedCount > 0 ? ` with ${verifiedCount} verified wallet${verifiedCount !== 1 ? 's' : ''}` : ''} is now connected`,
        duration: 4000,
      });

      bumpIdentitiesVersion();
      await refresh();
      setJustLinked(true);

      // Route to Farcaster profile
      setTimeout(() => {
        routeAfterLink("farcaster", displayHandle);
      }, 1000);

    } catch (error: any) {
      const errorMessage = error?.name === 'AbortError'
        ? 'Request timed out. Please try again.'
        : error?.message || 'Unknown error';

      toast({
        status: "error",
        title: "linking failed",
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setLinkingType(null);
    }
  }, [farcasterProfile, toast, bumpIdentitiesVersion, refresh, routeAfterLink]);

  const handleLink = useCallback((opportunity: LinkingOpportunity) => {
    if (opportunity.type === "hive" && opportunity.handle) {
      linkHive(opportunity.handle);
    } else if (opportunity.type === "evm" && opportunity.address) {
      linkEvm(opportunity.address);
    } else if (opportunity.type === "farcaster") {
      linkFarcaster(opportunity.handle, opportunity.externalId);
    }
  }, [linkHive, linkEvm, linkFarcaster]);

  const handleLinkAll = useCallback(async () => {
    for (const op of unlinkedOpportunities) {
      await handleLink(op);
    }
  }, [unlinkedOpportunities, handleLink]);

  if (opportunities.length === 0 && !isLoading) {
    return null;
  }

  return (
    <SkateModal
      isOpen={isOpen}
      onClose={onClose}
      title="link accounts"
      isCentered
    >
      <Box
        position="absolute"
        inset={0}
        opacity={0.03}
        pointerEvents="none"
        bgImage="url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')"
      />

      <Box p={4} position="relative">
        <VStack spacing={4} align="stretch">
          {/* Header */}
          <VStack spacing={1}>
            <HStack spacing={2}>
              <Icon as={FaLink} boxSize={4} color="primary" />
              <Text fontFamily="mono" fontSize="sm" color="primary">
                detected connections
              </Text>
            </HStack>
            <Text fontFamily="mono" fontSize="xs" color="gray.400" textAlign="center">
              link your accounts for a unified experience
            </Text>
          </VStack>

          {isLoading ? (
            <HStack justify="center" py={4}>
              <Spinner size="sm" color="primary" />
              <Text fontFamily="mono" fontSize="xs" color="gray.500">
                scanning...
              </Text>
            </HStack>
          ) : (
            <>
              {/* Unlinked opportunities */}
              {unlinkedOpportunities.length > 0 && (
                <VStack spacing={2} align="stretch">
                  <HStack>
                    <Text fontFamily="mono" fontSize="xs" color="gray.500">
                      ready to link
                    </Text>
                    <Badge
                      bg="primary"
                      color="background"
                      fontFamily="mono"
                      fontSize="2xs"
                      animation={`${pulse} 2s ease-in-out infinite`}
                    >
                      {unlinkedOpportunities.length}
                    </Badge>
                  </HStack>
                  {unlinkedOpportunities.map((op, i) => (
                    <OpportunityRow
                      key={`${op.type}-${op.handle || op.address || op.externalId}-${i}`}
                      opportunity={op}
                      onLink={() => handleLink(op)}
                      isLinking={linkingType === op.type}
                    />
                  ))}
                </VStack>
              )}

              {/* Already linked */}
              {linkedOpportunities.length > 0 && (
                <VStack spacing={2} align="stretch">
                  <Text fontFamily="mono" fontSize="xs" color="gray.500">
                    already linked
                  </Text>
                  {linkedOpportunities.map((op, i) => (
                    <OpportunityRow
                      key={`${op.type}-${op.handle || op.address || op.externalId}-${i}`}
                      opportunity={op}
                      onLink={() => {}}
                      isLinking={false}
                    />
                  ))}
                </VStack>
              )}

              {/* Actions */}
              {unlinkedOpportunities.length > 0 && (
                <VStack spacing={2} pt={2}>
                  {unlinkedOpportunities.length > 1 && (
                    <Button
                      w="full"
                      size="sm"
                      bg="primary"
                      color="background"
                      fontFamily="mono"
                      fontSize="xs"
                      onClick={handleLinkAll}
                      isLoading={!!linkingType}
                      _hover={{ opacity: 0.9 }}
                    >
                      link all ({unlinkedOpportunities.length})
                    </Button>
                  )}
                  <Button
                    w="full"
                    size="sm"
                    variant="ghost"
                    fontFamily="mono"
                    fontSize="xs"
                    color="gray.500"
                    onClick={onClose}
                    _hover={{ color: "text" }}
                  >
                    skip for now
                  </Button>
                </VStack>
              )}

              {unlinkedOpportunities.length === 0 && (
                <VStack spacing={2} pt={2}>
                  <Text fontFamily="mono" fontSize="xs" color="green.400" textAlign="center">
                    ✓ all accounts linked
                  </Text>
                  <Button
                    w="full"
                    size="sm"
                    variant="outline"
                    fontFamily="mono"
                    fontSize="xs"
                    color="primary"
                    borderColor="primary"
                    onClick={onClose}
                    _hover={{ bg: "primary", color: "background" }}
                  >
                    done
                  </Button>
                </VStack>
              )}
            </>
          )}
        </VStack>
      </Box>
    </SkateModal>
  );
}
