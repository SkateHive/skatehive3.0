"use client";
import React, { useState, useCallback } from "react";
import {
  Button,
  HStack,
  VStack,
  Text,
  Input,
  Icon,
  useToast,
  Box,
  Spinner,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import SkateModal from "@/components/shared/SkateModal";
import { useAioha } from "@aioha/react-ui";
import { Providers, KeyTypes } from "@aioha/aioha";
import { FaHive } from "react-icons/fa";
import { SiHiveBlockchain } from "react-icons/si";
import { TbKey, TbDeviceUsb, TbShieldCheck } from "react-icons/tb";

// Type for provider values (workaround for enum type usage)
type HiveProvider = (typeof Providers)[keyof typeof Providers];

// Blinking cursor animation
const blink = keyframes`
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
`;

interface HiveLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Provider option component
function ProviderOption({
  name,
  icon,
  description,
  onClick,
  isLoading,
  isPopular,
}: {
  name: string;
  icon: any;
  description: string;
  onClick: () => void;
  isLoading?: boolean;
  isPopular?: boolean;
}) {
  return (
    <HStack
      as="button"
      w="full"
      py={3}
      px={3}
      cursor="pointer"
      onClick={onClick}
      transition="all 0.2s"
      bg="whiteAlpha.50"
      borderRadius="sm"
      border="1px solid"
      borderColor="whiteAlpha.100"
      _hover={{
        bg: "whiteAlpha.100",
        borderColor: "primary",
        "& .provider-arrow": {
          opacity: 1,
          transform: "translateX(4px)",
        },
      }}
      _active={{
        bg: "whiteAlpha.150",
      }}
      disabled={isLoading}
      opacity={isLoading ? 0.7 : 1}
    >
      <Icon as={icon} boxSize={4} color="primary" />
      <VStack align="start" spacing={0} flex={1}>
        <HStack spacing={2}>
          <Text fontFamily="mono" fontSize="sm" color="text" textTransform="lowercase">
            {name}
          </Text>
          {isPopular && (
            <Text 
              fontFamily="mono" 
              fontSize="2xs" 
              color="gray.500" 
              bg="whiteAlpha.100"
              px={1.5}
              py={0.5}
              borderRadius="sm"
            >
              popular
            </Text>
          )}
        </HStack>
        <Text fontFamily="mono" fontSize="2xs" color="gray.500">
          {description}
        </Text>
      </VStack>
      {isLoading ? (
        <Spinner size="xs" color="primary" />
      ) : (
        <Text
          className="provider-arrow"
          fontFamily="mono"
          fontSize="sm"
          color="primary"
          opacity={0.5}
          transition="all 0.2s"
        >
          →
        </Text>
      )}
    </HStack>
  );
}

export default function HiveLoginModal({
  isOpen,
  onClose,
  onSuccess,
}: HiveLoginModalProps) {
  const { aioha } = useAioha();
  const toast = useToast();
  
  const [step, setStep] = useState<'providers' | 'username'>('providers');
  const [selectedProvider, setSelectedProvider] = useState<HiveProvider | null>(null);
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<HiveProvider | null>(null);

  // Check which providers are available
  const availableProviders = {
    keychain: typeof window !== 'undefined' && !!(window as any).hive_keychain,
    hiveauth: true, // Always available
    ledger: true, // Always available (requires device)
    peakvault: typeof window !== 'undefined' && !!(window as any).peakvault,
  };

  const handleClose = useCallback(() => {
    setStep('providers');
    setSelectedProvider(null);
    setUsername("");
    setIsLoading(false);
    setLoadingProvider(null);
    onClose();
  }, [onClose]);

  const handleBack = useCallback(() => {
    setStep('providers');
    setSelectedProvider(null);
    setUsername("");
  }, []);

  const handleProviderSelect = useCallback(async (provider: HiveProvider) => {
    // All providers need username input first
    setSelectedProvider(provider);
    setStep('username');
  }, []);

  const handleUsernameSubmit = useCallback(async () => {
    if (!username.trim() || !selectedProvider) return;
    
    setIsLoading(true);
    
    try {
      const result = await aioha.login(selectedProvider, username.trim().toLowerCase(), {
        msg: "Login to Skatehive",
        keyType: KeyTypes.Posting,
      });
      
      if (result.success) {
        toast({
          status: "success",
          title: `connected: ${result.username}`,
          duration: 3000,
        });
        onSuccess?.();
        handleClose();
      } else {
        toast({
          status: "error",
          title: "connection failed",
          description: result.error,
          duration: 5000,
        });
      }
    } catch (error: any) {
      toast({
        status: "error",
        title: "connection error",
        description: error?.message || "Unknown error",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [aioha, selectedProvider, username, toast, onSuccess, handleClose]);

  const getProviderName = (provider: HiveProvider) => {
    switch (provider) {
      case Providers.Keychain: return "Keychain";
      case Providers.HiveAuth: return "HiveAuth";
      case Providers.Ledger: return "Ledger";
      case Providers.PeakVault: return "PeakVault";
      default: return provider;
    }
  };

  return (
    <SkateModal
      isOpen={isOpen}
      onClose={handleClose}
      title="connect wallet"
      isCentered={true}
    >
      {/* Subtle noise overlay */}
      <Box
        position="absolute"
        inset={0}
        opacity={0.03}
        pointerEvents="none"
        bgImage="url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')"
      />
      
      <Box p={4} position="relative">
        {step === 'providers' ? (
          <VStack spacing={4} align="stretch">
            {/* Header */}
            <VStack spacing={1} pb={2}>
              <HStack spacing={2}>
                <Icon as={FaHive} boxSize={5} color="red.400" />
                <Text fontFamily="mono" fontSize="lg" color="primary">
                  hive
                </Text>
              </HStack>
              <Text fontFamily="mono" fontSize="xs" color="gray.400" textAlign="center">
                connect with one of our available wallet providers
              </Text>
            </VStack>

            {/* Provider Options */}
            <VStack spacing={2} align="stretch">
              {/* Keychain - Most Popular */}
              {availableProviders.keychain && (
                <ProviderOption
                  name="Keychain"
                  icon={TbKey}
                  description="browser extension · most popular"
                  onClick={() => handleProviderSelect(Providers.Keychain)}
                  isLoading={loadingProvider === Providers.Keychain}
                  isPopular
                />
              )}
              
              {/* HiveAuth - Universal */}
              <ProviderOption
                name="HiveAuth"
                icon={TbShieldCheck}
                description="mobile app · scan qr code"
                onClick={() => handleProviderSelect(Providers.HiveAuth)}
                isLoading={loadingProvider === Providers.HiveAuth}
              />
              
              {/* Ledger */}
              <ProviderOption
                name="Ledger"
                icon={TbDeviceUsb}
                description="hardware wallet · most secure"
                onClick={() => handleProviderSelect(Providers.Ledger)}
                isLoading={loadingProvider === Providers.Ledger}
              />
              
              {/* PeakVault */}
              {availableProviders.peakvault && (
                <ProviderOption
                  name="PeakVault"
                  icon={SiHiveBlockchain}
                  description="browser extension"
                  onClick={() => handleProviderSelect(Providers.PeakVault)}
                  isLoading={loadingProvider === Providers.PeakVault}
                />
              )}
            </VStack>

            {/* Help link */}
            <Box pt={2} borderTop="1px solid" borderColor="whiteAlpha.100">
              <Button
                variant="ghost"
                size="xs"
                fontFamily="mono"
                color="gray.500"
                onClick={() => window.open("https://docs.skatehive.app/docs/Get%20Started/hive-wallets", "_blank")}
                _hover={{ color: "primary", bg: "whiteAlpha.50" }}
                w="full"
                justifyContent="center"
              >
                <Text as="span" color="primary" mr={1.5}>?</Text>
                <Text as="span" textTransform="lowercase" fontSize="2xs">
                  which wallet should i use
                </Text>
              </Button>
            </Box>
          </VStack>
        ) : (
          <VStack spacing={4} align="stretch">
            {/* Back button */}
            <Button
              variant="ghost"
              size="xs"
              fontFamily="mono"
              color="gray.500"
              onClick={handleBack}
              alignSelf="flex-start"
              px={0}
              _hover={{ color: "primary" }}
            >
              ← back
            </Button>

            {/* Username input */}
            <VStack spacing={3} align="stretch">
              <VStack spacing={1}>
                <Text fontFamily="mono" fontSize="sm" color="primary">
                  {getProviderName(selectedProvider!)}
                </Text>
                <Text fontFamily="mono" fontSize="xs" color="gray.400">
                  enter your hive username
                </Text>
              </VStack>

              <Box position="relative">
                <HStack
                  bg="whiteAlpha.50"
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                  borderRadius="sm"
                  h="40px"
                  px={3}
                  _focusWithin={{
                    borderColor: "primary",
                    bg: "whiteAlpha.100",
                  }}
                >
                  <Text
                    fontFamily="mono"
                    fontSize="sm"
                    color="gray.500"
                    userSelect="none"
                  >
                    @
                  </Text>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleUsernameSubmit()}
                    placeholder="username"
                    variant="unstyled"
                    fontFamily="mono"
                    fontSize="sm"
                    color="text"
                    h="full"
                    _placeholder={{ color: "gray.600" }}
                    autoFocus
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    sx={{
                      caretColor: "var(--chakra-colors-primary)",
                    }}
                  />
                </HStack>
              </Box>

              <Button
                onClick={handleUsernameSubmit}
                isLoading={isLoading}
                isDisabled={!username.trim()}
                bg="transparent"
                color="primary"
                border="2px solid"
                borderColor="primary"
                fontFamily="mono"
                fontSize="xs"
                fontWeight="normal"
                textTransform="uppercase"
                letterSpacing="wider"
                h="36px"
                _hover={{
                  bg: "primary",
                  color: "background",
                }}
                _disabled={{
                  opacity: 0.3,
                  cursor: "not-allowed",
                }}
              >
                connect
              </Button>
            </VStack>
          </VStack>
        )}
      </Box>
    </SkateModal>
  );
}
