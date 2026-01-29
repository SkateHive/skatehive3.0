"use client";

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useAccount } from "wagmi";
import { useAioha } from "@aioha/react-ui";
import { useFarcasterSession } from "@/hooks/useFarcasterSession";
import { useFarcasterMiniapp } from "@/hooks/useFarcasterMiniapp";
import { useUserbaseAuth } from "./UserbaseAuthContext";

export type IdentityType = "hive" | "evm" | "farcaster";

export interface IdentityRow {
  id: string;
  type: IdentityType;
  handle: string | null;
  address: string | null;
  external_id: string | null;
  is_primary: boolean;
  verified_at: string | null;
  metadata: Record<string, any>;
}

export interface LinkedConnectionInfo {
  type: IdentityType;
  linked: boolean;
  active: boolean;
  label?: string;
  identities: IdentityRow[];
}

interface LinkedIdentityContextValue {
  identities: IdentityRow[];
  connections: Record<IdentityType, LinkedConnectionInfo>;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const defaultConnections: Record<IdentityType, LinkedConnectionInfo> = {
  hive: { type: "hive", linked: false, active: false, identities: [] },
  evm: { type: "evm", linked: false, active: false, identities: [] },
  farcaster: { type: "farcaster", linked: false, active: false, identities: [] },
};

const LinkedIdentityContext = createContext<LinkedIdentityContextValue>(
  {} as LinkedIdentityContextValue
);

export function LinkedIdentityProvider({ children }: { children: React.ReactNode }) {
  const { user: userbaseUser, identitiesVersion } = useUserbaseAuth();
  const { user: hiveUser } = useAioha();
  const { address: ethAddress, isConnected: isEvmConnected } = useAccount();
  const {
    isAuthenticated: isFarcasterConnected,
    profile: farcasterProfile,
  } = useFarcasterSession();
  const { isInMiniapp, user: miniappFarcasterUser } = useFarcasterMiniapp();

  const [identities, setIdentities] = useState<IdentityRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pendingRef = useRef<Promise<void> | null>(null);
  const lastVersionRef = useRef<number>(identitiesVersion);

  const fetchIdentities = useCallback(async () => {
    if (!userbaseUser) {
      setIdentities([]);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch("/api/userbase/identities", {
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok) {
        setIdentities(data?.identities || []);
      } else {
        console.error("Failed to load identities", data);
        setIdentities([]);
      }
    } catch (error) {
      console.error("Failed to fetch identities", error);
      setIdentities([]);
    } finally {
      setIsLoading(false);
    }
  }, [userbaseUser]);

  useEffect(() => {
    if (!userbaseUser) {
      setIdentities([]);
      lastVersionRef.current = identitiesVersion;
      return;
    }
    if (
      identitiesVersion === lastVersionRef.current &&
      pendingRef.current
    ) {
      return;
    }
    lastVersionRef.current = identitiesVersion;
    const promise = fetchIdentities();
    pendingRef.current = promise;
    promise.finally(() => {
      if (pendingRef.current === promise) {
        pendingRef.current = null;
      }
    });
  }, [fetchIdentities, identitiesVersion, userbaseUser]);

  const hiveIdentities = useMemo(
    () => identities.filter((identity) => identity.type === "hive"),
    [identities]
  );
  const evmIdentities = useMemo(
    () => identities.filter((identity) => identity.type === "evm"),
    [identities]
  );
  const farcasterIdentities = useMemo(
    () => identities.filter((identity) => identity.type === "farcaster"),
    [identities]
  );

  const farcasterActive = Boolean(
    isFarcasterConnected || (isInMiniapp && !!miniappFarcasterUser)
  );

  const connections = useMemo(
    () => ({
      hive: {
        type: "hive" as IdentityType,
        linked: hiveIdentities.length > 0,
        active: Boolean(hiveUser),
        label: hiveIdentities[0]?.handle
          ? `@${hiveIdentities[0].handle}`
          : hiveIdentities[0]?.address
          ? shortenAddress(hiveIdentities[0].address)
          : undefined,
        identities: hiveIdentities,
      },
      evm: {
        type: "evm" as IdentityType,
        linked: evmIdentities.length > 0,
        active: Boolean(isEvmConnected && ethAddress),
        label:
          evmIdentities.length === 1 && evmIdentities[0].address
            ? shortenAddress(evmIdentities[0].address)
            : evmIdentities.length > 1
            ? `${evmIdentities.length} wallets`
            : undefined,
        identities: evmIdentities,
      },
      farcaster: {
        type: "farcaster" as IdentityType,
        linked: farcasterIdentities.length > 0,
        active: farcasterActive,
        label: farcasterIdentities[0]?.handle
          ? `@${farcasterIdentities[0].handle}`
          : farcasterIdentities[0]?.external_id
          ? `fid ${farcasterIdentities[0].external_id}`
          : undefined,
        identities: farcasterIdentities,
      },
    }),
    [
      hiveIdentities,
      evmIdentities,
      farcasterIdentities,
      hiveUser,
      isEvmConnected,
      ethAddress,
      farcasterActive,
    ]
  );

  return (
    <LinkedIdentityContext.Provider
      value={{
        identities,
        connections,
        isLoading,
        refresh: fetchIdentities,
      }}
    >
      {children}
    </LinkedIdentityContext.Provider>
  );
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function useLinkedIdentities() {
  const context = useContext(LinkedIdentityContext);
  if (!context) {
    throw new Error(
      "useLinkedIdentities must be used within a LinkedIdentityProvider"
    );
  }
  return context;
}
