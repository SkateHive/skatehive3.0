"use client";
import React, { useState, useCallback, useEffect, useRef } from "react";
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
import { FaEthereum, FaHive } from "react-icons/fa";
import { SiHiveBlockchain } from "react-icons/si";
import { TbKey, TbDeviceUsb, TbShieldCheck, TbSkateboard, TbWallet } from "react-icons/tb";
import { useAccount, useConnect, useConnectors, type Connector } from "wagmi";
import { useInjectedWallets } from "@/hooks/useInjectedWallets";
import { useTranslations } from "@/lib/i18n/hooks";
import {
  isKeepKeyHiveUnsupportedError,
  isKeepKeyIdentity,
  isSkateWalletIdentity,
  requestKeepKeyHiveAccount,
} from "@/lib/wallet/injectedWallets";

const SKATE_WALLET_INSTALL_URL =
  "https://chromewebstore.google.com/detail/skate-wallet/cjliamjehanfbhakipngddcpnpaijnbi";
/** What the Keychain provider is called in the modal, after the extension behind it. */
type KeychainLabel = "Keychain" | "Skate Wallet" | "KeepKey";

const KEEPKEY_GET_STARTED_URL = "https://www.keepkey.com";

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
  /** Called on a successful Hive-layer login. Receives the Hive username so
   *  callers can bootstrap an app-account (userbase) session from it. */
  onSuccess?: (username: string) => void;
}

