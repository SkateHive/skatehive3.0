"use client";

import { AuthKitProvider, useSignIn } from "@farcaster/auth-kit";
import { APP_CONFIG } from "@/config/app.config";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveFarcasterSession } from "@/hooks/useFarcasterSession";
import FarcasterSignInModal from "./FarcasterSignInModal";

/**
 * SIWE binds the signature to the origin that requested it, so `domain` and
 * `siweUri` have to match wherever the app is actually being served.
 *
 * The previous version special-cased the literal hostname "localhost" and fell
 * back to the hardcoded skatehive.app for everything else, which silently broke
 * sign-in on 127.0.0.1, on a LAN IP (how you reach a dev server from a phone),
 * and on every Vercel preview deployment. Reading window.location is correct in
 * all of them at once.
 *
 * APP_CONFIG is only a non-browser fallback — this module is loaded with
 * ssr:false, so in practice window is always present.
 */
function resolveSiweConfig() {
  if (typeof window === "undefined") {
    return {
      siweUri: APP_CONFIG.ORIGIN || APP_CONFIG.BASE_URL,
      domain: APP_CONFIG.DOMAIN,
    };
  }
  return {
    siweUri: window.location.origin,
    // host, not hostname: the SIWE authority includes a non-default port.
    domain: window.location.host,
  };
}

const config = {
  relay: "https://relay.farcaster.xyz",
  rpcUrl: "https://mainnet.optimism.io",
  ...resolveSiweConfig(),
};

interface FarcasterAuthIslandClientProps {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  onSignOut?: () => void;
  onStatusResponse?: (data: any) => void;
  /** Fired when the user dismisses the sign-in modal without completing it. */
  onCancel?: () => void;
  autoConnect?: boolean;
  nonce?: () => Promise<string>;
}

/**
 * Inner component that uses useSignIn — MUST be inside AuthKitProvider.
 *
 * Renders the sign-in modal (QR on desktop, deep link on mobile) whenever a
 * sign-in is in flight. connect/signIn are still driven programmatically via
 * window.__farcasterAuth. The hidden <SignInButton> stays removed to avoid a
 * competing useSignIn instance in the same AuthKitProvider.
 */
function FarcasterAuthInner({
  onSuccess,
  onError,
  onSignOut,
  onStatusResponse,
  onCancel,
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

  // Whether a sign-in attempt is in flight (drives the modal).
  const [isFlowOpen, setIsFlowOpen] = useState(false);

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
      setIsFlowOpen(false);
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

  // Guard to prevent duplicate signIn calls for the same channel
  const didSignInRef = useRef<string | null>(null);

  /**
   * Start a sign-in attempt and show the modal.
   *
   * Resetting didFireSuccessRef matters: without it a second sign-in in the
   * same page session would never fire onSuccess, so the session would never
   * be persisted again after a disconnect.
   */
  const startFlow = useCallback(() => {
    didFireSuccessRef.current = false;
    completedDataRef.current = null;
    didSignInRef.current = null;
    setIsFlowOpen(true);
    connectRef.current();
  }, []);

  const closeFlow = useCallback(() => {
    setIsFlowOpen(false);
    // Reset auth-kit so the next attempt gets a fresh channel instead of
    // reusing a stale, already-consumed one.
    signOutRef.current();
    onCancel?.();
  }, [onCancel]);

  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    },
    []
  );

  const retryFlow = useCallback(() => {
    signOutRef.current();
    // Let auth-kit's signOut state reset commit before opening a new channel —
    // connect() in the same tick can be a no-op because auth-kit still thinks
    // the old channel is live, which would make retry silently do nothing.
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => startFlow(), 0);
  }, [startFlow]);

  // Auto-connect on mount if requested
  useEffect(() => {
    if (autoConnect && !channelToken) {
      connectRef.current();
    }
  }, [autoConnect, channelToken]);

  // When channelToken is ready, auto-call signIn() so the relay starts polling.
  // The URL is NOT opened here — a programmatic window.open this far from the
  // click gets popup-blocked, and desktop needs a QR anyway (see issue #94).
  // FarcasterSignInModal renders the URL and opens it from a real click.
  useEffect(() => {
    if (channelToken && url && didSignInRef.current !== channelToken) {
      didSignInRef.current = channelToken;
      signInRef.current();
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
      // connect() now also opens the sign-in modal — callers just call it.
      connect: () => startFlow(),
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
  }, [isSuccess, isError, error, channelToken, url, data, validSignature, onSignOut, startFlow]);

  return (
    <FarcasterSignInModal
      isOpen={isFlowOpen}
      onClose={closeFlow}
      url={url ?? null}
      isError={isError}
      error={error}
      onRetry={retryFlow}
    />
  );
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
