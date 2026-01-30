"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  HStack,
  Spinner,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useAioha } from "@aioha/react-ui";
import { KeyTypes } from "@aioha/aioha";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { useFarcasterSession } from "@/hooks/useFarcasterSession";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";
import { useTranslations } from "@/lib/i18n/hooks";

interface IdentityRow {
  id: string;
  type: string;
  handle: string | null;
  address: string | null;
  external_id: string | null;
  is_primary: boolean;
  verified_at: string | null;
  metadata: Record<string, any>;
}

type IdentityType = "hive" | "evm" | "farcaster";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function UserbaseIdentityLinker({
  onLinked,
}: {
  onLinked?: () => void;
} = {}) {
  const t = useTranslations("userbaseLink");
  const toast = useToast();
  const { user, bumpIdentitiesVersion, refresh } = useUserbaseAuth();
  const { user: hiveUser, aioha } = useAioha();
  const { address, isConnected: isEvmConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const {
    isAuthenticated: isFarcasterConnected,
    profile: farcasterProfile,
    clearSession,
  } = useFarcasterSession();

  const [identities, setIdentities] = useState<IdentityRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [linkingType, setLinkingType] = useState<IdentityType | null>(null);

  const hiveHandle =
    typeof hiveUser === "string"
      ? hiveUser
      : hiveUser?.name || hiveUser?.username || null;
  const evmAddress = address ? address.toLowerCase() : null;
  const farcasterHandle = farcasterProfile?.username || null;
  const farcasterFid =
    farcasterProfile?.fid !== undefined && farcasterProfile?.fid !== null
      ? String(farcasterProfile.fid)
      : null;
  const farcasterCustody = farcasterProfile?.custody || null;

  const fetchIdentities = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const response = await fetch("/api/userbase/identities", {
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok) {
        setIdentities(data?.identities || []);
      } else {
        throw new Error(data?.error || "Failed to fetch identities");
      }
    } catch (error) {
      console.error("Failed to fetch userbase identities", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchIdentities();
    }
  }, [user, fetchIdentities, hiveHandle, evmAddress, farcasterFid]);

  const hasHive = useMemo(() => {
    if (!hiveHandle) return false;
    return identities.some(
      (identity) =>
        identity.type === "hive" &&
        identity.handle?.toLowerCase() === hiveHandle.toLowerCase()
    );
  }, [identities, hiveHandle]);

  const hasEvm = useMemo(() => {
    if (!evmAddress) return false;
    return identities.some(
      (identity) =>
        identity.type === "evm" &&
        identity.address?.toLowerCase() === evmAddress
    );
  }, [identities, evmAddress]);

  const hasFarcaster = useMemo(() => {
    if (!farcasterFid) return false;
    return identities.some(
      (identity) =>
        identity.type === "farcaster" &&
        identity.external_id === farcasterFid
    );
  }, [identities, farcasterFid]);

  const pending = useMemo(() => {
    const items: Array<{ type: IdentityType; label: string }> = [];
    if (hiveHandle && !hasHive) {
      items.push({ type: "hive", label: `@${hiveHandle}` });
    }
    if (evmAddress && isEvmConnected && !hasEvm) {
      items.push({ type: "evm", label: shortenAddress(evmAddress) });
    }
    if (farcasterFid && farcasterHandle && !hasFarcaster) {
      items.push({ type: "farcaster", label: `@${farcasterHandle}` });
    }
    return items;
  }, [
    hiveHandle,
    evmAddress,
    isEvmConnected,
    farcasterFid,
    farcasterHandle,
    hasHive,
    hasEvm,
    hasFarcaster,
  ]);

  const linkHive = useCallback(async () => {
    if (!hiveHandle) return;
    setLinkingType("hive");
    try {
      const challengeResponse = await fetch(
        "/api/userbase/identities/hive/challenge",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle: hiveHandle }),
        }
      );
      const challengeData = await challengeResponse.json();
      if (!challengeResponse.ok) {
        throw new Error(challengeData?.error || t("challengeError"));
      }

      const signResult = await aioha.signMessage(
        challengeData.message,
        KeyTypes.Posting
      );

      if (!signResult?.success) {
        throw new Error(signResult?.error || t("linkError"));
      }

      if (!signResult.publicKey) {
        throw new Error(t("linkError"));
      }

      const response = await fetch("/api/userbase/identities/hive/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: hiveHandle,
          signature: signResult.result,
          public_key: signResult.publicKey,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409 && data?.merge_required && data?.existing_user_id) {
          const shouldMerge = window.confirm(t("mergeConfirm"));
          if (shouldMerge) {
            const mergeResponse = await fetch("/api/userbase/merge", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "hive",
                identifier: hiveHandle,
                source_user_id: data.existing_user_id,
                signature: signResult.result,
                public_key: signResult.publicKey,
              }),
            });
            const mergeData = await mergeResponse.json();
            if (!mergeResponse.ok) {
              throw new Error(mergeData?.error || t("mergeError"));
            }
            await refresh();
            toast({
              title: t("mergeSuccess"),
              status: "success",
              duration: 2500,
            });
            fetchIdentities();
            bumpIdentitiesVersion();
            onLinked?.();
            return;
          }
          throw new Error(t("mergeCancelled"));
        }
        throw new Error(data?.error || "Failed to link Hive");
      }
      toast({
        title: t("linkSuccess"),
        status: "success",
        duration: 2500,
      });
      fetchIdentities();
      bumpIdentitiesVersion();
      onLinked?.();
    } catch (error: any) {
      toast({
        title: t("linkError"),
        description: error?.message,
        status: "error",
        duration: 3000,
      });
    } finally {
      setLinkingType(null);
    }
  }, [hiveHandle, aioha, fetchIdentities, refresh, bumpIdentitiesVersion, onLinked, toast, t]);

  const linkFarcaster = useCallback(async () => {
    if (!farcasterFid) return;
    setLinkingType("farcaster");
    try {
      const response = await fetch("/api/userbase/identities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "farcaster",
          handle: farcasterHandle,
          external_id: farcasterFid,
          address: farcasterCustody,
          metadata: {
            verifications: farcasterProfile?.verifications || [],
            pfp_url: farcasterProfile?.pfpUrl || null,
            display_name: farcasterProfile?.displayName || null,
            bio: farcasterProfile?.bio || null,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to link Farcaster");
      }
      toast({
        title: t("linkSuccess"),
        status: "success",
        duration: 2500,
      });
      fetchIdentities();
      bumpIdentitiesVersion();
      onLinked?.();
    } catch (error: any) {
      toast({
        title: t("linkError"),
        description: error?.message,
        status: "error",
        duration: 3000,
      });
    } finally {
      setLinkingType(null);
    }
  }, [
    farcasterFid,
    farcasterHandle,
    farcasterCustody,
    farcasterProfile,
    fetchIdentities,
    bumpIdentitiesVersion,
    onLinked,
    toast,
    t,
  ]);

  const linkEvm = useCallback(async () => {
    if (!evmAddress) return;
    setLinkingType("evm");
    try {
      const challengeResponse = await fetch(
        "/api/userbase/identities/evm/challenge",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: evmAddress }),
        }
      );
      const challengeData = await challengeResponse.json();
      if (!challengeResponse.ok) {
        throw new Error(
          challengeData?.error || t("challengeError")
        );
      }

      const signature = await signMessageAsync({
        message: challengeData.message,
      });

      const verifyResponse = await fetch(
        "/api/userbase/identities/evm/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: evmAddress, signature }),
        }
      );
      const verifyData = await verifyResponse.json();
      if (!verifyResponse.ok) {
        throw new Error(verifyData?.error || t("linkError"));
      }
      toast({
        title: t("linkSuccess"),
        status: "success",
        duration: 2500,
      });
      fetchIdentities();
      bumpIdentitiesVersion();
      onLinked?.();
    } catch (error: any) {
      toast({
        title: t("linkError"),
        description: error?.message,
        status: "error",
        duration: 3000,
      });
    } finally {
      setLinkingType(null);
    }
  }, [evmAddress, signMessageAsync, fetchIdentities, bumpIdentitiesVersion, onLinked, toast, t]);

  if (!user || pending.length === 0) {
    return null;
  }

  return (
    <Box border="1px solid" borderColor="border" p={3} borderRadius="none">
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between">
          <Text fontSize="xs" fontWeight="bold" color="text">
            {t("title")}
          </Text>
          {isLoading && <Spinner size="xs" />}
        </HStack>

        {pending.map((item) => (
          <Box key={item.type}>
            <Text fontSize="sm" color="text">
              {t(`${item.type}Label`)}:{" "}
              <Text as="span" fontWeight="bold">
                {item.label}
              </Text>
            </Text>
            <HStack mt={2} spacing={2}>
              <Button
                size="xs"
                onClick={() => {
                  if (item.type === "hive") linkHive();
                  if (item.type === "evm") linkEvm();
                  if (item.type === "farcaster") linkFarcaster();
                }}
                isLoading={linkingType === item.type}
              >
                {t("link")}
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  if (item.type === "hive") aioha.logout();
                  if (item.type === "evm") disconnect();
                  if (item.type === "farcaster") clearSession();
                }}
              >
                {t("disconnect")}
              </Button>
            </HStack>
          </Box>
        ))}
      </VStack>
    </Box>
  );
}
