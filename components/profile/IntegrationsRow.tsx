"use client";
import React from "react";
import { HStack, IconButton, Tooltip, Icon } from "@chakra-ui/react";
import { IconType } from "react-icons";

export type IntegrationState = "connected" | "not-connected" | "linked-not-active";

interface Integration {
  icon: IconType;
  label: string;
  state: IntegrationState;
  onClick?: () => void;
  href?: string;
}

interface IntegrationsRowProps {
  integrations: Integration[];
  maxVisible?: number;
}

/**
 * Get visual style for integration state
 *
 * State encoding:
 * - connected: filled/bright (primary color) - user has this integration active
 * - not-connected: outline/muted - user doesn't have this
 * - linked-not-active: medium/amber with ring - identity exists but not actively connected
 */
function getIntegrationStyle(state: IntegrationState) {
  switch (state) {
    case "connected":
      return {
        variant: "solid" as const,
        colorScheme: "primary",
        opacity: 1,
        borderWidth: "0px",
        borderColor: "transparent",
      };
    case "linked-not-active":
      return {
        variant: "outline" as const,
        colorScheme: "orange",
        opacity: 0.9,
        borderWidth: "2px",
        borderColor: "orange.400",
      };
    case "not-connected":
    default:
      return {
        variant: "ghost" as const,
        colorScheme: "whiteAlpha",
        opacity: 0.5,
        borderWidth: "1px",
        borderColor: "whiteAlpha.300",
      };
  }
}

/**
 * Integrations Row Component
 *
 * Displays connected accounts with clear visual state:
 * - Filled/bright: actively connected
 * - Outline/amber: linked but not active session
 * - Ghost/muted: not connected
 *
 * Includes hover tooltips for clarity
 */
export default function IntegrationsRow({
  integrations,
  maxVisible = 5,
}: IntegrationsRowProps) {
  if (integrations.length === 0) {
    return null;
  }

  const visibleIntegrations = integrations.slice(0, maxVisible);
  const hasMore = integrations.length > maxVisible;

  return (
    <HStack spacing={2} wrap="wrap" justify={{ base: "flex-start", md: "flex-end" }}>
      {visibleIntegrations.map((integration, idx) => {
        const style = getIntegrationStyle(integration.state);

        return (
          <Tooltip
            key={idx}
            label={integration.label}
            placement="top"
            hasArrow
            bg="gray.800"
            color="white"
          >
            <IconButton
              icon={<Icon as={integration.icon} />}
              aria-label={integration.label}
              size="sm"
              variant={style.variant}
              colorScheme={style.colorScheme}
              opacity={style.opacity}
              borderWidth={style.borderWidth}
              borderColor={style.borderColor}
              onClick={integration.onClick}
              boxShadow="0 2px 4px rgba(0,0,0,0.2)"
              _hover={{
                opacity: 1,
                transform: "translateY(-1px)",
                boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
              }}
              transition="all 0.2s"
            />
          </Tooltip>
        );
      })}

      {hasMore && (
        <Tooltip label={`+${integrations.length - maxVisible} more`} placement="top" hasArrow>
          <IconButton
            icon={<span>•••</span>}
            aria-label="More integrations"
            size="sm"
            variant="ghost"
            colorScheme="whiteAlpha"
            opacity={0.6}
          />
        </Tooltip>
      )}
    </HStack>
  );
}
