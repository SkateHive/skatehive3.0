"use client";

import { Button, Icon, Tooltip } from "@chakra-ui/react";
import { FaGift } from "react-icons/fa";

interface SponsorButtonProps {
  liteUserId: string;
  displayName: string;
  handle: string;
  onSponsorshipInitiated?: () => void;
  size?: "xs" | "sm" | "md" | "lg";
  variant?: "outline" | "solid" | "ghost";
}

/**
 * Sponsor Button Component
 * Shows a "Sponsor" button on lite account profiles
 * Opens sponsorship modal directly (no eligibility check)
 */
export default function SponsorButton({
  liteUserId,
  displayName,
  handle,
  onSponsorshipInitiated,
  size = "sm",
  variant = "outline",
}: SponsorButtonProps) {
  const handleClick = () => {
    if (onSponsorshipInitiated) {
      onSponsorshipInitiated();
    }
  };

  return (
    <Tooltip label="Sponsor this user to create their Hive account">
      <Button
        onClick={handleClick}
        leftIcon={<Icon as={FaGift} boxSize={size === "xs" ? 3 : 4} />}
        colorScheme="green"
        size={size}
        variant={variant}
      >
        Sponsor
      </Button>
    </Tooltip>
  );
}
