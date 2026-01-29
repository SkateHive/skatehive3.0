"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export interface UserbaseProfileUser {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  location: string | null;
  status: string;
  onboarding_step: number;
}

export interface UserbaseIdentity {
  id: string;
  type: string;
  handle: string | null;
  address: string | null;
  external_id: string | null;
  is_primary: boolean;
  verified_at: string | null;
  metadata: Record<string, any>;
}

interface UserbaseProfileResponse {
  user: UserbaseProfileUser;
  identities: UserbaseIdentity[];
  match?: "hive" | "handle" | "evm" | null;
}

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export default function useUserbaseProfile(username: string) {
  const [profile, setProfile] = useState<UserbaseProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const areProfilesEqual = useCallback(
    (a: UserbaseProfileResponse | null, b: UserbaseProfileResponse | null) => {
      if (a === b) return true;
      if (!a || !b) return false;
      return JSON.stringify(a) === JSON.stringify(b);
    },
    []
  );

  const queryString = useMemo(() => {
    const value = username?.trim();
    if (!value) return "";
    const params = new URLSearchParams();
    if (EVM_ADDRESS_REGEX.test(value)) {
      params.set("address", value.toLowerCase());
      return params.toString();
    }
    params.set("hive_handle", value.toLowerCase());
    params.set("handle", value.toLowerCase());
    return params.toString();
  }, [username]);

  useEffect(() => {
    let mounted = true;
    if (!queryString) {
      setProfile(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const loadProfile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/userbase/profile?${queryString}`, {
          cache: "no-store",
        });
        if (!mounted) return;
        if (response.status === 404) {
          setProfile((prev) => (prev === null ? prev : null));
          setIsLoading(false);
          return;
        }
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load profile");
        }
        setProfile((prev) => (areProfilesEqual(prev, data) ? prev : data));
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || "Failed to load profile");
        setProfile((prev) => (prev === null ? prev : null));
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [queryString]);

  const refresh = useCallback(() => {
    if (!queryString) return;
    setIsLoading(true);
    setError(null);
    fetch(`/api/userbase/profile?${queryString}`, { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 404) {
          setProfile((prev) => (prev === null ? prev : null));
          return;
        }
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load profile");
        }
        setProfile((prev) => (areProfilesEqual(prev, data) ? prev : data));
      })
      .catch((err: any) => {
        setError(err?.message || "Failed to load profile");
        setProfile((prev) => (prev === null ? prev : null));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [queryString]);

  return { profile, isLoading, error, refresh };
}
