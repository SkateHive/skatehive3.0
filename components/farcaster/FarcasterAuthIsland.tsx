"use client";

import dynamic from "next/dynamic";

interface FarcasterAuthIslandProps {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  onSignOut?: () => void;
  onStatusResponse?: (data: any) => void;
  autoConnect?: boolean;
  nonce?: () => Promise<string>;
}

/**
 * Safe wrapper for Farcaster Auth Kit.
 *
 * This is the ONLY way to use @farcaster/auth-kit in this app.
 * Uses dynamic import with ssr:false to ensure auth-kit is client-only.
 *
 * No UI is rendered — auth is handled programmatically via
 * window.__farcasterAuth (see useFarcasterAuthMethods).
 *
 * Usage:
 * ```tsx
 * <FarcasterAuthIsland
 *   onSuccess={(data) => console.log(data)}
 *   onError={(err) => console.error(err)}
 * />
 * ```
 */
const FarcasterAuthIslandClient = dynamic(
  () => import("./FarcasterAuthIslandClient"),
  { ssr: false }
);

export function FarcasterAuthIsland(props: FarcasterAuthIslandProps) {
  return <FarcasterAuthIslandClient {...props} />;
}

/**
 * Hook to access Farcaster auth methods from anywhere in the app.
 *
 * Returns a proxy that always reads the LATEST window.__farcasterAuth.
 * If the island is not mounted, all methods are no-ops.
 */
const NOOP_AUTH = {
  signIn: () => {},
  signOut: () => {},
  connect: () => {},
  reconnect: () => {},
  isSuccess: false,
  isError: false,
  error: null,
  channelToken: null,
  url: null,
  data: null,
  validSignature: false,
};

export function useFarcasterAuthMethods() {
  if (typeof window === "undefined") return NOOP_AUTH;

  return new Proxy(NOOP_AUTH, {
    get(_target, prop) {
      const auth = (window as any).__farcasterAuth;
      if (auth && prop in auth) return auth[prop];
      return (NOOP_AUTH as any)[prop];
    },
  });
}
