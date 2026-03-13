"use client";

import {
  useWriteAuctionCreateBid,
  useWriteAuctionSettleCurrentAndCreateNewAuction,
} from "@/hooks/wagmiGenerated";
import { useCallback, useState } from "react";
import { parseEther, formatEther } from "viem";
import { useAccount, useSwitchChain, useChainId } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { useForm } from "react-hook-form";
import { getConfig } from "@/lib/utils/wagmi";
import { DAO_ADDRESSES } from "@/lib/utils/constants";
import {
  calculateMinBid,
  handleAuctionError,
  validateBid,
} from "@/lib/utils/auction";
import { useTranslations } from '@/lib/i18n/hooks';
import {
  Box,
  Button,
  Input,
  Text,
  VStack,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Link,
  Alert,
  AlertIcon,
  AlertDescription,
  HStack,
  Divider,
  Center,
} from "@chakra-ui/react";
import { base } from "viem/chains";
import { Name, Avatar } from "@coinbase/onchainkit/identity";

interface Bid {
  bidder: string;
  amount: string;
}

interface BidProps {
  tokenId: bigint;
  winningBid: bigint;
  isAuctionRunning: boolean;
  reservePrice: string;
  minimumBidIncrement: string;
  onBid?: () => void;
  onSettle?: () => void;
  alignContent?: "left" | "right";
  onBidButtonHover?: (isHovering: boolean) => void;
  onBidSectionHover?: (isHovering: boolean) => void;
  bids: Bid[];
  isLatestAuction?: boolean;
}

