"use client";
import React, { ReactNode } from "react";
import { VStack, HStack } from "@chakra-ui/react";

interface ActionsClusterProps {
  primaryActions?: ReactNode[];
  secondaryActions?: ReactNode[];
  orientation?: "vertical" | "horizontal";
}

/**
 * Actions Cluster Component
 *
 * Hierarchy:
 * 1. Primary actions (Edit, Trade, Follow) - larger buttons, highest contrast
 * 2. Secondary actions (smaller icons, menu, etc.)
 *
 * Spacing: Uses 8/12/16px scale for consistent rhythm
 */
export default function ActionsCluster({
  primaryActions = [],
  secondaryActions = [],
  orientation = "vertical",
}: ActionsClusterProps) {
  if (primaryActions.length === 0 && secondaryActions.length === 0) {
    return null;
  }

  return (
    <VStack
      align={{ base: "stretch", md: "flex-end" }}
      spacing={{ base: 3, md: 4 }}
      position="relative"
      zIndex={1}
    >
      {/* Primary actions - highest visual weight */}
      {primaryActions.length > 0 && (
        <HStack spacing={3} justify={{ base: "flex-start", md: "flex-end" }}>
          {primaryActions.map((action, idx) => (
            <React.Fragment key={idx}>{action}</React.Fragment>
          ))}
        </HStack>
      )}

      {/* Secondary actions - lower visual weight */}
      {secondaryActions.length > 0 && (
        <HStack spacing={2} justify={{ base: "flex-start", md: "flex-end" }}>
          {secondaryActions.map((action, idx) => (
            <React.Fragment key={idx}>{action}</React.Fragment>
          ))}
        </HStack>
      )}
    </VStack>
  );
}
