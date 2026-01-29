"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";

interface UserbaseIdentity {
  id: string;
  type: string;
  handle: string | null;
  address: string | null;
  external_id: string | null;
  is_primary: boolean;
  verified_at: string | null;
  metadata: Record<string, any>;
}

export default function useUserbaseHiveIdentity() {
  const { user, identitiesVersion } = useUserbaseAuth();
  const [identity, setIdentity] = useState<UserbaseIdentity | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const lastVersionRef = useRef<number>(identitiesVersion);
  const pendingRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setIdentity(null);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch("/api/userbase/identities", {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load identities");
      }
      const identities: UserbaseIdentity[] = data?.identities || [];
      const hiveIdentities = identities.filter((item) => item.type === "hive");
      const primary = hiveIdentities.find((item) => item.is_primary);
      setIdentity(primary || hiveIdentities[0] || null);
    } catch (error) {
      console.error("Failed to fetch userbase hive identity", error);
      setIdentity(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);
  useEffect(() => {
    if (!user) {
      setIdentity(null);
      return;
    }
    if (identitiesVersion === lastVersionRef.current && pendingRef.current) {
      return;
    }
    lastVersionRef.current = identitiesVersion;
    const promise = refresh();
    pendingRef.current = promise;
    promise.finally(() => {
      if (pendingRef.current === promise) {
        pendingRef.current = null;
      }
    });
  }, [refresh, identitiesVersion, user]);

  return { identity, isLoading, refresh };
}
