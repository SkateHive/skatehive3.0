"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box, Text, Button, Input, HStack, VStack, Image,
  Select, Spinner, Tooltip, useToast,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { FaExchangeAlt, FaInfoCircle } from "react-icons/fa";
import { useAccount, useChainId, useSendTransaction, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { parseUnits, formatUnits, maxUint256 } from "viem";

const shimmer = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
`;

// ─── Token Definitions ───────────────────────────────────────────────────────

const NATIVE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

interface TokenInfo {
  symbol: string;
  address: string;
  decimals: number;
  logo?: string;
}

const TOKENS_BY_CHAIN: Record<number, TokenInfo[]> = {
  // Base
  8453: [
    { symbol: "ETH",   address: NATIVE,                                        decimals: 18, logo: "/logos/ethereum_logo.png" },
    { symbol: "WETH",  address: "0x4200000000000000000000000000000000000006",  decimals: 18, logo: "/logos/ethereum_logo.png" },
    { symbol: "USDC",  address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",  decimals: 6,  logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/logo.png" },
    { symbol: "DAI",   address: "0x50c5725949a6f0c72e6c4a641f24049a917db0cb",  decimals: 18 },
    { symbol: "DEGEN", address: "0x4ed4e862860bed51a9570b96d89af5e1b0efefed",  decimals: 18, logo: "/logos/degen.png" },
    { symbol: "HIGHER",address: "0x0578d8a44db98b23bf096a382e016e29a5ce0ffe",  decimals: 18, logo: "/logos/higher.png" },
  ],
  // Ethereum
  1: [
    { symbol: "ETH",  address: NATIVE,                                         decimals: 18, logo: "/logos/ethereum_logo.png" },
    { symbol: "WETH", address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",   decimals: 18, logo: "/logos/ethereum_logo.png" },
    { symbol: "USDC", address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",   decimals: 6  },
    { symbol: "USDT", address: "0xdac17f958d2ee523a2206206994597c13d831ec7",   decimals: 6  },
    { symbol: "DAI",  address: "0x6b175474e89094c44da98b954eedeac495271d0f",   decimals: 18 },
  ],
  // Arbitrum
  42161: [
    { symbol: "ETH",  address: NATIVE,                                         decimals: 18, logo: "/logos/ethereum_logo.png" },
    { symbol: "WETH", address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",   decimals: 18, logo: "/logos/ethereum_logo.png" },
    { symbol: "USDC", address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",   decimals: 6  },
    { symbol: "ARB",  address: "0x912ce59144191c1204e64559fe8253a0e49e6548",   decimals: 18 },
  ],
};

const CHAIN_NAMES: Record<number, string> = { 8453: "Base", 1: "Ethereum", 42161: "Arbitrum" };

// ─── Sub-components ──────────────────────────────────────────────────────────

function TokenSelect({ value, onChange, tokens, label }: {
  value: TokenInfo;
  onChange: (t: TokenInfo) => void;
  tokens: TokenInfo[];
  label: string;
}) {
  return (
    <Select
      value={value.address}
      onChange={(e) => {
        const found = tokens.find((t) => t.address === e.target.value);
        if (found) onChange(found);
      }}
      size="sm"
      variant="unstyled"
      fontFamily="mono"
      fontWeight="bold"
      color="text"
      w="auto"
      cursor="pointer"
      aria-label={label}
    >
      {tokens.map((t) => (
        <option key={t.address} value={t.address}>
          {t.symbol}
        </option>
      ))}
    </Select>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ERC20SwapSection() {
  const toast = useToast();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const tokens = useMemo(() => TOKENS_BY_CHAIN[chainId] ?? TOKENS_BY_CHAIN[8453], [chainId]);

  const [sellToken, setSellToken]   = useState<TokenInfo>(tokens[0]);
  const [buyToken, setBuyToken]     = useState<TokenInfo>(tokens[2]); // USDC default
  const [sellAmount, setSellAmount] = useState("");
  const [price, setPrice]           = useState<any>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [approvalTarget, setApprovalTarget] = useState<`0x${string}` | null>(null);
  const [txHash, setTxHash]         = useState<`0x${string}` | undefined>();

  // Reset tokens when chain changes
  useEffect(() => {
    const list = TOKENS_BY_CHAIN[chainId] ?? TOKENS_BY_CHAIN[8453];
    setSellToken(list[0]);
    setBuyToken(list[2] ?? list[1]);
    setSellAmount("");
    setPrice(null);
  }, [chainId]);

  // Debounced price fetch
  useEffect(() => {
    if (!sellAmount || isNaN(Number(sellAmount)) || Number(sellAmount) <= 0 || !address) {
      setPrice(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsFetching(true);
      try {
        const rawAmount = parseUnits(sellAmount, sellToken.decimals).toString();
        const params = new URLSearchParams({
          chainId: String(chainId),
          sellToken: sellToken.address,
          buyToken: buyToken.address,
          sellAmount: rawAmount,
          taker: address,
        });
        const res = await fetch(`/api/0x/price?${params}`);
        const data = await res.json();
        setPrice(data);

        const spender = data?.issues?.allowance?.spender ?? data?.allowanceTarget;
        const needsAllow =
          sellToken.address !== NATIVE &&
          !!data?.issues?.allowance &&
          !!spender;
        setNeedsApproval(needsAllow);
        setApprovalTarget(needsAllow ? spender : null);
      } catch (e) {
        console.error("[0x price]", e);
      } finally {
        setIsFetching(false);
      }
    }, 600);

    return () => clearTimeout(timeout);
  }, [sellAmount, sellToken, buyToken, address, chainId]);

  // Approval
  const { writeContractAsync, isPending: isApproving } = useWriteContract();
  const handleApprove = useCallback(async () => {
    if (!approvalTarget) return;
    try {
      const hash = await writeContractAsync({
        address: sellToken.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [approvalTarget, maxUint256],
      });
      toast({ title: "Approval submitted", description: hash, status: "info", duration: 5000, isClosable: true });
      setNeedsApproval(false);
    } catch (e: any) {
      toast({ title: "Approval failed", description: e?.shortMessage ?? e?.message, status: "error", duration: 4000, isClosable: true });
    }
  }, [approvalTarget, sellToken, writeContractAsync, toast]);

  // Swap
  const { sendTransactionAsync, isPending: isSending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const handleSwap = useCallback(async () => {
    if (!address || !price?.liquidityAvailable) return;
    try {
      const rawAmount = parseUnits(sellAmount, sellToken.decimals).toString();
      const params = new URLSearchParams({
        chainId: String(chainId),
        sellToken: sellToken.address,
        buyToken: buyToken.address,
        sellAmount: rawAmount,
        taker: address,
      });
      const res = await fetch(`/api/0x/quote?${params}`);
      const quote = await res.json();

      if (!quote?.transaction) {
        toast({ title: "Quote failed", description: quote?.reason ?? "No transaction data", status: "error", duration: 4000, isClosable: true });
        return;
      }

      const hash = await sendTransactionAsync({
        to: quote.transaction.to,
        data: quote.transaction.data,
        value: quote.transaction.value ? BigInt(quote.transaction.value) : undefined,
        gas: quote.transaction.gas ? BigInt(quote.transaction.gas) : undefined,
      });

      setTxHash(hash);
      toast({ title: "Swap submitted!", description: hash, status: "success", duration: 6000, isClosable: true });
      setSellAmount("");
      setPrice(null);
    } catch (e: any) {
      toast({ title: "Swap failed", description: e?.shortMessage ?? e?.message, status: "error", duration: 4000, isClosable: true });
    }
  }, [address, price, sellAmount, sellToken, buyToken, chainId, sendTransactionAsync, toast]);

  // Derived display values
  const estimatedOut = useMemo(() => {
    if (!price?.buyAmount) return "—";
    const val = parseFloat(formatUnits(BigInt(price.buyAmount), buyToken.decimals));
    return val < 0.0001 ? val.toExponential(4) : val.toFixed(6);
  }, [price, buyToken.decimals]);

  const networkFeeEth = useMemo(() => {
    if (!price?.totalNetworkFee) return null;
    const eth = parseFloat(formatUnits(BigInt(price.totalNetworkFee), 18));
    return eth.toFixed(6);
  }, [price]);

  const isLoading = isFetching || isSending || isApproving || isConfirming;
  const canSwap = isConnected && !!price?.liquidityAvailable && !needsApproval && !isLoading && !!sellAmount;

  const handleFlip = () => {
    setSellToken(buyToken);
    setBuyToken(sellToken);
    setSellAmount("");
    setPrice(null);
  };

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
          <FaExchangeAlt color="var(--chakra-colors-background)" />
          <Text fontWeight="black" fontSize="sm" color="background"
            textTransform="uppercase" letterSpacing="widest" fontFamily="mono">
            ERC-20 Swap
          </Text>
        </HStack>
        <Text fontSize="xs" color="background" fontFamily="mono" opacity={0.8}>
          via 0x · {CHAIN_NAMES[chainId] ?? "Unknown"}
        </Text>
      </HStack>

      <Box px={3} py={3}>
        <VStack spacing={0} align="stretch">

          {/* Sell */}
          <Box border="1px solid" borderColor="border" p={3} mb={1}>
            <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase" letterSpacing="wider" mb={1}>
              You Pay
            </Text>
            <HStack>
              <HStack spacing={2} flex={1} minW={0}>
                {sellToken.logo && (
                  <Image src={sellToken.logo} w="22px" h="22px" objectFit="contain"
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
              <TokenSelect value={sellToken} onChange={setSellToken} tokens={tokens} label="Sell token" />
            </HStack>
          </Box>

          {/* Flip */}
          <Box textAlign="center" py={1}>
            <Button size="xs" variant="ghost" color="primary" onClick={handleFlip}
              _hover={{ bg: "primary", color: "background" }} transition="all 0.2s">
              <FaExchangeAlt style={{ transform: "rotate(90deg)" }} />
            </Button>
          </Box>

          {/* Buy */}
          <Box border="1px solid" borderColor="border" p={3} mb={3}>
            <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase" letterSpacing="wider" mb={1}>
              You Receive
            </Text>
            <HStack>
              <HStack spacing={2} flex={1} minW={0}>
                {buyToken.logo && (
                  <Image src={buyToken.logo} w="22px" h="22px" objectFit="contain"
                    fallback={<Box w="22px" h="22px" borderRadius="full" bg="border" />} />
                )}
                <Text fontSize="2xl" fontFamily="mono" fontWeight="black" color="primary">
                  {isFetching ? <Spinner size="sm" /> : estimatedOut}
                </Text>
              </HStack>
              <TokenSelect value={buyToken} onChange={setBuyToken} tokens={tokens} label="Buy token" />
            </HStack>
          </Box>

          {/* Price info */}
          {price && !isFetching && (
            <Box border="1px solid" borderColor="border" p={2} mb={3} fontSize="xs" fontFamily="mono">
              <HStack justify="space-between" color="dim">
                <Text>Network fee</Text>
                <Text color="text">{networkFeeEth} ETH</Text>
              </HStack>
              {price.issues?.balance && (
                <Text color="red.400" mt={1}>⚠ Insufficient {sellToken.symbol} balance</Text>
              )}
              {!price.liquidityAvailable && (
                <Text color="red.400" mt={1}>⚠ No liquidity available for this pair</Text>
              )}
              {isSuccess && (
                <Text color="green.400" mt={1}>✓ Last swap confirmed!</Text>
              )}
            </Box>
          )}

          {/* CTA */}
          {!isConnected ? (
            <Box border="1px solid" borderColor="border" p={3} textAlign="center">
              <Text fontSize="xs" color="dim" fontFamily="mono">Connect EVM wallet to swap</Text>
            </Box>
          ) : needsApproval ? (
            <Button
              w="100%" borderRadius="none" fontWeight="black" letterSpacing="widest"
              fontFamily="mono" colorScheme="orange" size="md"
              sx={{ textTransform: "uppercase" }}
              isLoading={isApproving} loadingText="APPROVING..."
              onClick={handleApprove}
            >
              Approve {sellToken.symbol}
            </Button>
          ) : (
            <Button
              w="100%" borderRadius="none" fontWeight="black" letterSpacing="widest"
              fontFamily="mono" colorScheme="green" size="md"
              sx={{ textTransform: "uppercase" }}
              isDisabled={!canSwap}
              isLoading={isSending || isConfirming}
              loadingText={isConfirming ? "CONFIRMING..." : "SWAPPING..."}
              leftIcon={<FaExchangeAlt />}
              onClick={handleSwap}
            >
              {!sellAmount ? "Enter Amount" : !price ? "..." : "Swap"}
            </Button>
          )}

          <Text fontSize="xs" color="dim" fontFamily="mono" textAlign="center" mt={2}>
            Best price from 150+ sources
            <Tooltip label="Powered by 0x Protocol — aggregates Uniswap, Curve, and 148+ other DEXes for best execution">
              <Box as="span" ml={1} cursor="help"><FaInfoCircle style={{ display: "inline" }} /></Box>
            </Tooltip>
          </Text>
        </VStack>
      </Box>
    </Box>
  );
}
