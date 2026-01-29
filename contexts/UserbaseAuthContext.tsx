"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export interface UserbaseUser {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
  onboarding_step: number;
}

interface UserbaseAuthContextValue {
  user: UserbaseUser | null;
  sessionId: string | null;
  expiresAt: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  identitiesVersion: number;
  bumpIdentitiesVersion: () => void;
}

const UserbaseAuthContext = createContext<UserbaseAuthContextValue | null>(null);

export function UserbaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserbaseUser | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [identitiesVersion, setIdentitiesVersion] = useState(0);
  const lastRefreshRef = useRef(0);
  const userRef = useRef<UserbaseUser | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const expiresAtRef = useRef<string | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);
  useEffect(() => {
    expiresAtRef.current = expiresAt;
  }, [expiresAt]);

  const areUsersEqual = useCallback((a: UserbaseUser | null, b: UserbaseUser | null) => {
    if (a === b) return true;
    if (!a || !b) return false;
    return (
      a.id === b.id &&
      a.handle === b.handle &&
      a.display_name === b.display_name &&
      a.avatar_url === b.avatar_url &&
      a.status === b.status &&
      a.onboarding_step === b.onboarding_step
    );
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading((prev) => (prev ? prev : true));
    setError(null);
    try {
      const response = await fetch("/api/userbase/auth/session", {
        cache: "no-store",
      });
      if (response.ok) {
        const data = await response.json();
        const nextUser = data?.user ?? null;
        const nextSessionId = data?.session_id ?? null;
        const nextExpiresAt = data?.expires_at ?? null;
        if (!areUsersEqual(userRef.current, nextUser)) {
          setUser(nextUser);
        }
        if (sessionIdRef.current !== nextSessionId) {
          setSessionId(nextSessionId);
        }
        if (expiresAtRef.current !== nextExpiresAt) {
          setExpiresAt(nextExpiresAt);
        }
      } else if (response.status === 401) {
        if (userRef.current !== null) setUser(null);
        if (sessionIdRef.current !== null) setSessionId(null);
        if (expiresAtRef.current !== null) setExpiresAt(null);
      } else {
        const data = await response.json().catch(() => null);
        setError(data?.error || "Failed to load session");
      }
    } catch (requestError) {
      console.error("Failed to fetch userbase session", requestError);
      setError("Failed to load session");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await fetch("/api/userbase/auth/logout", {
        method: "POST",
      });
    } catch (requestError) {
      console.error("Failed to sign out userbase session", requestError);
    } finally {
      setUser(null);
      setSessionId(null);
      setExpiresAt(null);
      setIdentitiesVersion(0);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const bumpIdentitiesVersion = useCallback(() => {
    setIdentitiesVersion((prev) => prev + 1);
  }, []);

  const maybeRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRefreshRef.current < 10_000) {
      return;
    }
    lastRefreshRef.current = now;
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleFocus = () => maybeRefresh();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        maybeRefresh();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [maybeRefresh]);

  return (
    <UserbaseAuthContext.Provider
      value={{
        user,
        sessionId,
        expiresAt,
        isLoading,
        error,
        refresh,
        signOut,
        identitiesVersion,
        bumpIdentitiesVersion,
      }}
    >
      {children}
    </UserbaseAuthContext.Provider>
  );
}

export function useUserbaseAuth() {
  const context = useContext(UserbaseAuthContext);
  if (!context) {
    throw new Error("useUserbaseAuth must be used within UserbaseAuthProvider");
  }
  return context;
}
