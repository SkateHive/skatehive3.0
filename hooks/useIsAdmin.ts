"use client";

import { useMemo } from "react";
import useEffectiveHiveUser from "@/hooks/useEffectiveHiveUser";

/**
 * Client-side admin/moderator check against the public allowlist
 * (NEXT_PUBLIC_ADMIN_USERS). UX only — gates menu visibility. The
 * authoritative check is server-side via isServerSideAdmin in API routes.
 */
export function useIsAdmin(): boolean {
  const { handle } = useEffectiveHiveUser();

  return useMemo(() => {
    if (!handle) return false;
    const list = (process.env.NEXT_PUBLIC_ADMIN_USERS || "")
      .split(",")
      .map((u) => u.trim().toLowerCase())
      .filter(Boolean);
    return list.includes(handle.toLowerCase());
  }, [handle]);
}

export default useIsAdmin;
