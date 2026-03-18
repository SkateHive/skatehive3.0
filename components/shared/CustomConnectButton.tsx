"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Box, Button, HStack, Text, VStack } from "@chakra-ui/react";
import { EnsName as Name, EnsAvatar as Avatar } from "@/components/shared/EnsIdentity";
import { useTranslations } from "@/contexts/LocaleContext";

interface CustomConnectButtonProps {
  showBalance?: boolean;
  showNetworkName?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "ghost";
}

export function CustomConnectButton({
  showBalance = true,
  showNetworkName = false,
  size = "md",
  variant = "primary",
}: CustomConnectButtonProps) {
  const t = useTranslations();

  const getButtonSize = () => {
    switch (size) {
      case "sm":
        return { h: "32px", px: 3, fontSize: "sm" };
      case "lg":
        return { h: "48px", px: 6, fontSize: "lg" };
      default:
        return { h: "40px", px: 4, fontSize: "md" };
    }
  };

  const getButtonStyles = () => {
    const baseStyles = {
      background: "transparent",
      borderRadius: "md",
      fontWeight: "medium",
      transition: "all 0.2s",
      border: "1px solid",
      ...getButtonSize(),
    };

    switch (variant) {
      case "secondary":
        return {
          ...baseStyles,
          bg: "muted",
          color: "text",
          borderColor: "border",
          _hover: { bg: "background", borderColor: "primary" },
        };
      case "ghost":
        return {
          ...baseStyles,
          bg: "transparent",
          color: "text",
          borderColor: "transparent",
          _hover: { bg: "muted", borderColor: "border" },
        };
      default:
        return {
          ...baseStyles,
          bg: "background",
          color: "text",
          borderColor: "primary",
          _hover: { bg: "primary", color: "background" },
        };
    }
  };

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        return (
          <Box
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <Button onClick={openConnectModal} {...getButtonStyles()}>
                    {t('auth.connectWallet')}
                  </Button>
                );
              }

              if (chain.unsupported) {
                return (
                  <Button
                    onClick={openChainModal}
                    bg="error"
                    color="background"
                    borderColor="error"
                    _hover={{ bg: "error", opacity: 0.8 }}
                    {...getButtonSize()}
                    borderRadius="none"
                    fontWeight="medium"
                    border="1px solid"
                  >
                    {t('wallet.wrongNetwork')}
                  </Button>
                );
              }

              return (
                <HStack spacing={2}>
                  {/* Chain Indicator - only show if requested */}
                  {showNetworkName && (
                    <Button
                      onClick={openChainModal}
                      variant="ghost"
                      size="sm"
                      color="text"
                      _hover={{ bg: "muted" }}
                      borderRadius="none"
                      minW="auto"
                      px={2}
                      h="32px"
                    >
                      {chain.hasIcon && (
                        <Box
                          as="img"
                          src={chain.iconUrl}
                          alt={chain.name ?? "Chain icon"}
                          boxSize="16px"
                          borderRadius="full"
                          mr={1}
                        />
                      )}
                      <Text fontSize="xs">{chain.name}</Text>
                    </Button>
                  )}

                  {/* Account Info with OnchainKit Identity */}
                  <Button
                    onClick={openAccountModal}
                    {...getButtonStyles()}
                    minW="auto"
                  >
                    <HStack spacing={3}>
                      <Avatar
                        address={account.address as `0x${string}`}
                        className="w-6 h-6 rounded-full"
                      />

                      <VStack spacing={0} align="start" minW="0">
                        <Box maxW="120px" overflow="hidden">
                          <Name
                            address={account.address as `0x${string}`}
                            className="text-sm font-medium truncate"
                            style={{ color: "var(--chakra-colors-primary)" }}
                          />
                        </Box>

                        {/* Balance - only show if requested */}
                        {showBalance && account.displayBalance && (
                          <Text
                            fontSize="xs"
                            color="accent"
                            fontFamily="mono"
                            lineHeight="1"
                          >
                            {account.displayBalance}
                          </Text>
                        )}
                      </VStack>
                    </HStack>
                  </Button>
                </HStack>
              );
            })()}
          </Box>
        );
      }}
    </ConnectButton.Custom>
  );
}
