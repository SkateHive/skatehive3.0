"use client";

import { Button, Icon, Tooltip } from "@chakra-ui/react";
import { FaGift } from "react-icons/fa";
import { useTranslations } from "@/lib/i18n/hooks";

export interface SponsorshipUserData {
  liteUserId: string;
  displayName: string;
  handle: string;
}

interface SponsorButtonProps {
  liteUserId: string;
  displayName: string;
  handle: string;
  onSponsorshipInitiated?: (userData: SponsorshipUserData) => void;
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
  const t = useTranslations("userbase");

  const handleClick = () => {
    if (onSponsorshipInitiated) {
      onSponsorshipInitiated({ liteUserId, displayName, handle });
    }
  };

  return (
    <Tooltip label={t("sponsorButton.tooltip")}>
      <Button
        onClick={handleClick}
        leftIcon={<Icon as={FaGift} boxSize={size === "xs" ? 3 : 4} />}
        colorScheme="green"
        size={size}
        variant={variant}
      >
        {t("sponsorButton.label")}
      </Button>
    </Tooltip>
  );
}
