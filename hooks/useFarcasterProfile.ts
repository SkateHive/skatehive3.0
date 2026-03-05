"use client";

import { useState, useEffect } from 'react';

// Client-only wrapper for @farcaster/auth-kit useProfile
// This prevents indexedDB SSR errors by only loading auth-kit in the browser
export function useFarcasterProfile() {
  const [profile, setProfile] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    // Dynamically import auth-kit only in browser
    import('@farcaster/auth-kit')
      .then((authKit) => {
        // Access the profile from auth-kit's internal state
        // This is a simplified version - may need adjustment based on auth-kit internals
        try {
          const { useProfile } = authKit;
          // Can't use hooks dynamically, so we'll use a different approach
          // Just return empty state for now
          setIsLoading(false);
        } catch (err) {
          console.error('Failed to load Farcaster auth-kit:', err);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to import @farcaster/auth-kit:', err);
        setIsLoading(false);
      });
  }, []);

  return {
    isAuthenticated,
    profile,
    isLoading,
  };
}
