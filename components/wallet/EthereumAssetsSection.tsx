import {
  Box,
  Text,
  HStack,
  VStack,
  Spinner,
  Alert,
  AlertIcon,
  Image,
  Flex,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Switch,
  FormControl,
  FormLabel,
  Badge,
  Button,
  useDisclosure,
  IconButton,
} from "@chakra-ui/react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAccount } from "wagmi";
import { FaPaperPlane } from "react-icons/fa";
import {
  Name,
  Avatar,
  IdentityResolver,
} from "@paperclip-labs/whisk-sdk/identity";
import { usePortfolio } from "../../hooks/usePortfolio";
import { TokenDetail, blockchainDictionary } from "../../types/portfolio";
import {
  formatBalance,
  formatValue,
  formatPrice,
  formatMarketCap,
  formatPriceChange,
  groupTokensByNetwork,
  getNetworkTotal,
  filterTokensByBalance,
  sortTokensByBalance,
  getTokenLogoSync,
  getEnhancedTokenData,
  preloadTokenLogos,
  subscribeToLogoUpdates,
  forceRefreshTokenData,
} from "../../utils/portfolioUtils";
import SendTokenModal from "./SendTokenModal";

export default function EthereumAssetsSection() {
  const { isConnected, address } = useAccount();
  const { portfolio, isLoading, error } = usePortfolio(address);
  const [hideSmallBalances, setHideSmallBalances] = useState(true);
  const minBalanceThreshold = 5;
  const [logoUpdateTrigger, setLogoUpdateTrigger] = useState(0);
  const [showTokenBalances, setShowTokenBalances] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenDetail | null>(null);
  const [selectedTokenLogo, setSelectedTokenLogo] = useState<string>("");
  const {
    isOpen: isSendModalOpen,
    onOpen: onSendModalOpen,
    onClose: onSendModalClose,
  } = useDisclosure();

  const resolverOrder = [
    IdentityResolver.Farcaster,
    IdentityResolver.Nns,
    IdentityResolver.Ens,
    IdentityResolver.Base,
    IdentityResolver.Lens,
    IdentityResolver.Uni,
    IdentityResolver.World,
  ];

  // Group tokens by network
  const groupedTokens = groupTokensByNetwork(portfolio?.tokens);

  // Memoize filtered tokens to prevent unnecessary re-computation
  const memoizedGroupedTokens = useMemo(
    () => groupTokensByNetwork(portfolio?.tokens),
    [portfolio?.tokens]
  );

  // Memoize filter function to prevent recreating it on every render
  const filterTokens = useCallback(
    (tokens: TokenDetail[]) => {
      return filterTokensByBalance(
        tokens,
        hideSmallBalances,
        minBalanceThreshold,
        undefined
      );
    },
    [hideSmallBalances, minBalanceThreshold]
  );

  // Memoize higher token to prevent unnecessary re-computation
  const higherToken = useMemo(() => {
    if (!portfolio?.tokens || portfolio.tokens.length === 0) return null;
    return portfolio.tokens.find(
      (tokenDetail) => tokenDetail.token.symbol.toLowerCase() === "higher"
    );
  }, [portfolio?.tokens]);

  // Effect to preload token logos and subscribe to updates - only run once per portfolio change
  useEffect(() => {
    if (portfolio?.tokens && portfolio.tokens.length > 0) {
      // Only preload if not already done for this portfolio
      const portfolioHash = portfolio.tokens
        .map((t) => `${t.network}-${t.token.address}`)
        .join(",");
      const lastHash = sessionStorage.getItem("lastPortfolioHash");

      if (portfolioHash !== lastHash) {
        preloadTokenLogos(portfolio.tokens);
        sessionStorage.setItem("lastPortfolioHash", portfolioHash);
      }

      // Subscribe to logo updates
      const unsubscribe = subscribeToLogoUpdates(() => {
        setLogoUpdateTrigger((prev) => prev + 1);
      });

      return () => {
        unsubscribe();
      };
    }
  }, [portfolio?.tokens]);

  const handleForceRefresh = useCallback(async () => {
    if (!portfolio?.tokens) return;

    setIsRefreshing(true);
    try {
      await forceRefreshTokenData(portfolio.tokens);
      // Clear the portfolio hash to allow fresh preloading
      sessionStorage.removeItem("lastPortfolioHash");
    } catch (error) {
      console.error("Failed to refresh token data:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [portfolio?.tokens]);

  const handleSendToken = (tokenDetail: TokenDetail, logoUrl?: string) => {
    setSelectedToken(tokenDetail);
    setSelectedTokenLogo(logoUrl || "");
    onSendModalOpen();
  };

  return (
    <Box
      mt={8}
      p={6}
      borderRadius="base"
      bg="muted"
      w={"100wh"}
      mx="4"
      textAlign="left"
    >
      <HStack justify="space-between" align="center" mb={4}>
        <Text fontFamily="Joystix" fontSize="2xl" color="primary">
          ETH Assets
        </Text>
        {portfolio && (
          <Badge fontSize="3xl" fontWeight="bold" colorScheme="green">
            {formatValue(portfolio.totalNetWorth)}
          </Badge>
        )}
      </HStack>

      <Box mb={4}>
        <Text fontSize="sm" color="primary" mb={2}>
          Connected Account:
        </Text>

        {isConnected && address ? (
          <HStack spacing={3} align="center">
            <Avatar address={address} size={32} resolverOrder={resolverOrder} />
            <Box flex={1}>
              <Box fontSize="md" color="primary" fontWeight="medium">
                <Name address={address} resolverOrder={resolverOrder} />
              </Box>
              <Text fontSize="xs" color="primary" fontFamily="mono" mt={1}>
                {address}
              </Text>
            </Box>
          </HStack>
        ) : (
          <Text fontSize="md" color="muted" fontFamily="mono">
            Not connected
          </Text>
        )}
      </Box>

      {isConnected && address && (
        <Box>
          {/* HIGHER Token Display - Always visible */}
          {higherToken && (
            <Box
              p={4}
              bg="background"
              borderRadius="md"
              mb={6}
              border="2px solid"
              borderColor="primary"
            >
              <Text fontSize="sm" color="primary" mb={2}>
                HIGHER Token Balance:
              </Text>
              <HStack justify="space-between" align="center">
                <HStack spacing={4}>
                  <Image
                    src="/logos/higher.png"
                    alt={higherToken.token.symbol}
                    w="32px"
                    h="32px"
                    borderRadius="full"
                    fallback={
                      <Text fontSize="lg" fontWeight="bold" color="primary">
                        {higherToken.token.symbol.charAt(0)}
                      </Text>
                    }
                  />
                  <Box>
                    <Text fontSize="xl" fontWeight="bold" color="primary">
                      {higherToken.token.symbol}
                    </Text>
                    <Text fontSize="md" color="primary">
                      {formatBalance(higherToken.token.balance)}
                    </Text>
                    <Text
                      fontSize="xs"
                      color="primary"
                      textTransform="uppercase"
                    >
                      {blockchainDictionary[higherToken.network]?.alias ||
                        higherToken.network}
                    </Text>
                  </Box>
                </HStack>
                <VStack spacing={2} align="end">
                  <Text fontSize="2xl" fontWeight="bold" color="primary">
                    {formatValue(higherToken.token.balanceUSD)}
                  </Text>
                  <Text fontSize="sm" color="primary">
                    {formatPrice(higherToken.token.price)}
                  </Text>
                  <Button
                    size="sm"
                    colorScheme="blue"
                    leftIcon={<FaPaperPlane />}
                    onClick={() =>
                      handleSendToken(higherToken, "/logos/higher.png")
                    }
                  >
                    Send
                  </Button>
                </VStack>
              </HStack>
            </Box>
          )}

          {/* Show More Button */}
          <Box textAlign="center" mb={4}>
            <Button
              onClick={() => setShowTokenBalances(!showTokenBalances)}
              variant="outline"
              colorScheme="blue"
              size="sm"
            >
              {showTokenBalances
                ? "Hide Token Balances"
                : "Show Token Balances"}
            </Button>
          </Box>

          {/* Token Balances Section - only display if showTokenBalances is true */}
          {showTokenBalances && (
            <>
              <HStack justify="space-between" align="center" mb={4}>
                <Text fontSize="lg" fontWeight="bold" color="primary">
                  Token Balances
                </Text>
                <VStack spacing={2} align="end">
                  <HStack spacing={2}>
                    <Button
                      onClick={handleForceRefresh}
                      isLoading={isRefreshing}
                      loadingText="Refreshing..."
                      size="xs"
                      colorScheme="green"
                      variant="outline"
                    >
                      🔄 Refresh Data
                    </Button>
                    <FormControl display="flex" alignItems="center" w="auto">
                      <FormLabel htmlFor="hide-small" mb="0" fontSize="sm">
                        Hide small balances
                      </FormLabel>
                      <Switch
                        id="hide-small"
                        isChecked={hideSmallBalances}
                        onChange={(e) => setHideSmallBalances(e.target.checked)}
                        colorScheme="blue"
                      />
                    </FormControl>
                  </HStack>
                </VStack>
              </HStack>

              {isLoading && (
                <Flex justify="center" align="center" py={4}>
                  <Spinner color="primary" />
                </Flex>
              )}

              {error && (
                <Alert status="error" mb={4}>
                  <AlertIcon />
                  {error}
                </Alert>
              )}

              {portfolio && (
                <VStack spacing={3} align="stretch">
                  {Object.keys(memoizedGroupedTokens).length > 0 ? (
                    <Accordion allowMultiple defaultIndex={[0]}>
                      {Object.entries(memoizedGroupedTokens).map(
                        ([network, tokens]) => {
                          const filteredTokens = filterTokens(tokens);
                          const networkTotal = getNetworkTotal(filteredTokens);
                          const networkInfo = blockchainDictionary[network];

                          if (filteredTokens.length === 0) return null;

                          return (
                            <AccordionItem
                              key={network}
                              border="1px solid"
                              borderColor="gray.200"
                              borderRadius="md"
                              mb={2}
                            >
                              <AccordionButton
                                p={4}
                                bg={"background"}
                                color="white"
                                _hover={{ opacity: 0.8 }}
                                borderRadius="md"
                              >
                                <HStack
                                  flex="1"
                                  justify="space-between"
                                  align="center"
                                >
                                  <HStack spacing={3}>
                                    {networkInfo?.logo ? (
                                      <Image
                                        src={networkInfo.logo}
                                        alt={network}
                                        w="24px"
                                        h="24px"
                                        borderRadius="full"
                                        fallback={
                                          <Text
                                            fontSize="sm"
                                            fontWeight="bold"
                                            color={
                                              networkInfo?.color || "gray.600"
                                            }
                                          >
                                            {network.charAt(0).toUpperCase()}
                                          </Text>
                                        }
                                      />
                                    ) : (
                                      <Text
                                        fontSize="sm"
                                        fontWeight="bold"
                                        color={networkInfo?.color || "gray.600"}
                                      >
                                        {network.charAt(0).toUpperCase()}
                                      </Text>
                                    )}
                                    <Text
                                      fontSize="lg"
                                      fontWeight="bold"
                                      textTransform="uppercase"
                                    >
                                      {networkInfo?.alias || network}
                                    </Text>
                                  </HStack>
                                  <Text
                                    fontSize="xl"
                                    fontWeight="bold"
                                    color={"primary"}
                                  >
                                    {formatValue(networkTotal)}
                                  </Text>
                                </HStack>
                                <AccordionIcon ml={2} />
                              </AccordionButton>

                              <AccordionPanel p={0}>
                                <VStack spacing={0} align="stretch">
                                  {sortTokensByBalance(filteredTokens).map(
                                    (
                                      tokenDetail: TokenDetail,
                                      index: number
                                    ) => {
                                      // Get enhanced data from GeckoTerminal cache
                                      const { marketCap, priceChange } =
                                        getEnhancedTokenData(tokenDetail);

                                      return (
                                        <Box
                                          key={`${tokenDetail.token.address}-${index}`}
                                          p={4}
                                          bg={"background"}
                                          borderTop={
                                            index === 0 ? "none" : "1px solid"
                                          }
                                          border="tb1"
                                        >
                                          <HStack
                                            justify="space-between"
                                            align="center"
                                          >
                                            <HStack spacing={3}>
                                              {/* Token Logo */}

                                              {getTokenLogoSync(
                                                tokenDetail.token,
                                                networkInfo,
                                                network
                                              ) ? (
                                                <Image
                                                  src={
                                                    getTokenLogoSync(
                                                      tokenDetail.token,
                                                      networkInfo,
                                                      network
                                                    )!
                                                  }
                                                  alt={tokenDetail.token.symbol}
                                                  w="32px"
                                                  h="32px"
                                                  borderRadius="full"
                                                  fallback={
                                                    <Text
                                                      fontSize="xs"
                                                      fontWeight="bold"
                                                      color={
                                                        networkInfo?.color ||
                                                        "gray.600"
                                                      }
                                                    >
                                                      {tokenDetail.token.symbol.charAt(
                                                        0
                                                      )}
                                                    </Text>
                                                  }
                                                />
                                              ) : (
                                                <Text
                                                  fontSize="xs"
                                                  fontWeight="bold"
                                                  color={"primary"}
                                                >
                                                  {tokenDetail.token.symbol.charAt(
                                                    0
                                                  )}
                                                </Text>
                                              )}
                                              {/* Token Info */}
                                              <VStack spacing={0} align="start">
                                                <HStack
                                                  spacing={2}
                                                  align="center"
                                                >
                                                  <Text
                                                    fontWeight="medium"
                                                    color="primary"
                                                    fontSize="sm"
                                                  >
                                                    {tokenDetail.token.symbol}
                                                  </Text>
                                                  {/* Price Change Badge using GeckoTerminal data */}
                                                  {priceChange !== null && (
                                                    <Badge
                                                      colorScheme={
                                                        priceChange >= 0
                                                          ? "green"
                                                          : "red"
                                                      }
                                                      fontSize="xs"
                                                      variant="solid"
                                                    >
                                                      {priceChange >= 0
                                                        ? "+"
                                                        : ""}
                                                      {formatPriceChange(
                                                        priceChange
                                                      )}
                                                      %
                                                    </Badge>
                                                  )}
                                                </HStack>
                                                <Text
                                                  fontSize="xl"
                                                  color="primary"
                                                >
                                                  {formatBalance(
                                                    tokenDetail.token.balance
                                                  )}
                                                </Text>
                                                {/* Market cap using GeckoTerminal data */}
                                                <Text
                                                  fontSize="xs"
                                                  color="gray.400"
                                                >
                                                  MCap:{" "}
                                                  {formatMarketCap(marketCap)}
                                                </Text>
                                              </VStack>
                                            </HStack>

                                            <VStack spacing={1} align="end">
                                              <Text
                                                fontWeight="bold"
                                                color="white"
                                                fontSize="2xl"
                                              >
                                                {formatValue(
                                                  tokenDetail.token.balanceUSD
                                                )}
                                              </Text>
                                              <Text
                                                fontSize="xs"
                                                color="primary"
                                              >
                                                {formatPrice(
                                                  tokenDetail.token.price
                                                )}
                                              </Text>
                                              <IconButton
                                                aria-label="Send token"
                                                icon={<FaPaperPlane />}
                                                size="sm"
                                                colorScheme="blue"
                                                variant="outline"
                                                onClick={() =>
                                                  handleSendToken(
                                                    tokenDetail,
                                                    getTokenLogoSync(
                                                      tokenDetail.token,
                                                      networkInfo,
                                                      network
                                                    ) || undefined
                                                  )
                                                }
                                              />
                                            </VStack>
                                          </HStack>
                                        </Box>
                                      );
                                    }
                                  )}
                                </VStack>
                              </AccordionPanel>
                            </AccordionItem>
                          );
                        }
                      )}
                    </Accordion>
                  ) : (
                    <Text color="muted" textAlign="center" py={4}>
                      No tokens found in portfolio
                    </Text>
                  )}
                </VStack>
              )}
            </>
          )}
        </Box>
      )}

      {/* Send Token Modal */}
      {selectedToken && (
        <SendTokenModal
          isOpen={isSendModalOpen}
          onClose={onSendModalClose}
          token={selectedToken}
          tokenLogo={selectedTokenLogo}
        />
      )}
    </Box>
  );
}
