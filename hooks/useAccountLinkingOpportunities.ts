"use client";

import { useMemo } from "react";
import { useAioha } from "@aioha/react-ui";
import { useAccount } from "wagmi";
import { useFarcasterSession } from "@/hooks/useFarcasterSession";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";
import { useLinkedIdentities } from "@/contexts/LinkedIdentityContext";
import useHiveAccount from "@/hooks/useHiveAccount";

export interface LinkingOpportunity {
  type: "hive" | "evm" | "farcaster";
  handle?: string;
  address?: string;
  externalId?: string;
  source: "wallet" | "hive_metadata" | "farcaster_verifications";
  alreadyLinked: boolean;
  existingUserId?: string; // If identity already exists for another user
}

export interface AccountLinkingState {
  opportunities: LinkingOpportunity[];
  isLoading: boolean;
  hasUnlinkedOpportunities: boolean;
  refresh: () => Promise<void>;
  identities: IdentityRow[];
}

interface IdentityRow {
  id: string;
  type: string;
  handle: string | null;
  address: string | null;
  external_id: string | null;
  is_primary: boolean;
  verified_at: string | null;
}

/**
 * Hook to detect account linking opportunities when users connect wallets
 * or when we discover linked accounts in Hive metadata
 */
export function useAccountLinkingOpportunities(enabled = true): AccountLinkingState {
  const { user: userbaseUser } = useUserbaseAuth();
  const { user: hiveUser } = useAioha();
  const { address: evmAddress, isConnected: isEvmConnected } = useAccount();
  const { isAuthenticated: isFarcasterConnected, profile: farcasterProfile } = useFarcasterSession();
  const { hiveAccount } = useHiveAccount(hiveUser || "");

  // Use shared LinkedIdentityContext instead of independent fetch
  const { identities: contextIdentities, isLoading, refresh } = useLinkedIdentities();
  const identities: IdentityRow[] = enabled ? contextIdentities : [];

  // Extract linked accounts from Hive metadata
  const hiveMetadataAccounts = useMemo(() => {
    const accounts: { ethereum?: string; farcaster?: { fid?: string; username?: string } } = {};
    
    if (!hiveAccount?.posting_json_metadata && !hiveAccount?.json_metadata) {
      return accounts;
    }

    try {
      const metadata = hiveAccount?.posting_json_metadata 
        ? JSON.parse(hiveAccount.posting_json_metadata)
        : hiveAccount?.json_metadata 
          ? JSON.parse(hiveAccount.json_metadata)
          : null;

      if (metadata?.profile) {
        // Check for Ethereum address in profile
        if (metadata.profile.ethereum || metadata.profile.eth_address) {
          accounts.ethereum = (metadata.profile.ethereum || metadata.profile.eth_address)?.toLowerCase();
        }
        
        // Check for Farcaster info
        if (metadata.profile.farcaster) {
          accounts.farcaster = {
            fid: metadata.profile.farcaster.fid?.toString(),
            username: metadata.profile.farcaster.username,
          };
        }
      }

      // Also check extensions
      if (metadata?.extensions?.ethereum) {
        accounts.ethereum = metadata.extensions.ethereum.toLowerCase();
      }
      if (metadata?.extensions?.farcaster) {
        accounts.farcaster = metadata.extensions.farcaster;
      }
    } catch (e) {
      // Invalid JSON, ignore
    }

    return accounts;
  }, [hiveAccount]);

  // Extract Ethereum addresses from Farcaster verifications
  const farcasterVerifiedAddresses = useMemo(() => {
    if (!farcasterProfile?.verifications) return [];
    return farcasterProfile.verifications
      .filter((v: string) => v.startsWith("0x"))
      .map((v: string) => v.toLowerCase());
  }, [farcasterProfile]);

  // Calculate all linking opportunities
  const opportunities = useMemo(() => {
    if (!enabled) return [];
    const ops: LinkingOpportunity[] = [];
    
    // Check if current Hive wallet is linked
    if (hiveUser) {
      const hasHive = identities.some(
        (i) => i.type === "hive" && i.handle?.toLowerCase() === hiveUser.toLowerCase()
      );
      ops.push({
        type: "hive",
        handle: hiveUser,
        source: "wallet",
        alreadyLinked: hasHive,
      });
    }

    // Check if current EVM wallet is linked
    if (evmAddress && isEvmConnected) {
      const hasEvm = identities.some(
        (i) => i.type === "evm" && i.address?.toLowerCase() === evmAddress.toLowerCase()
      );
      ops.push({
        type: "evm",
        address: evmAddress.toLowerCase(),
        source: "wallet",
        alreadyLinked: hasEvm,
      });
    }

    // Check if current Farcaster is linked
    if (isFarcasterConnected && farcasterProfile?.fid) {
      const hasFarcaster = identities.some(
        (i) => i.type === "farcaster" && i.external_id === String(farcasterProfile.fid)
      );
      ops.push({
        type: "farcaster",
        handle: farcasterProfile.username,
        externalId: String(farcasterProfile.fid),
        source: "wallet",
        alreadyLinked: hasFarcaster,
      });
    }

    // Check Hive metadata for additional accounts
    if (hiveMetadataAccounts.ethereum) {
      const alreadyInList = ops.some(
        (o) => o.type === "evm" && o.address === hiveMetadataAccounts.ethereum
      );
      if (!alreadyInList) {
        const hasEvm = identities.some(
          (i) => i.type === "evm" && i.address?.toLowerCase() === hiveMetadataAccounts.ethereum
        );
        ops.push({
          type: "evm",
          address: hiveMetadataAccounts.ethereum,
          source: "hive_metadata",
          alreadyLinked: hasEvm,
        });
      }
    }

    if (hiveMetadataAccounts.farcaster?.fid) {
      const alreadyInList = ops.some(
        (o) => o.type === "farcaster" && o.externalId === hiveMetadataAccounts.farcaster?.fid
      );
      if (!alreadyInList) {
        const hasFarcaster = identities.some(
          (i) => i.type === "farcaster" && i.external_id === hiveMetadataAccounts.farcaster?.fid
        );
        ops.push({
          type: "farcaster",
          handle: hiveMetadataAccounts.farcaster.username,
          externalId: hiveMetadataAccounts.farcaster.fid,
          source: "hive_metadata",
          alreadyLinked: hasFarcaster,
        });
      }
    }

    // Check Farcaster verifications for Ethereum addresses
    for (const verifiedAddr of farcasterVerifiedAddresses) {
      const alreadyInList = ops.some((o) => o.type === "evm" && o.address === verifiedAddr);
      if (!alreadyInList) {
        const hasEvm = identities.some(
          (i) => i.type === "evm" && i.address?.toLowerCase() === verifiedAddr
        );
        ops.push({
          type: "evm",
          address: verifiedAddr,
          source: "farcaster_verifications",
          alreadyLinked: hasEvm,
        });
      }
    }

    return ops;
  }, [
    hiveUser,
    evmAddress,
    isEvmConnected,
    isFarcasterConnected,
    farcasterProfile,
    identities,
    hiveMetadataAccounts,
    farcasterVerifiedAddresses,
  ]);

  const hasUnlinkedOpportunities = useMemo(() => {
    return opportunities.some((o) => !o.alreadyLinked);
  }, [opportunities]);

  return {
    opportunities,
    isLoading: enabled ? isLoading : false,
    hasUnlinkedOpportunities,
    refresh,
    identities,
  };
}
