"use client";

import { useEffect, useRef, useState } from "react";
import { useAioha } from "@aioha/react-ui";
import { useAccount } from "wagmi";
import { useFarcasterSession } from "@/hooks/useFarcasterSession";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";
import AccountLinkingModal from "./AccountLinkingModal";
import { useAccountLinkingOpportunities } from "@/hooks/useAccountLinkingOpportunities";

/**
 * Component that automatically detects when a new wallet is connected
 * and prompts the user to link it to their userbase account
 */
export default function AccountLinkingDetector() {
  const { user: userbaseUser } = useUserbaseAuth();
  const { user: hiveUser } = useAioha();
  const { address: evmAddress, isConnected: isEvmConnected } = useAccount();
  const { isAuthenticated: isFarcasterConnected, profile: farcasterProfile } = useFarcasterSession();
  const { hasUnlinkedOpportunities, opportunities, refresh, isLoading } = useAccountLinkingOpportunities();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasShownForSession, setHasShownForSession] = useState(false);
  
  // Track previous wallet states to detect new connections
  const prevHiveRef = useRef<string | null>(null);
  const prevEvmRef = useRef<string | null>(null);
  const prevFarcasterRef = useRef<string | null>(null);
  const prevOpportunitiesCountRef = useRef<number>(0);
  
  // Track timeout IDs for cleanup
  const timeoutIdsRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    // Only trigger for userbase users (email login)
    if (!userbaseUser) {
      prevHiveRef.current = null;
      prevEvmRef.current = null;
      prevFarcasterRef.current = null;
      return;
    }

    // Detect new Hive connection
    if (hiveUser && prevHiveRef.current !== hiveUser) {
      const isNewConnection = prevHiveRef.current !== null || !hasShownForSession;
      prevHiveRef.current = hiveUser;
      
      // Check if this Hive account is not already linked OR if there are any unlinked opportunities
      // (e.g., Ethereum/Farcaster accounts found in Hive metadata)
      const hiveNotLinked = opportunities.some(
        (o) => o.type === "hive" && o.handle?.toLowerCase() === hiveUser.toLowerCase() && !o.alreadyLinked
      );
      
      if ((hiveNotLinked || hasUnlinkedOpportunities) && isNewConnection) {
        // Longer delay to allow Hive account metadata to be fetched and parsed
        const timeoutId = setTimeout(() => {
          setIsModalOpen(true);
          setHasShownForSession(true);
        }, 2000);
        timeoutIdsRef.current.push(timeoutId);
      }
    }

    // Detect new EVM connection
    if (evmAddress && isEvmConnected && prevEvmRef.current !== evmAddress) {
      const isNewConnection = prevEvmRef.current !== null;
      prevEvmRef.current = evmAddress;
      
      const evmNotLinked = opportunities.some(
        (o) => o.type === "evm" && o.address?.toLowerCase() === evmAddress.toLowerCase() && !o.alreadyLinked
      );
      
      if (evmNotLinked && isNewConnection && !hasShownForSession) {
        const timeoutId = setTimeout(() => {
          setIsModalOpen(true);
          setHasShownForSession(true);
        }, 500);
        timeoutIdsRef.current.push(timeoutId);
      }
    }

    // Detect new Farcaster connection
    const farcasterFid = farcasterProfile?.fid?.toString();
    if (farcasterFid && isFarcasterConnected && prevFarcasterRef.current !== farcasterFid) {
      const isNewConnection = prevFarcasterRef.current !== null;
      prevFarcasterRef.current = farcasterFid;
      
      const farcasterNotLinked = opportunities.some(
        (o) => o.type === "farcaster" && o.externalId === farcasterFid && !o.alreadyLinked
      );
      
      if (farcasterNotLinked && isNewConnection && !hasShownForSession) {
        const timeoutId = setTimeout(() => {
          setIsModalOpen(true);
          setHasShownForSession(true);
        }, 500);
        timeoutIdsRef.current.push(timeoutId);
      }
    }

    // Detect when NEW opportunities appear (e.g., Hive metadata loaded after connection)
    const currentUnlinkedCount = opportunities.filter(o => !o.alreadyLinked).length;
    if (currentUnlinkedCount > prevOpportunitiesCountRef.current && 
        currentUnlinkedCount > 0 && 
        !hasShownForSession &&
        userbaseUser) {
      prevOpportunitiesCountRef.current = currentUnlinkedCount;
      // Show modal when opportunities increase (metadata loaded)
      const timeoutId = setTimeout(() => {
        setIsModalOpen(true);
        setHasShownForSession(true);
      }, 300);
      timeoutIdsRef.current.push(timeoutId);
    } else {
      prevOpportunitiesCountRef.current = currentUnlinkedCount;
    }

    // Cleanup function to clear all pending timeouts
    return () => {
      timeoutIdsRef.current.forEach(clearTimeout);
      timeoutIdsRef.current = [];
    };
  }, [
    userbaseUser,
    hiveUser,
    evmAddress,
    isEvmConnected,
    isFarcasterConnected,
    farcasterProfile,
    opportunities,
    hasShownForSession,
    hasUnlinkedOpportunities,
  ]);

  // Reset session flag when user logs out
  useEffect(() => {
    if (!userbaseUser) {
      setHasShownForSession(false);
    }
  }, [userbaseUser]);

  // Refresh opportunities when modal closes
  const handleClose = () => {
    setIsModalOpen(false);
    refresh();
  };

  // Don't render modal if no userbase user or no unlinked opportunities
  if (!userbaseUser || !hasUnlinkedOpportunities) {
    return null;
  }

  return (
    <AccountLinkingModal
      isOpen={isModalOpen}
      onClose={handleClose}
      opportunities={opportunities}
      isLoading={isLoading}
      onRefresh={refresh}
    />
  );
}
