"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@chakra-ui/react";

interface FarcasterAuthIslandProps {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  onSignOut?: () => void;
  onStatusResponse?: (data: any) => void;
  renderButton?: boolean;
  autoConnect?: boolean;
  hidden?: boolean;
  nonce?: () => Promise<string>;
}

/**
 * Safe wrapper for Farcaster Auth Kit.
 * 
 * This is the ONLY way to use @farcaster/auth-kit in this app.
 * It uses dynamic import with ssr:false to ensure the auth-kit
 * code is NEVER loaded or executed on the server.
 * 
 * Usage:
 * ```tsx
 * <FarcasterAuthIsland
 *   onSuccess={(data) => console.log(data)}
 *   onError={(err) => console.error(err)}
 *   renderButton={true}
 * />
 * ```
 * 
 * For components that need auth state without rendering a button,
 * use `useFarcasterSession()` hook which reads from localStorage.
 */
const FarcasterAuthIslandClient = dynamic(
  () => import("./FarcasterAuthIslandClient"),
  {
    ssr: false,
    loading: () => <Spinner size="sm" color="primary" />,
  }
);

export function FarcasterAuthIsland(props: FarcasterAuthIslandProps) {
  return <FarcasterAuthIslandClient {...props} />;
}

/**
 * Hook to access Farcaster auth methods from anywhere in the app.
 * 
 * This works because FarcasterAuthIslandClient exposes methods via window.__farcasterAuth.
 * If the island is not mounted, all methods are no-ops.
 * 
 * @returns Auth methods and state (may be undefined if island not mounted)
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

/**
 * Returns a proxy that always reads the LATEST window.__farcasterAuth.
 * This is necessary because the dynamic import of FarcasterAuthIslandClient
 * sets window.__farcasterAuth AFTER this hook is first called.
 * Without the proxy, signIn() would be a permanent no-op.
 */
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
