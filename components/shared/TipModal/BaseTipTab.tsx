"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  useAccount,
  useSendTransaction,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { base } from "wagmi/chains";
import { parseUnits } from "viem";
import { useTranslations } from "@/contexts/LocaleContext";
import { isNativeToken, tokensForChain } from "@/lib/evm/swapTokens";
import RecipientStrip from "./RecipientStrip";
import TipErrorBar from "./TipErrorBar";
import TokenSelect from "./TokenSelect";
import { isValidAmount } from "./validateAmount";

const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

interface BaseTipTabProps {
  recipient: `0x${string}`;
  onSettled: (amount: string, symbol: string, txUrl: string | null) => void;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function BaseTipTab({ recipient, onSettled }: BaseTipTabProps) {
  const t = useTranslations("tip");
  const { isConnected } = useAccount();
  const tokens = useMemo(() => tokensForChain(base.id), []);
  const [symbol, setSymbol] = useState(tokens[0]?.symbol ?? "ETH");
  const [amount, setAmount] = useState("");

  const token = tokens.find((item) => item.symbol === symbol) ?? tokens[0];

  const {
    writeContract,
    data: contractHash,
    isPending: isContractPending,
    error: contractError,
    reset: resetContract,
  } = useWriteContract();
  const {
    sendTransaction,
    data: ethHash,
    isPending: isEthPending,
    error: ethError,
    reset: resetEth,
  } = useSendTransaction();

  const hash = contractHash || ethHash;
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Only announce once the receipt confirms — an optimistic success here would
  // publish a comment for money that never moved.
  useEffect(() => {
    if (isSuccess && hash) {
      onSettled(amount, symbol, `https://basescan.org/tx/${hash}`);
    }
  }, [isSuccess, hash, onSettled, amount, symbol]);

  const [localError, setLocalError] = useState<string | null>(null);
  const isValid = !!token && isValidAmount(amount);
  const isBusy = isContractPending || isEthPending || isConfirming;
  const rawError = contractError || ethError;
  const sendError =
    localError ||
    (rawError ? (rawError as { shortMessage?: string }).shortMessage || rawError.message : null);

  const handleSend = useCallback(() => {
    if (!isValid || !token) return;
    resetContract();
    resetEth();
    setLocalError(null);

    let value: bigint;
    try {
      value = parseUnits(amount, token.decimals);
    } catch {
      setLocalError(t("errorTitle"));
      return;
    }

    if (isNativeToken(token.address)) {
      sendTransaction({ to: recipient, value });
      return;
    }

    writeContract({
      address: token.address as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [recipient, value],
      chainId: base.id,
    });
  }, [isValid, token, amount, recipient, sendTransaction, writeContract, resetContract, resetEth, t]);

  if (!isConnected) {
    return (
      <Text color="dim" fontSize="sm" py={4}>
        {t("connectWallet")}
      </Text>
    );
  }

  return (
    <Box position="relative">
      <VStack spacing={0} align="stretch" pb={sendError ? "70px" : 0}>
        <RecipientStrip label={shortAddress(recipient)} note={t("noteBase")} />

        <FormControl mt={4}>
          <FormLabel fontSize="10px" letterSpacing="2px" color="dim" textTransform="uppercase">
            {t("token")}
          </FormLabel>
          <Flex
            align="center"
            bg="inputBg"
            border="1px solid"
            borderColor="inputBorder"
            px={3.5}
            py={2.5}
            opacity={isBusy ? 0.45 : 1}
          >
            <TokenSelect
              value={symbol}
              options={tokens.map((item) => ({ value: item.symbol, label: item.symbol, logo: item.logo }))}
              onChange={setSymbol}
              isDisabled={isBusy}
              suffix={t("onBase")}
            />
          </Flex>
        </FormControl>

        <FormControl mt={3.5}>
          <FormLabel fontSize="10px" letterSpacing="2px" color="dim" textTransform="uppercase">
            {t("amount")}
          </FormLabel>
          <Flex
            align="stretch"
            bg="inputBg"
            border="1px solid"
            borderColor="inputBorder"
            opacity={isBusy ? 0.45 : 1}
            _focusWithin={{ borderColor: "primary" }}
          >
            <Input
              variant="unstyled"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              fontSize="26px"
              color="inputText"
              _placeholder={{ color: "inputPlaceholder" }}
              px={4}
              py={3}
              isDisabled={isBusy}
            />
            <Flex align="center" borderLeft="1px solid" borderColor="inputBorder" px={4} fontSize="sm" color="dim">
              {token?.symbol}
            </Flex>
          </Flex>
        </FormControl>

        <Button
          onClick={handleSend}
          isDisabled={!isValid || isBusy}
          mt={5}
          h="44px"
          borderRadius={0}
          fontFamily="mono"
          fontWeight="bold"
          letterSpacing="3px"
          textTransform="uppercase"
          bg={isBusy ? "background" : "primary"}
          color={isBusy ? "primary" : "background"}
          border="1px solid"
          borderColor="primary"
          _hover={{ opacity: 0.85 }}
        >
          {isBusy ? t("sending") : t("send")}
        </Button>
      </VStack>

      {sendError && (
        <TipErrorBar
          message={sendError}
          onRetry={handleSend}
          onDismiss={() => {
            resetContract();
            resetEth();
            setLocalError(null);
          }}
        />
      )}
    </Box>
  );
}
