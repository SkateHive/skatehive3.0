"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface SignerState {
  // No signerUuid here on purpose. It is the Neynar capability identifier for
  // the user's signer, and the browser has never needed it: every route that
  // casts re-derives it server-side from the session cookie and none accepts
  // one from the client. It used to ride along in the API response and sit in
  // this state with no reader.
  status: "none" | "loading" | "pending_approval" | "approved" | "error";
  approvalUrl: string | null;
  error: string | null;
}

export function useFarcasterSigner() {
  const [state, setState] = useState<SignerState>({
    status: "none",
    approvalUrl: null,
    error: null,
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const checkOrCreateSigner = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading", error: null }));

    try {
      const res = await fetch("/api/farcaster/signer", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setState({
          status: "error",
          approvalUrl: null,
          error: data.error || "Failed to create signer",
        });
        return null;
      }

      const newState: SignerState = {
        status: data.status === "approved" ? "approved" : "pending_approval",
        approvalUrl: data.approvalUrl || null,
        error: null,
      };

      setState(newState);

      // Only poll if we have an approval URL (user needs to approve in Farcaster)
      if (newState.status === "pending_approval" && newState.approvalUrl) {
        startPolling();
      }

      return newState;
    } catch (err) {
      setState({
        status: "error",
        approvalUrl: null,
        error: "Network error",
      });
      return null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/farcaster/signer", { method: "POST" });
        const data = await res.json();

        if (data.status === "approved") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setState({
            status: "approved",
            approvalUrl: null,
            error: null,
          });
        }
      } catch {
        // Keep polling on network errors
      }
    }, 3000);
  }, []);

  return {
    ...state,
    isApproved: state.status === "approved",
    isLoading: state.status === "loading",
    isPending: state.status === "pending_approval",
    checkOrCreateSigner,
  };
}
