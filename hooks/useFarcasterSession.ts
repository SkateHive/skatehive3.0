"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';

/**
 * Farcaster session hook that reads ONLY from localStorage.
 * 
 * CRITICAL: This hook must NOT import or depend on @farcaster/auth-kit
 * in any way (not even dynamic require), because that would bundle
 * auth-kit code into the server chunk and cause indexedDB errors.
 * 
 * Session data is persisted to localStorage by FarcasterAuthIslandClient
 * when auth succeeds. This hook only reads from localStorage.
 */

interface FarcasterSession {
  fid: number;
  username: string;
  pfpUrl?: string;
  bio?: string;
  displayName?: string;
  /**
   * Farcaster custody address associated with the user.
   * Included when restoring a session from Auth Kit.
   */
  custody?: `0x${string}`;
  /**
   * Array of verified wallet addresses for this Farcaster account.
   */
  verifications?: string[];
  timestamp: number;
}

const SESSION_KEY = 'farcaster_session';
const SESSION_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

export function useFarcasterSession() {
  const [sessionData, setSessionData] = useState<FarcasterSession | null>(null);
  const [hasPersistedSession, setHasPersistedSession] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const restoreSession = () => {
      try {
        const savedSession = localStorage.getItem(SESSION_KEY);
        if (savedSession) {
          const session: FarcasterSession = JSON.parse(savedSession);
          const isExpired = Date.now() - session.timestamp > SESSION_EXPIRY;
          
          if (isExpired) {
            localStorage.removeItem(SESSION_KEY);
            setHasPersistedSession(false);
            setSessionData(null);
          } else {
            setHasPersistedSession(true);
            setSessionData(session);
          }
        } else {
          setHasPersistedSession(false);
          setSessionData(null);
        }
      } catch (error) {
        // console.warn('Failed to restore Farcaster session:', error);
        localStorage.removeItem(SESSION_KEY);
        setHasPersistedSession(false);
        setSessionData(null);
      } finally {
        setIsRestoring(false);
      }
    };

    restoreSession();
  }, []);

  // Clear session on sign out
  const clearSession = useCallback(() => {
    // Clear localStorage
    localStorage.removeItem(SESSION_KEY);
    
    // Also try to clear any other Farcaster-related localStorage items
    try {
      // Check for any keys that might be related to Farcaster Auth Kit
      Object.keys(localStorage).forEach(key => {
        if (key.includes('farcaster') || key.includes('authkit') || key.includes('fc_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('[FarcasterSession] Error clearing additional storage:', error);
    }
    
    // Update state
    setHasPersistedSession(false);
    setSessionData(null);
  }, []);

  // Get persisted session data
  const getPersistedSession = useCallback((): FarcasterSession | null => {
    // Return cached sessionData if available
    if (sessionData) return sessionData;
    
    try {
      const savedSession = localStorage.getItem(SESSION_KEY);
      if (savedSession) {
        const session: FarcasterSession = JSON.parse(savedSession);
        const isExpired = Date.now() - session.timestamp > SESSION_EXPIRY;
        
        if (isExpired) {
          localStorage.removeItem(SESSION_KEY);
          return null;
        }
        return session;
      }
    } catch (error) {
      console.warn('Failed to get persisted session:', error);
    }
    return null;
  }, [sessionData]);

  // Compute authentication state from persisted session
  const isAuthenticated = useMemo(() => {
    return hasPersistedSession && sessionData !== null;
  }, [hasPersistedSession, sessionData]);

  // Profile is just the session data
  const profile = useMemo(() => {
    return sessionData;
  }, [sessionData]);


  return {
    isAuthenticated,
    profile,
    hasPersistedSession,
    isRestoring,
    clearSession,
    getPersistedSession,
  };
}

/**
 * Helper function to save Farcaster session to localStorage.
 * 
 * This should be called by FarcasterAuthIslandClient when auth succeeds.
 * It's exported here so the Island can import it without circular deps.
 */
export function saveFarcasterSession(data: {
  fid: number;
  username: string;
  pfpUrl?: string;
  bio?: string;
  displayName?: string;
  custody?: `0x${string}`;
  verifications?: string[];
}) {
  const session: FarcasterSession = {
    ...data,
    timestamp: Date.now(),
  };
  
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    console.error('[FarcasterSession] Failed to save session:', error);
  }
}
