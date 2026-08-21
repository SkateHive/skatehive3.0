"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  FormControl,
  FormLabel,
  HStack,
  Image,
  Input,
  Select,
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
  onSettled: (amount: string, symbol: string) => void;
}

export default function BaseTipTab({ recipient, onSettled }: BaseTipTabProps) {
  const t = useTranslations("tip");
  const { isConnected } = useAccount();
  const tokens = useMemo(() => tokensForChain(base.id), []);
  const [symbol, setSymbol] = useState(tokens[0]?.symbol ?? "ETH");
  const [amount, setAmount] = useState("");

  const token = tokens.find((item) => item.symbol === symbol) ?? tokens[0];

  const { writeContract, data: contractHash, isPending: isContractPending } =
    useWriteContract();
  const { sendTransaction, data: ethHash, isPending: isEthPending } =
    useSendTransaction();

  const hash = contractHash || ethHash;
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Only announce once the receipt confirms — an optimistic success here would
  // publish a comment for money that never moved.
  useEffect(() => {
    if (isSuccess && hash) onSettled(amount, symbol);
  }, [isSuccess, hash, onSettled, amount, symbol]);

  const amountNumber = parseFloat(amount);
  const isValid = !!token && Number.isFinite(amountNumber) && amountNumber > 0;
  const isBusy = isContractPending || isEthPending || isConfirming;

  const handleSend = useCallback(() => {
    if (!isValid || !token) return;
    const value = parseUnits(amount, token.decimals);

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
  }, [isValid, token, amount, recipient, sendTransaction, writeContract]);

  if (!isConnected) {
    return (
      <Text color="dim" fontSize="sm" py={4}>
        {t("connectWallet")}
      </Text>
    );
  }

  return (
    <VStack spacing={3} align="stretch" pt={2}>
      <FormControl>
        <FormLabel fontSize="sm" color="dim">
          {t("token")}
        </FormLabel>
        <HStack>
          {token?.logo && (
            <Image src={token.logo} alt={token.symbol} boxSize="20px" />
          )}
          <Select
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
            bg="inputBg"
            borderColor="inputBorder"
            color="inputText"
          >
            {tokens.map((item) => (
              <option key={item.symbol} value={item.symbol}>
                {item.symbol}
              </option>
            ))}
          </Select>
        </HStack>
      </FormControl>

      <FormControl>
        <FormLabel fontSize="sm" color="dim">
          {t("amount")}
        </FormLabel>
        <Input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0.00"
          inputMode="decimal"
          bg="inputBg"
          borderColor="inputBorder"
          color="inputText"
          _placeholder={{ color: "inputPlaceholder" }}
        />
      </FormControl>

      <Button
        onClick={handleSend}
        isDisabled={!isValid || isBusy}
        isLoading={isBusy}
        loadingText={t("sending")}
        variant="solid"
      >
        {t("send")}
      </Button>
    </VStack>
  );
}
