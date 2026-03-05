"use client";

import { useState, useEffect } from "react";

// Safe wrapper for @farcaster/auth-kit hooks that only runs in browser
// This prevents indexedDB SSR errors while maintaining full functionality
export function useFarcasterAuth(options: any = {}) {
  const [authKit, setAuthKit] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Only load auth-kit in browser
    if (typeof window === "undefined") return;

    import("@farcaster/auth-kit")
      .then((mod) => {
        setAuthKit(mod);
        setIsLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to load @farcaster/auth-kit:", err);
        setIsLoaded(true);
      });
  }, []);

  // Return dummy values during SSR or before auth-kit loads
  if (!isLoaded || !authKit) {
    return {
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
      isLoaded: false,
    };
  }

  // Use the real useSignIn hook from auth-kit
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const result = authKit.useSignIn(options);

  return {
    ...result,
    isLoaded: true,
  };
}