export function AuctionBid({
  tokenId,
  winningBid,
  isAuctionRunning,
  reservePrice,
  minimumBidIncrement,
  onBid,
  onSettle,
  alignContent = "left",
  onBidButtonHover,
  onBidSectionHover,
  bids,
  isLatestAuction = false,
}: BidProps) {
  const t = useTranslations('auction');
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const account = useAccount();
  const chainId = useChainId();
  const [hasShownToast, setHasShownToast] = useState(false);
  const toast = require("@chakra-ui/react").useToast();
  const { switchChain } = useSwitchChain();

  const isOnBaseNetwork = chainId === base.id;

  const handleSwitchToBase = useCallback(async () => {
    if (!switchChain) return;

    try {
      await switchChain({ chainId: base.id });
    } catch (error: any) {
      toast({
        title: t('networkSwitchFailed'),
        description: error.message || t('failedToSwitchNetwork'),
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  }, [switchChain, toast, t]);

  // Calculate minimum bid: currentBid + (currentBid * increment%)
  const minBidValue = calculateMinBid(
    winningBid,
    BigInt(reservePrice),
    minimumBidIncrement
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm({
    defaultValues: { bidAmount: formatEther(minBidValue) },
  });

  const { writeContractAsync: writeBid } = useWriteAuctionCreateBid();
  const { writeContractAsync: writeSettle } =
    useWriteAuctionSettleCurrentAndCreateNewAuction();

  const onSubmitBid = useCallback(
    async (data: { bidAmount: string }) => {
      setIsLoading(true);
      setErrorMessage(null);
      setTxHash(null);

      try {
        switchChain({ chainId: base.id });

        const txHash = await writeBid({
          address: DAO_ADDRESSES.auction,
          args: [tokenId],
          value: parseEther(data.bidAmount),
        });

        await waitForTransactionReceipt(getConfig(), { hash: txHash });
        setTxHash(txHash);

        // Show toast for successful transaction
        toast({
          title: t('bidPlaced'),
          description: (
            <>
              {t('bidPlacedSuccess')}{" "}
              <Link
                href={`https://basescan.org/tx/${txHash}`}
                isExternal
                color="primary"
                textDecoration="underline"
                _hover={{ color: "accent" }}
              >
                {t('viewOnBasescan')}
              </Link>
            </>
          ),
          status: "success",
          duration: 9000,
          isClosable: true,
          position: "top",
        });
        setHasShownToast(true);

        // Update for next bid
        const currentBid = parseEther(data.bidAmount);
        const nextMinBid = calculateMinBid(
          currentBid,
          BigInt(reservePrice),
          minimumBidIncrement
        );
        setValue("bidAmount", formatEther(nextMinBid));

        // Wait for subgraph to update
        await new Promise((resolve) => setTimeout(resolve, 5000));
        onBid?.();
      } catch (error: any) {
        console.error("Bid failed:", error);
        setErrorMessage(handleAuctionError(error));
      } finally {
        setIsLoading(false);
      }
    },
    [
      tokenId,
      writeBid,
      onBid,
      minimumBidIncrement,
      setValue,
      reservePrice,
      switchChain,
      toast,
      t,
    ]
  );

  const handleSettle = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setTxHash(null);

    try {
      const txHash = await writeSettle({
        address: DAO_ADDRESSES.auction,
      });
      await waitForTransactionReceipt(getConfig(), { hash: txHash });
      setTxHash(txHash);

      // Wait for subgraph to update
      await new Promise((resolve) => setTimeout(resolve, 5000));
      onSettle?.();
    } catch (error: any) {
      console.error("Settlement failed:", error);
      setErrorMessage(handleAuctionError(error));
    } finally {
      setIsLoading(false);
    }
  }, [writeSettle, onSettle]);

  return (
    <VStack spacing={{ base: 3, md: 4 }} align="stretch" w="full">
      {/* Error Alert */}
      {errorMessage && (
        <Alert
          status="error"
          bg="error"
          opacity={0.1}
          border="1px solid"
          borderColor="error"
          borderRadius="none"
          py={3}
        >
          <AlertIcon color="error" />
          <AlertDescription color="error" fontSize="sm">
            {errorMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Success Transaction Hash Toast handled in logic above */}

      {isAuctionRunning ? (
        <Box as="form" onSubmit={handleSubmit(onSubmitBid)} w="full">
          <VStack
            spacing={{ base: 3, md: 4 }}
            align={alignContent === "right" ? "end" : "stretch"}
          >
            <FormControl isInvalid={!!errors.bidAmount}>
              <FormLabel
                color="text"
                fontSize={{ base: "sm", md: "md" }}
                fontWeight="medium"
                mb={2}
                textAlign={alignContent === "right" ? "right" : "left"}
              >
                {t('yourBid')}
              </FormLabel>
              <Input
                {...register("bidAmount", {
                  required: t('bidAmountRequired'),
                  validate: (value) => {
                    const result = validateBid(
                      value,
                      winningBid,
                      BigInt(reservePrice),
                      minimumBidIncrement
                    );
                    return result.isValid || result.error || t('invalidBid');
                  },
                })}
                placeholder={`${t('minimum')} ${formatEther(minBidValue)} Ξ`}
                bg="background"
                border="1px solid"
                borderColor="border"
                color="text"
                size="lg"
                _hover={{ borderColor: "primary" }}
                _focus={{ borderColor: "primary", boxShadow: "outline" }}
                isDisabled={
                  !account.isConnected || isLoading || !isOnBaseNetwork
                }
                textAlign={alignContent === "right" ? "right" : "left"}
              />
              <FormErrorMessage color="error" fontSize="xs">
                {errors.bidAmount?.message}
              </FormErrorMessage>
              <Text
                fontSize="xs"
                color="accent"
                mt={1}
                textAlign={alignContent === "right" ? "right" : "left"}
              >
                {t('minimumBid')} {formatEther(minBidValue)} Ξ
              </Text>
            </FormControl>

            <Button
              type={isOnBaseNetwork ? "submit" : "button"}
              onClick={isOnBaseNetwork ? undefined : handleSwitchToBase}
              variant="solid"
              size="lg"
              width="full"
              bg={isOnBaseNetwork ? "primary" : "orange.500"}
              color="background"
              _hover={{
                bg: isOnBaseNetwork ? "accent" : "orange.600",
                color: "background",
              }}
              _disabled={{ bg: "muted", color: "text", cursor: "not-allowed" }}
              isDisabled={!account.isConnected || isLoading}
              isLoading={isLoading}
              loadingText={isOnBaseNetwork ? t('placingBid') : t('switching')}
              h={{ base: "44px", md: "48px" }}
              onMouseEnter={() => {
                onBidButtonHover?.(true);
                onBidSectionHover?.(true);
              }}
              onMouseLeave={() => {
                onBidButtonHover?.(false);
                onBidSectionHover?.(false);
              }}
            >
              {isLoading
                ? isOnBaseNetwork
                  ? t('placingBid')
                  : t('switching')
                : isOnBaseNetwork
                ? t('placeBid')
                : t('switchToBase')}
            </Button>
          </VStack>
        </Box>
      ) : (
        <>
          {isLatestAuction && (
            <VStack spacing={2} align="stretch">
              <Button
                onClick={isOnBaseNetwork ? handleSettle : handleSwitchToBase}
                variant="solid"
                size="lg"
                width="full"
                bg={isOnBaseNetwork ? "success" : "orange.500"}
                color="background"
                _hover={{
                  bg: isOnBaseNetwork ? "primary" : "orange.600",
                  color: "background",
                }}
                _disabled={{
                  bg: "muted",
                  color: "text",
                  cursor: "not-allowed",
                }}
                isDisabled={!account.isConnected || isLoading}
                isLoading={isLoading}
                loadingText={isOnBaseNetwork ? t('settling') : t('switching')}
                h={{ base: "44px", md: "48px" }}
              >
                {isLoading
                  ? isOnBaseNetwork
                    ? t('settling')
                    : t('switching')
                  : isOnBaseNetwork
                  ? t('startNextAuction')
                  : t('switchToBase')}
              </Button>
            </VStack>
          )}
        </>
      )}

      {/* Bid History */}
      <Box
        w="100%"
        bg="background"
        border="1px solid"
        borderColor="border"
        borderRadius="none"
        overflowY="auto"
        maxH={{ base: "200px", md: "300px" }}
        sx={{
          "&::-webkit-scrollbar": { width: "4px" },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": {
            background: "var(--chakra-colors-primary)",
            borderRadius: "2px",
          },
          scrollbarWidth: "thin",
          scrollbarColor: "var(--chakra-colors-primary) transparent",
        }}
      >
        <VStack spacing={0} align="stretch">
          <HStack
            justify="center"
            spacing={2}
            py={{ base: 2, md: 3 }}
            px={{ base: 2, md: 3 }}
            borderBottom="1px solid"
            borderColor="border"
            bg="muted"
          >
            <Text
              fontSize={{ base: "xs", md: "sm" }}
              color="primary"
              fontWeight="bold"
              textTransform="uppercase"
              letterSpacing="wide"
            >
              {t('bidHistory')}
            </Text>
          </HStack>

          {bids.length === 0 ? (
            <Box
              display="flex"
              alignItems="center"
              justifyContent="center"
              minH={{ base: "60px", md: "80px" }}
              py={{ base: 3, md: 4 }}
            >
              <Text fontSize="sm" color="text" opacity={0.5}>
                {t('noBidsYet')}
              </Text>
            </Box>
          ) : (
            [...bids]
              .sort((a, b) => {
                const amountA = BigInt(a.amount);
                const amountB = BigInt(b.amount);
                return amountB > amountA ? 1 : amountB < amountA ? -1 : 0;
              })
              .map((bid, index) => (
                <Box
                  key={index}
                  bg="muted"
                  px={{ base: 2, md: 3 }}
                  py={{ base: 2, md: 3 }}
                  mx={{ base: 1, md: 2 }}
                  mb={1}
                  borderRadius="none"
                  transition="all 0.2s ease"
                  _hover={{
                    bg: "background",
                    transform: "translateY(-1px)",
                    boxShadow: "sm",
                  }}
                >
                  <HStack justify="space-between" w="full" spacing={{ base: 2, md: 3 }}>
                    <HStack spacing={{ base: 1, md: 2 }}>
                      <Avatar
                        address={bid.bidder as `0x${string}`}
                        className="w-6 h-6 rounded-full"
                      />
                      <VStack spacing={0} align="start">
                        <Name
                          address={bid.bidder as `0x${string}`}
                          className="font-medium text-sm"
                          style={{ color: "var(--chakra-colors-primary)" }}
                        />
                        <Text fontSize="xs" color="text" opacity={0.6}>
                          #{index + 1}
                        </Text>
                      </VStack>
                    </HStack>
                    <VStack spacing={0} align="end">
                      <Text fontSize={{ base: "sm", md: "md" }} fontWeight="bold" color="text">
                        {formatEther(BigInt(bid.amount))} Ξ
                      </Text>
                      {index === 0 && (
                        <Text fontSize="xs" color="primary" fontWeight="medium">
                          {t('highest')}
                        </Text>
                      )}
                    </VStack>
                  </HStack>
                </Box>
              ))
          )}
        </VStack>
      </Box>
    </VStack>
  );
}
