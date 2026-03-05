"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';

// Conditional import to prevent SSR indexedDB errors
let useProfile: any;
if (typeof window !== 'undefined') {
  useProfile = require('@farcaster/auth-kit').useProfile;
} else {
  // Server-side fallback - return dummy hook
  useProfile = () => ({ isAuthenticated: false, profile: null });
}

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
  const { isAuthenticated, profile } = useProfile();
  const [hasPersistedSession, setHasPersistedSession] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [sessionData, setSessionData] = useState<FarcasterSession | null>(null);

  // Save session to localStorage when authenticated
  useEffect(() => {
    if (isAuthenticated && profile?.fid && profile?.username) {
      const session: FarcasterSession = {
        fid: profile.fid,
        username: profile.username,
        pfpUrl: profile.pfpUrl,
        bio: profile.bio,
        displayName: profile.displayName,
        custody: profile.custody,
        verifications: profile.verifications,
        timestamp: Date.now(),
      };
      
      // Avoid unnecessary localStorage writes and state updates
      const currentSessionString = localStorage.getItem(SESSION_KEY);
      const newSessionString = JSON.stringify(session);
      
      if (currentSessionString !== newSessionString) {
        localStorage.setItem(SESSION_KEY, newSessionString);
        setSessionData(session);
        if (!hasPersistedSession) {
          setHasPersistedSession(true);
        }
      }
    }
  }, [isAuthenticated, profile?.fid, profile?.username, hasPersistedSession]);

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
  }, [hasPersistedSession]);

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

  // Memoize the final authentication state
  const finalIsAuthenticated = useMemo(() => {
    return isAuthenticated || hasPersistedSession;
  }, [isAuthenticated, hasPersistedSession]);

  // Memoize the profile computation
  const computedProfile = useMemo(() => {
    // Prioritize Auth Kit profile if available
    if (isAuthenticated && profile) return profile;
    // Fall back to persisted session data
    if (hasPersistedSession && sessionData) return sessionData;
    // No profile available
    return null;
  }, [isAuthenticated, profile, hasPersistedSession, sessionData]);


  return {
    isAuthenticated: finalIsAuthenticated,
    profile: computedProfile,
    hasPersistedSession,
    isRestoring,
    clearSession,
    getPersistedSession,
  };
}
