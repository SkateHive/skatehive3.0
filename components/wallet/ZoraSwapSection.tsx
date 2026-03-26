"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box, Text, Button, Input, HStack, VStack,
  Image, Spinner, Tooltip, Select,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { FaExchangeAlt, FaInfoCircle, FaSearch } from "react-icons/fa";
import { parseEther, formatEther, formatUnits, isAddress, parseUnits } from "viem";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { base } from "wagmi/chains";
import { getCoin } from "@zoralabs/coins-sdk";
import { useZoraTrade } from "@/hooks/useZoraTrade";
import { useZoraWalletData, ZoraHeldCoin } from "@/hooks/useZoraWalletData";

const shimmer = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
`;

// ─── Types ──────────────────────────────────────────────────────────────────

interface ZoraCoinOption {
  address: string;
  symbol: string;
  name: string;
  logo: string | null;
  balance?: string;     // human-readable, from wallet
  decimals: number;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ZoraSwapSection() {
  const { address: connectedAddress } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const {
    executeTrade,
    getTradeQuote,
    getFormattedBalance,
    isTrading,
    isConnected,
    ethBalance,
  } = useZoraTrade();

  // Fetch user's held Zora coins
  const evmAddresses = useMemo(
    () => (connectedAddress ? [connectedAddress] : []),
    [connectedAddress],
  );
  const { heldCoins } = useZoraWalletData(evmAddresses);

  const isWrongChain = isConnected && chainId !== base.id;

  // ── Build coin options from user's held coins ─────────────────────────────
  const coinOptions: ZoraCoinOption[] = useMemo(() => {
    return heldCoins.map((c) => ({
      address: c.address,
      symbol: c.symbol,
      name: c.name,
      logo: c.logo,
      balance: c.balance,
      decimals: 18,
    }));
  }, [heldCoins]);

  // ── Selected coin state ───────────────────────────────────────────────────
  const [selectedCoin, setSelectedCoin] = useState<ZoraCoinOption | null>(null);
  const [searchMode, setSearchMode] = useState(false);
  const [searchAddress, setSearchAddress] = useState("");
  const [searchResult, setSearchResult] = useState<ZoraCoinOption | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Auto-select first coin when loaded
  useEffect(() => {
    if (!selectedCoin && coinOptions.length > 0) {
      setSelectedCoin(coinOptions[0]);
    }
  }, [coinOptions, selectedCoin]);

  // ── Search by address ─────────────────────────────────────────────────────
  useEffect(() => {
    const addr = searchAddress.trim();
    if (!isAddress(addr)) {
      setSearchResult(null);
      return;
    }

    // Check if already in held coins
    const existing = coinOptions.find((c) => c.address.toLowerCase() === addr.toLowerCase());
    if (existing) {
      setSearchResult(null);
      setSelectedCoin(existing);
      setSearchMode(false);
      setSearchAddress("");
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    getCoin({ address: addr, chain: 8453 })
      .then((res) => {
        if (cancelled) return;
        const coin = (res as any)?.data?.zora20Token;
        if (coin) {
          const image =
            coin.mediaContent?.previewImage?.medium ??
            coin.mediaContent?.previewImage?.small ??
            coin.mediaContent?.originalUri ??
            null;
          setSearchResult({
            address: coin.address ?? addr,
            symbol: coin.symbol ?? "???",
            name: coin.name ?? "",
            logo: image,
            decimals: 18,
          });
        } else {
          setSearchResult(null);
        }
      })
      .catch(() => { if (!cancelled) setSearchResult(null); })
      .finally(() => { if (!cancelled) setIsSearching(false); });

    return () => { cancelled = true; };
  }, [searchAddress, coinOptions]);

  // ── Trade state ───────────────────────────────────────────────────────────
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [sellAmount, setSellAmount] = useState("");
  const [estimatedOut, setEstimatedOut] = useState("");
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [slippage] = useState(5);

  // ── Quote ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const coin = selectedCoin;
    if (!coin || !sellAmount || isNaN(Number(sellAmount)) || Number(sellAmount) <= 0 || !isConnected) {
      setEstimatedOut("");
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(async () => {
      setIsFetchingQuote(true);
      try {
        const amountIn = tradeType === "buy"
          ? parseEther(sellAmount)
          : parseUnits(sellAmount, 18);

        const quote = await getTradeQuote({
          fromToken: tradeType === "buy"
            ? { type: "eth", amount: amountIn }
            : { type: "erc20", address: coin.address as `0x${string}`, amount: amountIn },
          toToken: tradeType === "buy"
            ? { type: "erc20", address: coin.address as `0x${string}` }
            : { type: "eth" },
          slippage,
        });

        if (!cancelled && quote?.quote?.amountOut) {
          const out = tradeType === "buy"
            ? formatUnits(BigInt(quote.quote.amountOut), 18)
            : formatEther(BigInt(quote.quote.amountOut));
          const num = parseFloat(out);
          setEstimatedOut(num < 0.0001 ? num.toExponential(3) : num.toFixed(6));
        } else if (!cancelled) {
          setEstimatedOut("—");
        }
      } catch {
        if (!cancelled) setEstimatedOut("—");
      } finally {
        if (!cancelled) setIsFetchingQuote(false);
      }
    }, 600);

    return () => { cancelled = true; clearTimeout(timeout); };
  }, [sellAmount, selectedCoin, tradeType, isConnected, getTradeQuote, slippage]);

  // ── Execute trade ─────────────────────────────────────────────────────────
  const handleSwap = useCallback(async () => {
    if (!selectedCoin || !sellAmount || parseFloat(sellAmount) <= 0) return;

    if (isWrongChain) {
      try { await switchChain({ chainId: base.id }); } catch {}
      return;
    }

    const amountIn = tradeType === "buy"
      ? parseEther(sellAmount)
      : parseUnits(sellAmount, 18);

    await executeTrade({
      fromToken: tradeType === "buy"
        ? { type: "eth", amount: amountIn }
        : { type: "erc20", address: selectedCoin.address as `0x${string}`, amount: amountIn },
      toToken: tradeType === "buy"
        ? { type: "erc20", address: selectedCoin.address as `0x${string}` }
        : { type: "eth" },
      slippage,
    });

    setSellAmount("");
    setEstimatedOut("");
  }, [selectedCoin, sellAmount, tradeType, isWrongChain, switchChain, executeTrade, slippage]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const ethBal = ethBalance ? parseFloat(formatEther(ethBalance.value)) : 0;
  const coinBal = selectedCoin?.balance ? parseFloat(selectedCoin.balance) : 0;
  const canSwap = isConnected && !!selectedCoin && !!sellAmount && parseFloat(sellAmount) > 0 && !isTrading && !isFetchingQuote;

  const handleFlip = () => {
    setTradeType((t) => (t === "buy" ? "sell" : "buy"));
    setSellAmount("");
    setEstimatedOut("");
  };

  // ── Token picker ──────────────────────────────────────────────────────────
  const sellSymbol = tradeType === "buy" ? "ETH" : (selectedCoin?.symbol ?? "COIN");
  const buySymbol = tradeType === "buy" ? (selectedCoin?.symbol ?? "COIN") : "ETH";
  const sellLogo = tradeType === "buy" ? "/logos/ethereum_logo.png" : selectedCoin?.logo;
  const buyLogo = tradeType === "buy" ? selectedCoin?.logo : "/logos/ethereum_logo.png";

  return (
    <Box
      position="relative"
      border="2px solid"
      borderColor="primary"
      overflow="hidden"
      width="100%"
      sx={{
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, transparent 0%, var(--chakra-colors-primary) 50%, transparent 100%)",
          backgroundSize: "200% auto",
          opacity: 0.06,
          animation: `${shimmer} 2.5s linear infinite`,
          pointerEvents: "none",
        },
      }}
    >
      {/* Header */}
      <HStack px={3} py={2} bg="primary" justify="space-between">
        <HStack spacing={2}>
          <Image src="/logos/Zorb.png" w="18px" h="18px" borderRadius="full" />
          <Text fontWeight="black" fontSize="sm" color="background"
            textTransform="uppercase" letterSpacing="widest" fontFamily="mono">
            Zora Swap
          </Text>
        </HStack>
        <Text fontSize="xs" color="background" fontFamily="mono" opacity={0.8}>
          via Zora SDK · Base
        </Text>
      </HStack>

      <Box px={3} py={3}>
        <VStack spacing={0} align="stretch">

          {/* ── Sell Box ────────────────────────────────────────── */}
          <Box border="1px solid" borderColor="border" p={3} mb={1}>
            <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase"
              letterSpacing="wider" mb={1}>
              You Pay
            </Text>
            <HStack>
              <HStack spacing={2} flex={1} minW={0}>
                {sellLogo && (
                  <Image src={sellLogo} w="22px" h="22px" objectFit="contain" borderRadius="full"
                    fallback={<Box w="22px" h="22px" borderRadius="full" bg="border" />} />
                )}
                <Input
                  type="number"
                  placeholder="0"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  fontSize="2xl"
                  fontFamily="mono"
                  fontWeight="black"
                  color="primary"
                  variant="unstyled"
                  flex={1}
                  minW={0}
                  _placeholder={{ color: "dim" }}
                />
              </HStack>

              {/* Token selector */}
              {tradeType === "buy" ? (
                <Text fontFamily="mono" fontWeight="bold" fontSize="sm" color="text">ETH</Text>
              ) : (
                <CoinPicker
                  coins={coinOptions}
                  selected={selectedCoin}
                  onSelect={(c) => { setSelectedCoin(c); setSellAmount(""); setEstimatedOut(""); }}
                  onSearchClick={() => setSearchMode(true)}
                />
              )}
            </HStack>

            {/* Balance display */}
            {isConnected && (
              <Text fontSize="xs" color="dim" fontFamily="mono" mt={1} textAlign="right">
                Balance: {tradeType === "buy"
                  ? `${ethBal.toFixed(4)} ETH`
                  : `${coinBal.toFixed(2)} ${selectedCoin?.symbol ?? ""}`}
              </Text>
            )}
          </Box>

          {/* Flip */}
          <Box textAlign="center" py={1}>
            <Button size="xs" variant="ghost" color="primary" onClick={handleFlip}
              _hover={{ bg: "primary", color: "background" }} transition="all 0.2s">
              <FaExchangeAlt style={{ transform: "rotate(90deg)" }} />
            </Button>
          </Box>

          {/* ── Buy Box ─────────────────────────────────────────── */}
          <Box border="1px solid" borderColor="border" p={3} mb={3}>
            <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase"
              letterSpacing="wider" mb={1}>
              You Receive
            </Text>
            <HStack>
              <HStack spacing={2} flex={1} minW={0}>
                {buyLogo && (
                  <Image src={buyLogo} w="22px" h="22px" objectFit="contain" borderRadius="full"
                    fallback={<Box w="22px" h="22px" borderRadius="full" bg="border" />} />
                )}
                <Text fontSize="2xl" fontFamily="mono" fontWeight="black" color="primary">
                  {isFetchingQuote ? <Spinner size="sm" /> : (estimatedOut || "—")}
                </Text>
              </HStack>

              {tradeType === "buy" ? (
                <CoinPicker
                  coins={coinOptions}
                  selected={selectedCoin}
                  onSelect={(c) => { setSelectedCoin(c); setSellAmount(""); setEstimatedOut(""); }}
                  onSearchClick={() => setSearchMode(true)}
                />
              ) : (
                <Text fontFamily="mono" fontWeight="bold" fontSize="sm" color="text">ETH</Text>
              )}
            </HStack>
          </Box>

          {/* ── Search overlay ─────────────────────────────────── */}
          {searchMode && (
            <Box border="1px solid" borderColor="primary" p={3} mb={3} bg="background">
              <HStack mb={2}>
                <Text fontSize="xs" color="primary" fontFamily="mono" fontWeight="bold"
                  textTransform="uppercase" letterSpacing="wider" flex={1}>
                  Search Zora Coin
                </Text>
                <Button size="xs" variant="ghost" color="dim" onClick={() => setSearchMode(false)}
                  fontFamily="mono">
                  X
                </Button>
              </HStack>
              <Input
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                placeholder="Paste coin address 0x..."
                fontFamily="mono"
                fontSize="sm"
                variant="unstyled"
                border="1px solid"
                borderColor="border"
                px={2}
                py={1}
                mb={2}
                _placeholder={{ color: "dim" }}
                autoFocus
              />
              {isSearching && (
                <HStack spacing={2} py={1}>
                  <Spinner size="xs" color="primary" />
                  <Text fontSize="xs" color="dim" fontFamily="mono">Searching...</Text>
                </HStack>
              )}
              {searchResult && !isSearching && (
                <Button
                  w="100%"
                  variant="outline"
                  borderColor="border"
                  borderRadius="none"
                  h="40px"
                  justifyContent="flex-start"
                  onClick={() => {
                    setSelectedCoin(searchResult);
                    setSearchMode(false);
                    setSearchAddress("");
                    setSearchResult(null);
                    setSellAmount("");
                    setEstimatedOut("");
                  }}
                  _hover={{ borderColor: "primary" }}
                >
                  <HStack spacing={2}>
                    {searchResult.logo && (
                      <Image src={searchResult.logo} w="20px" h="20px" borderRadius="full"
                        fallback={<Box w="20px" h="20px" borderRadius="full" bg="border" />} />
                    )}
                    <Text fontSize="sm" fontFamily="mono" fontWeight="bold" color="primary">
                      {searchResult.symbol}
                    </Text>
                    <Text fontSize="xs" fontFamily="mono" color="dim">
                      {searchResult.name}
                    </Text>
                  </HStack>
                </Button>
              )}
              {searchAddress && isAddress(searchAddress.trim()) && !searchResult && !isSearching && (
                <Text fontSize="xs" color="dim" fontFamily="mono">Not a Zora coin</Text>
              )}
            </Box>
          )}

          {/* ── CTA ────────────────────────────────────────────── */}
          {!isConnected ? (
            <Box border="1px solid" borderColor="border" p={3} textAlign="center">
              <Text fontSize="xs" color="dim" fontFamily="mono">Connect EVM wallet to swap</Text>
            </Box>
          ) : isWrongChain ? (
            <Button
              w="100%" borderRadius="none" fontWeight="black" letterSpacing="widest"
              fontFamily="mono" colorScheme="orange" size="md"
              sx={{ textTransform: "uppercase" }}
              onClick={() => switchChain({ chainId: base.id })}
            >
              Switch to Base
            </Button>
          ) : (
            <Button
              w="100%" borderRadius="none" fontWeight="black" letterSpacing="widest"
              fontFamily="mono" colorScheme="green" size="md"
              sx={{ textTransform: "uppercase" }}
              isDisabled={!canSwap}
              isLoading={isTrading || isFetchingQuote}
              loadingText={isTrading ? "SWAPPING..." : "QUOTING..."}
              leftIcon={<FaExchangeAlt />}
              onClick={handleSwap}
            >
              {!selectedCoin ? "Select Coin" : !sellAmount ? "Enter Amount" : "Swap"}
            </Button>
          )}

          <Text fontSize="xs" color="dim" fontFamily="mono" textAlign="center" mt={2}>
            5% slippage · Base chain only
            <Tooltip label="Trades Zora creator coins via bonding curve. Higher slippage accounts for low-liquidity coins.">
              <Box as="span" ml={1} cursor="help"><FaInfoCircle style={{ display: "inline" }} /></Box>
            </Tooltip>
          </Text>
        </VStack>
      </Box>
    </Box>
  );
}

// ─── Coin Picker Sub-component ──────────────────────────────────────────────

function CoinPicker({
  coins,
  selected,
  onSelect,
  onSearchClick,
}: {
  coins: ZoraCoinOption[];
  selected: ZoraCoinOption | null;
  onSelect: (c: ZoraCoinOption) => void;
  onSearchClick: () => void;
}) {
  if (coins.length === 0 && !selected) {
    return (
      <Button
        size="sm"
        variant="ghost"
        color="primary"
        fontFamily="mono"
        fontWeight="bold"
        onClick={onSearchClick}
        leftIcon={<FaSearch />}
        _hover={{ bg: "whiteAlpha.100" }}
      >
        Search
      </Button>
    );
  }

  return (
    <HStack spacing={1}>
      <Select
        value={selected?.address ?? ""}
        onChange={(e) => {
          if (e.target.value === "__search__") {
            onSearchClick();
            return;
          }
          const found = coins.find((c) => c.address === e.target.value);
          if (found) onSelect(found);
        }}
        size="sm"
        variant="unstyled"
        fontFamily="mono"
        fontWeight="bold"
        color="text"
        w="auto"
        cursor="pointer"
      >
        {coins.map((c) => (
          <option key={c.address} value={c.address}>
            {c.symbol}
          </option>
        ))}
        {selected && !coins.find((c) => c.address === selected.address) && (
          <option value={selected.address}>{selected.symbol}</option>
        )}
        <option value="__search__">Search...</option>
      </Select>
    </HStack>
  );
}
