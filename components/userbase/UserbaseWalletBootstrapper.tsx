"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAioha } from "@aioha/react-ui";
import { useAccount, useEnsAvatar, useEnsName } from "wagmi";
import { useFarcasterSession } from "@/hooks/useFarcasterSession";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";

export default function UserbaseWalletBootstrapper() {
  const { user: hiveUser } = useAioha();
  const { address, isConnected: isEvmConnected } = useAccount();
  const { data: ensName } = useEnsName({ address, chainId: 1 });
  const { data: ensAvatar } = useEnsAvatar({
    name: ensName ?? undefined,
    chainId: 1,
    query: { enabled: !!ensName },
  });
  const {
    isAuthenticated: isFarcasterConnected,
    profile: farcasterProfile,
    isRestoring,
  } = useFarcasterSession();
  const { user: userbaseUser, refresh } = useUserbaseAuth();
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isSyncingProfile, setIsSyncingProfile] = useState(false);
  const attemptedRef = useRef<Map<string, number>>(new Map());
  const syncedProfileRef = useRef<Map<string, number>>(new Map());
  const lastUserIdRef = useRef<string | null>(null);

  const hiveHandle =
    typeof hiveUser === "string"
      ? hiveUser
      : hiveUser?.name || hiveUser?.username || null;
  const evmAddress = address ? address.toLowerCase() : null;
  const farcasterProfileSafe = farcasterProfile || null;
  const farcasterHandle = farcasterProfileSafe?.username || null;
  const farcasterFid =
    farcasterProfileSafe?.fid !== undefined && farcasterProfileSafe?.fid !== null
      ? String(farcasterProfileSafe.fid)
      : null;
  const farcasterDisplayName =
    farcasterProfileSafe?.displayName || farcasterHandle || "Skater";
  const farcasterAvatar = farcasterProfileSafe?.pfpUrl || null;
  const farcasterCustody = farcasterProfileSafe?.custody || null;
  const farcasterVerifications = useMemo(
    () => farcasterProfileSafe?.verifications || [],
    [farcasterProfileSafe?.verifications]
  );

  const bootstrapCandidate = useMemo(() => {
    if (hiveHandle) {
      return {
        key: `hive:${hiveHandle}`,
        payload: {
          type: "hive" as const,
          identifier: hiveHandle,
          handle: hiveHandle,
          display_name: hiveHandle,
          avatar_url: `https://images.hive.blog/u/${hiveHandle}/avatar`,
        },
      };
    }

    if (isFarcasterConnected && farcasterFid) {
      return {
        key: `farcaster:${farcasterFid}`,
        payload: {
          type: "farcaster" as const,
          identifier: farcasterFid,
          handle: farcasterHandle,
          display_name: farcasterDisplayName,
          avatar_url: farcasterAvatar,
          metadata: {
            custody: farcasterCustody,
            verifications: farcasterVerifications,
            display_name: farcasterDisplayName,
            pfp_url: farcasterAvatar,
            bio: farcasterProfileSafe?.bio || null,
          },
        },
      };
    }

    if (isEvmConnected && evmAddress) {
      return {
        key: `evm:${evmAddress}`,
        payload: {
          type: "evm" as const,
          identifier: evmAddress,
          handle: ensName || null,
          display_name: ensName || `Wallet ${evmAddress.slice(0, 6)}`,
          avatar_url: ensAvatar || null,
          metadata: {
            ens_name: ensName || null,
            ens_avatar: ensAvatar || null,
          },
        },
      };
    }

    return null;
  }, [
    hiveHandle,
    isFarcasterConnected,
    farcasterFid,
    farcasterHandle,
    farcasterDisplayName,
    farcasterAvatar,
    farcasterCustody,
    farcasterVerifications,
    isEvmConnected,
    evmAddress,
    ensName,
    ensAvatar,
  ]);

  useEffect(() => {
    if (userbaseUser?.id) {
      lastUserIdRef.current = userbaseUser.id;
      return;
    }
    if (!userbaseUser && lastUserIdRef.current) {
      attemptedRef.current.clear();
      lastUserIdRef.current = null;
    }
  }, [userbaseUser]);

  useEffect(() => {
    if (userbaseUser || isBootstrapping) return;
    if (isRestoring) return;
    if (!bootstrapCandidate) return;

    const { key: attemptKey, payload } = bootstrapCandidate;
    const lastAttempt = attemptedRef.current.get(attemptKey);
    if (lastAttempt && Date.now() - lastAttempt < 60_000) return;
    attemptedRef.current.set(attemptKey, Date.now());

    const bootstrap = async () => {
      try {
        setIsBootstrapping(true);
        const response = await fetch("/api/userbase/auth/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || "Failed to bootstrap userbase");
        }
        await refresh();
      } catch (error) {
        console.error("Userbase bootstrap failed:", error);
      } finally {
        setIsBootstrapping(false);
      }
    };

    bootstrap();
  }, [
    userbaseUser,
    bootstrapCandidate,
    isBootstrapping,
    isRestoring,
    refresh,
  ]);

  useEffect(() => {
    if (!userbaseUser?.id || !isFarcasterConnected || !farcasterProfileSafe) return;
    if (isSyncingProfile) return;

    const missingDisplayName =
      !userbaseUser.display_name ||
      userbaseUser.display_name === "Skater" ||
      /^Wallet 0x/i.test(userbaseUser.display_name);
    const missingAvatar =
      !userbaseUser.avatar_url ||
      userbaseUser.avatar_url.startsWith("https://api.dicebear.com/");

    if (!missingDisplayName && !missingAvatar) return;

    const syncKey = `${userbaseUser.id}:${farcasterFid || "nofid"}`;
    const lastAttempt = syncedProfileRef.current.get(syncKey);
    if (lastAttempt && Date.now() - lastAttempt < 60_000) return;
    syncedProfileRef.current.set(syncKey, Date.now());

    const updates: Record<string, string> = {};
    if (missingDisplayName) {
      const nextDisplayName =
        farcasterProfileSafe.displayName || farcasterProfileSafe.username || "";
      if (nextDisplayName) {
        updates.display_name = nextDisplayName;
      }
    }
    if (missingAvatar && farcasterProfileSafe.pfpUrl) {
      updates.avatar_url = farcasterProfileSafe.pfpUrl;
    }

    if (Object.keys(updates).length === 0) return;

    const syncProfile = async () => {
      try {
        setIsSyncingProfile(true);
        const response = await fetch("/api/userbase/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || "Failed to sync Farcaster profile");
        }
        await refresh();
      } catch (error) {
        console.error("Farcaster profile sync failed:", error);
      } finally {
        setIsSyncingProfile(false);
      }
    };

    syncProfile();
  }, [
    userbaseUser,
    isFarcasterConnected,
    farcasterProfileSafe,
    farcasterFid,
    isSyncingProfile,
    refresh,
  ]);

  useEffect(() => {
    if (!userbaseUser?.id || !isEvmConnected || !evmAddress) return;
    if (isSyncingProfile) return;

    const missingDisplayName =
      !userbaseUser.display_name ||
      userbaseUser.display_name === "Skater" ||
      /^Wallet 0x/i.test(userbaseUser.display_name);
    const missingAvatar =
      !userbaseUser.avatar_url ||
      userbaseUser.avatar_url.startsWith("https://api.dicebear.com/");

    if (!missingDisplayName && !missingAvatar) return;
    if (!ensName && !ensAvatar) return;

    const syncKey = `${userbaseUser.id}:evm:${evmAddress}`;
    const lastAttempt = syncedProfileRef.current.get(syncKey);
    if (lastAttempt && Date.now() - lastAttempt < 60_000) return;
    syncedProfileRef.current.set(syncKey, Date.now());

    const updates: Record<string, string> = {};
    if (missingDisplayName && ensName) {
      updates.display_name = ensName;
    }
    if (missingAvatar && ensAvatar) {
      updates.avatar_url = ensAvatar;
    }

    if (Object.keys(updates).length === 0) return;

    const syncProfile = async () => {
      try {
        setIsSyncingProfile(true);
        const response = await fetch("/api/userbase/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || "Failed to sync ENS profile");
        }
        await refresh();
      } catch (error) {
        console.error("ENS profile sync failed:", error);
      } finally {
        setIsSyncingProfile(false);
      }
    };

    syncProfile();
  }, [
    userbaseUser,
    isEvmConnected,
    evmAddress,
    ensName,
    ensAvatar,
    isSyncingProfile,
    refresh,
  ]);

  return null;
}