// Provider option component
function ProviderOption({
  name,
  icon,
  description,
  onClick,
  isLoading,
  isPopular,
  badge,
}: {
  name: string;
  icon: any;
  description: string;
  onClick: () => void;
  isLoading?: boolean;
  isPopular?: boolean;
  badge?: string;
}) {
  const badgeText = badge ?? (isPopular ? "popular" : undefined);
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
          {badgeText && (
            <Text 
              fontFamily="mono" 
              fontSize="2xs" 
              color="gray.500" 
              bg="whiteAlpha.100"
              px={1.5}
              py={0.5}
              borderRadius="sm"
            >
              {badgeText}
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
  // Which wallet the user picked for the Keychain provider (Skate Wallet shares its API).
  const [keychainLabel, setKeychainLabel] = useState<KeychainLabel>("Keychain");
  const [evmConnecting, setEvmConnecting] = useState<string | null>(null);
  const submitLoginRef = useRef<
    (name?: string, provider?: HiveProvider, label?: KeychainLabel) => Promise<void>
  >(async () => {});

  const tw = useTranslations("walletConnect");
  const { skateWalletDetected, keepKeyHiveDetected } = useInjectedWallets(isOpen);
  // The Skate Wallet replaces KeepKey's shim when both are installed, so it wins.
  const keepKeyHiveEntry = keepKeyHiveDetected && !skateWalletDetected;

  // Bumped on every open/close so an EVM connect that resolves after the
  // modal was closed (and maybe reopened) can't close or reset the new opening.
  const openingRef = useRef(0);
  useEffect(() => {
    openingRef.current += 1;
  }, [isOpen]);
  const connectors = useConnectors();
  const { connectAsync } = useConnect();
  const { connector: activeConnector, isConnected: isEvmConnected } = useAccount();

  // wagmi turns every EIP-6963 announcement into a connector (id = rdns).
  const skateWalletConnector = connectors.find((c) => isSkateWalletIdentity(c));
  const keepKeyConnector = connectors.find((c) => isKeepKeyIdentity(c));

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
    setEvmConnecting(null);
    onClose();
  }, [onClose]);

  const handleBack = useCallback(() => {
    setStep('providers');
    setSelectedProvider(null);
    setUsername("");
  }, []);

  const handleProviderSelect = useCallback(async (
    provider: HiveProvider,
    label: KeychainLabel = "Keychain"
  ) => {
    // All providers need username input first
    setKeychainLabel(label);
    setSelectedProvider(provider);
    setStep('username');
    if (label !== "KeepKey") return;
    // The KeepKey Client can share its account name once the user approves
    // this site; then there is nothing to type. Older builds lack the method.
    const keepKeyAccount = await requestKeepKeyHiveAccount(window);
    if (keepKeyAccount) {
      setUsername(keepKeyAccount);
      void submitLoginRef.current(keepKeyAccount, provider, label);
    }
  }, []);

  // Takes the account and provider directly when called right after a state
  // change (KeepKey hands over its account name), else reads them from state.
  const submitLogin = useCallback(async (
    nameArg?: string,
    providerArg?: HiveProvider,
    labelArg?: KeychainLabel,
  ) => {
    const provider = providerArg ?? selectedProvider;
    const label = labelArg ?? keychainLabel;
    const name = nameArg ?? username;
    if (!name.trim() || !provider) return;
    
    setIsLoading(true);
    
    const uname = name.trim().toLowerCase();
    try {
      // aioha rejects login() with 4901 "Already logged in" when this account
      // is already in its session store. That happens after connecting an EVM
      // wallet that has a linked Hive account: the Hive session is carried over,
      // but the user still sees "sign in" and clicking it tries to re-login.
      // Reuse the existing session instead of hard-failing.
      if (aioha.getCurrentUser() === uname) {
        toast({ status: "success", title: `connected: ${uname}`, duration: 3000 });
        onSuccess?.(uname);
        handleClose();
        return;
      }
      if ((aioha.getOtherLogins() || {})[uname]) {
        // Stored as a secondary account — activate it. If the switch can't be
        // performed (its provider isn't registered this session), drop the
        // stale entry so the fresh login below isn't blocked by the 4901 guard.
        if (aioha.switchUser(uname)) {
          toast({ status: "success", title: `connected: ${uname}`, duration: 3000 });
          onSuccess?.(uname);
          handleClose();
          return;
        }
        aioha.removeOtherLogin(uname);
      }

      const result = await aioha.login(provider, uname, {
        msg: "Login to Skatehive",
        keyType: KeyTypes.Posting,
      });

      if (result.success) {
        toast({
          status: "success",
          title: `connected: ${result.username}`,
          duration: 3000,
        });
        onSuccess?.(uname);
        handleClose();
      } else if (
        provider === Providers.Keychain &&
        label !== "KeepKey" &&
        isKeepKeyHiveUnsupportedError(result.error)
      ) {
        toast({
          status: "warning",
          title: tw("keepKeyHiveTitle"),
          description: tw("keepKeyHiveBody"),
          duration: 9000,
          isClosable: true,
        });
      } else {
        toast({
          status: "error",
          title: "connection failed",
          description: result.error,
          duration: 5000,
        });
      }
    } catch (error: any) {
      // The warning is about the Skate Wallet refusing KeepKey-held accounts. The
      // KeepKey Client's own errors (no Hive account yet, wrong account) also name
      // "KeepKey", so show those as they are.
      const keepKeyUnsupported =
        provider === Providers.Keychain &&
        label !== "KeepKey" &&
        isKeepKeyHiveUnsupportedError(error);
      toast({
        status: keepKeyUnsupported ? "warning" : "error",
        title: keepKeyUnsupported ? tw("keepKeyHiveTitle") : "connection error",
        description: keepKeyUnsupported
          ? tw("keepKeyHiveBody")
          : error?.message || "Unknown error",
        duration: keepKeyUnsupported ? 9000 : 5000,
        isClosable: keepKeyUnsupported,
      });
    } finally {
      setIsLoading(false);
    }
  }, [aioha, selectedProvider, keychainLabel, username, toast, onSuccess, handleClose, tw]);

  const handleUsernameSubmit = useCallback(() => submitLogin(), [submitLogin]);
  submitLoginRef.current = submitLogin;

  const handleEvmConnect = useCallback(async (connector: Connector | undefined, label: string) => {
    if (!connector) return;
    const opening = openingRef.current;
    const isCurrentOpening = () => openingRef.current === opening;
    setEvmConnecting(connector.id);
    try {
      await connectAsync({ connector });
      toast({
        status: "success",
        title: tw("connectedToast").replace("{name}", label),
        duration: 3000,
      });
      if (isCurrentOpening()) handleClose();
    } catch (error: any) {
      toast({
        status: "error",
        title: tw("connectFailed").replace("{name}", label),
        description: error?.shortMessage || error?.message || "Unknown error",
        duration: 5000,
      });
    } finally {
      if (isCurrentOpening()) setEvmConnecting(null);
    }
  }, [connectAsync, toast, handleClose, tw]);

  const isEvmConnectedWith = (connector?: Connector) =>
    !!connector && isEvmConnected && activeConnector?.id === connector.id;

  const getProviderName = (provider: HiveProvider) => {
    switch (provider) {
      case Providers.Keychain: return keychainLabel;
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
              {/* Skate Wallet - drives the same window.hive_keychain API through
                  Aioha's Keychain provider, so it replaces the generic entry. */}
              {availableProviders.keychain && skateWalletDetected && (
                <ProviderOption
                  name="Skate Wallet"
                  icon={TbSkateboard}
                  description={tw("skateWalletHiveDesc")}
                  onClick={() => handleProviderSelect(Providers.Keychain, "Skate Wallet")}
                  isLoading={loadingProvider === Providers.Keychain}
                  badge={tw("recommended")}
                />
              )}

              {/* KeepKey Client - its window.hive_keychain shim signs on the device. */}
              {availableProviders.keychain && keepKeyHiveEntry && (
                <ProviderOption
                  name="KeepKey"
                  icon={TbWallet}
                  description={tw("keepKeyHiveDesc")}
                  onClick={() => handleProviderSelect(Providers.Keychain, "KeepKey")}
                  isLoading={loadingProvider === Providers.Keychain}
                />
              )}

              {/* Keychain - Most Popular */}
              {availableProviders.keychain && !skateWalletDetected && !keepKeyHiveEntry && (
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

              {/* Skate Wallet not installed: discreet install hint */}
              {!skateWalletDetected && (
                <Button
                  variant="ghost"
                  size="xs"
                  fontFamily="mono"
                  color="gray.500"
                  leftIcon={<Icon as={TbSkateboard} />}
                  onClick={() => window.open(SKATE_WALLET_INSTALL_URL, "_blank", "noopener,noreferrer")}
                  _hover={{ color: "primary", bg: "whiteAlpha.50" }}
                  justifyContent="center"
                  textTransform="lowercase"
                  fontSize="2xs"
                >
                  {tw("getSkateWallet")}
                </Button>
              )}
            </VStack>

            {/* EVM wallets */}
            <VStack spacing={2} align="stretch">
              <HStack spacing={2} justify="center" pt={1}>
                <Icon as={FaEthereum} boxSize={4} color="blue.300" />
                <Text fontFamily="mono" fontSize="sm" color="primary">
                  evm
                </Text>
              </HStack>

              {skateWalletConnector && (
                <ProviderOption
                  name="Skate Wallet"
                  icon={TbSkateboard}
                  description={
                    isEvmConnectedWith(skateWalletConnector)
                      ? tw("connected")
                      : tw("skateWalletEvmDesc")
                  }
                  onClick={() =>
                    isEvmConnectedWith(skateWalletConnector)
                      ? handleClose()
                      : handleEvmConnect(skateWalletConnector, "Skate Wallet")
                  }
                  isLoading={evmConnecting === skateWalletConnector.id}
                />
              )}

              <ProviderOption
                name="KeepKey"
                icon={TbWallet}
                description={
                  keepKeyConnector
                    ? isEvmConnectedWith(keepKeyConnector)
                      ? tw("connected")
                      : tw("keepKeyDesc")
                    : tw("keepKeyMissingDesc")
                }
                onClick={() =>
                  keepKeyConnector
                    ? isEvmConnectedWith(keepKeyConnector)
                      ? handleClose()
                      : handleEvmConnect(keepKeyConnector, "KeepKey")
                    : window.open(KEEPKEY_GET_STARTED_URL, "_blank", "noopener,noreferrer")
                }
                isLoading={!!keepKeyConnector && evmConnecting === keepKeyConnector.id}
                badge={keepKeyConnector ? undefined : tw("notDetected")}
              />
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
