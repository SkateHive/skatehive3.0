"use client";

import { AuthKitProvider, useSignIn } from "@farcaster/auth-kit";
import { APP_CONFIG } from "@/config/app.config";
import { useEffect, useRef } from "react";
import { saveFarcasterSession } from "@/hooks/useFarcasterSession";

const isLocalhost =
  typeof window !== "undefined" && window.location.hostname === "localhost";

const config = {
  relay: "https://relay.farcaster.xyz",
  rpcUrl: "https://mainnet.optimism.io",
  siweUri: isLocalhost
    ? `http://localhost:${typeof window !== "undefined" ? window.location.port : "3000"}`
    : APP_CONFIG.BASE_URL || "https://skatehive.app",
  domain: isLocalhost
    ? "localhost"
    : APP_CONFIG.DOMAIN || "skatehive.app",
};

interface FarcasterAuthIslandClientProps {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  onSignOut?: () => void;
  onStatusResponse?: (data: any) => void;
  autoConnect?: boolean;
  nonce?: () => Promise<string>;
}

/**
 * Inner component that uses useSignIn — MUST be inside AuthKitProvider.
 *
 * No UI is rendered. connect/signIn are handled programmatically via
 * window.__farcasterAuth. The hidden <SignInButton> was removed to avoid
 * a competing useSignIn instance in the same AuthKitProvider.
 */
function FarcasterAuthInner({
  onSuccess,
  onError,
  onSignOut,
  onStatusResponse,
  autoConnect = false,
  nonce,
}: FarcasterAuthIslandClientProps) {
  // Workaround for auth-kit v0.8.2 race condition:
  // `data` gets cleared before `isSuccess` becomes true, so the internal
  // onSuccess callback (which requires data && isSuccess && validSignature
  // all truthy simultaneously) never fires. We capture the completed response
  // in a ref and manually fire onSuccess when isSuccess + validSignature are set.
  const completedDataRef = useRef<any>(null);
  const didFireSuccessRef = useRef(false);

  const {
    signIn,
    signOut,
    connect,
    reconnect,
    isSuccess,
    isError,
    error,
    channelToken,
    url,
    data,
    validSignature,
  } = useSignIn({
    onSuccess: () => {
      // May never fire due to auth-kit race condition — handled in effect below
    },
    onError: (err: any) => {
      onError?.(err);
    },
    onStatusResponse: (res: any) => {
      // Capture completed response data before it gets cleared
      if (res?.state === "completed" && res?.nonce) {
        completedDataRef.current = res;
      }
      onStatusResponse?.(res);
    },
    ...(nonce ? { nonce } : {}),
  });

  // Manually fire onSuccess when auth completes
  useEffect(() => {
    if (isSuccess && validSignature && !didFireSuccessRef.current) {
      didFireSuccessRef.current = true;
      const d = data || completedDataRef.current;
      if (d?.fid) {
        saveFarcasterSession({
          fid: d.fid,
          username: d.username,
          pfpUrl: d.pfpUrl,
          bio: d.bio,
          displayName: d.displayName,
          custody: d.custody,
          verifications: d.verifications,
        });
      }
      onSuccess?.(d || {});
    }
  }, [isSuccess, validSignature, data, onSuccess]);

  // Refs for stable function references (auth-kit returns new refs every render)
  const signInRef = useRef(signIn);
  const signOutRef = useRef(signOut);
  const connectRef = useRef(connect);
  const reconnectRef = useRef(reconnect);
  signInRef.current = signIn;
  signOutRef.current = signOut;
  connectRef.current = connect;
  reconnectRef.current = reconnect;

  // Guards to prevent duplicate signIn/URL-open calls
  const didSignInRef = useRef<string | null>(null);
  const didOpenUrlRef = useRef<string | null>(null);

  // Auto-connect on mount if requested
  useEffect(() => {
    if (autoConnect && !channelToken) {
      connectRef.current();
    }
  }, [autoConnect, channelToken]);

  // When channelToken is ready, auto-call signIn() and open Farcaster
  useEffect(() => {
    if (channelToken && url) {
      if (didSignInRef.current !== channelToken) {
        didSignInRef.current = channelToken;
        signInRef.current();
      }
      if (didOpenUrlRef.current !== url) {
        didOpenUrlRef.current = url;
        window.open(url, "_blank", "noopener,noreferrer");
      }
    }
  }, [channelToken, url]);

  // Expose methods to parent components via window.__farcasterAuth
  useEffect(() => {
    if (typeof window === "undefined") return;

    (window as any).__farcasterAuth = {
      signIn: () => signInRef.current(),
      signOut: () => {
        signOutRef.current();
        onSignOut?.();
      },
      connect: () => connectRef.current(),
      reconnect: () => reconnectRef.current(),
      isSuccess,
      isError,
      error,
      channelToken,
      url,
      data,
      validSignature,
    };

    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).__farcasterAuth;
      }
    };
  }, [isSuccess, isError, error, channelToken, url, data, validSignature, onSignOut]);

  return null;
}

/**
 * INTERNAL CLIENT COMPONENT - DO NOT IMPORT DIRECTLY
 *
 * This component is ONLY loaded via dynamic import with ssr:false.
 * It wraps everything in AuthKitProvider so useSignIn has context.
 */
export default function FarcasterAuthIslandClient(props: FarcasterAuthIslandClientProps) {
  return (
    <AuthKitProvider config={config}>
      <FarcasterAuthInner {...props} />
    </AuthKitProvider>
  );
}
