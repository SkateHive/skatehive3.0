"use client";
import React, { useEffect } from "react";
import { Flex, Spinner } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import useEffectiveHiveUser from "@/hooks/useEffectiveHiveUser";

// Prediction markets are Hive-only: bets and market creation are on-chain
// operations, and the section isn't advertised to non-Hive users. Anyone
// without a Hive account (wallet-connected or linked identity) who lands here
// directly is redirected home rather than shown the section.
export default function HiveAccessGate({ children }: { children: React.ReactNode }) {
  const { handle, isLoading } = useEffectiveHiveUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !handle) {
      router.replace("/");
    }
  }, [isLoading, handle, router]);

  // Spinner while resolving identity, and during the redirect (no flash of
  // gated content for non-Hive users).
  if (isLoading || !handle) {
    return (
      <Flex justify="center" py={20}>
        <Spinner color="primary" size="lg" />
      </Flex>
    );
  }

  return <>{children}</>;
}
