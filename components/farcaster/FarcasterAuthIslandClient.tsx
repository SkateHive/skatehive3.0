"use client";

import { AuthKitProvider, SignInButton, useSignIn } from "@farcaster/auth-kit";
import { APP_CONFIG } from "@/config/app.config";
import { useEffect } from "react";
import { Box } from "@chakra-ui/react";
import { saveFarcasterSession } from "@/hooks/useFarcasterSession";

const config = {
  relay: "https://relay.farcaster.xyz",
  rpcUrl: "https://mainnet.optimism.io",
  siweUri: APP_CONFIG.BASE_URL || "https://skatehive.app",
  domain: APP_CONFIG.DOMAIN || "skatehive.app",
};

interface FarcasterAuthIslandClientProps {
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
 * Inner component that uses useSignIn — MUST be inside AuthKitProvider.
 */
function FarcasterAuthInner({
  onSuccess,
  onError,
  onSignOut,
  onStatusResponse,
  renderButton = true,
  autoConnect = false,
  hidden = false,
  nonce,
}: FarcasterAuthIslandClientProps) {
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
    onSuccess: (res: any) => {
      if (res?.fid && res?.username) {
        saveFarcasterSession({
          fid: res.fid,
          username: res.username,
          pfpUrl: res.pfpUrl,
          bio: res.bio,
          displayName: res.displayName,
          custody: res.custody,
          verifications: res.verifications,
        });
      }
      onSuccess?.(res);
    },
    onError: (err: any) => {
      onError?.(err);
    },
    onStatusResponse: (res: any) => {
      onStatusResponse?.(res);
    },
    ...(nonce ? { nonce } : {}),
  });

  // Auto-connect on mount if requested
  useEffect(() => {
    if (autoConnect && !channelToken) {
      connect();
    }
  }, [autoConnect, channelToken, connect]);

  // Expose methods to parent via window (for cross-component communication)
  useEffect(() => {
    if (typeof window !== "undefined") {
      console.log("[FC Island] Setting window.__farcasterAuth", {
        hasSignIn: typeof signIn === "function",
        hasConnect: typeof connect === "function",
        channelToken: channelToken ? "set" : "null",
        url: url ? "set" : "null",
      });
      (window as any).__farcasterAuth = {
        signIn,
        signOut: () => {
          signOut();
          onSignOut?.();
        },
        connect,
        reconnect,
        isSuccess,
        isError,
        error,
        channelToken,
        url,
        data,
        validSignature,
      };
    }

    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).__farcasterAuth;
      }
    };
  }, [
    signIn, signOut, connect, reconnect, isSuccess, isError,
    error, channelToken, url, data, validSignature, onSignOut,
  ]);

  if (!renderButton) {
    return null;
  }

  const buttonStyle = hidden
    ? {
        position: "absolute" as const,
        top: "-9999px",
        left: "-9999px",
        pointerEvents: "none" as const,
        opacity: 0,
      }
    : {};

  return (
    <Box style={buttonStyle}>
      <SignInButton onSuccess={onSuccess} onError={onError} />
    </Box>
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
