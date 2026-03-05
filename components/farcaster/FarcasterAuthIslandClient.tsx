"use client";

import { AuthKitProvider, SignInButton, useSignIn } from "@farcaster/auth-kit";
// CSS import removed - it was processed at build time even with dynamic ssr:false,
// potentially including auth-kit side-effects in server bundle
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
 * INTERNAL CLIENT COMPONENT - DO NOT IMPORT DIRECTLY
 * 
 * This component is ONLY loaded via dynamic import with ssr:false.
 * It contains all @farcaster/auth-kit imports and must NEVER be
 * imported statically anywhere in the app.
 */
export default function FarcasterAuthIslandClient({
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
      // Save session to localStorage for useFarcasterSession hook
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
    onSignOut,
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
    <AuthKitProvider config={config}>
      <Box style={buttonStyle}>
        <SignInButton
          onSuccess={onSuccess}
          onError={onError}
        />
      </Box>
    </AuthKitProvider>
  );
}
