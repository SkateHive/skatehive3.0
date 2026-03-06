import React from "react";
import {
  Tooltip,
  IconButton,
  Text,
  TooltipProps,
  IconButtonProps,
  Image,
} from "@chakra-ui/react";

interface ZoraButtonProps {
  wordCount: number;
  onClick: () => void;
  fontSize?: string;
  tooltipPlacement?: TooltipProps["placement"];
  iconButtonProps?: Partial<IconButtonProps>;
}

export const ZoraButton = React.memo<ZoraButtonProps>(
  ({
    wordCount,
    onClick,
    fontSize = "10px",
    tooltipPlacement = "top",
    iconButtonProps = {},
  }) => {
    return (
      <Tooltip
        label={`Create Zora coin from this ${wordCount} word post`}
        placement={tooltipPlacement}
      >
        <IconButton
          aria-label="Create Zora coin"
          icon={<Image src="/logos/Zorb.png" alt="Zora Icon" boxSize="12px" />}
          size="sm"
          variant="ghost"
          color="primary"
          onClick={onClick}
          _hover={{ bg: "transparent", color: "accent" }}
          fontSize={fontSize}
          minW="auto"
          h="auto"
          p={1}
          {...(iconButtonProps as Record<string, unknown>)}
        />
      </Tooltip>
    );
  }
);

ZoraButton.displayName = "ZoraButton";
