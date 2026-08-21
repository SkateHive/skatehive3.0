"use client";

import { useCallback, useState } from "react";
import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useTranslations } from "@/contexts/LocaleContext";
import { useHiveActions, useHBDActions } from "@/hooks/wallet";

type HiveAsset = "HIVE" | "HBD";

interface HiveTipTabProps {
  recipient: string;
  onSettled: (amount: string, symbol: string) => void;
}

export default function HiveTipTab({ recipient, onSettled }: HiveTipTabProps) {
  const t = useTranslations("tip");
  const toast = useToast();
  const { sendHive } = useHiveActions();
  const { sendHBD } = useHBDActions();

  const [asset, setAsset] = useState<HiveAsset>("HIVE");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [isSending, setIsSending] = useState(false);

  const amountNumber = parseFloat(amount);
  const isValid = Number.isFinite(amountNumber) && amountNumber > 0;

  const handleSend = useCallback(async () => {
    if (!isValid || isSending) return;
    setIsSending(true);
    try {
      const send = asset === "HIVE" ? sendHive : sendHBD;
      const result = await send(recipient, amountNumber, memo || undefined);

      if (!result.success) {
        toast({
          title: t("errorTitle"),
          description: result.error,
          status: "error",
          duration: 6000,
          isClosable: true,
        });
        return;
      }

      onSettled(amount, asset);
    } finally {
      setIsSending(false);
    }
  }, [
    isValid,
    isSending,
    asset,
    sendHive,
    sendHBD,
    recipient,
    amountNumber,
    memo,
    amount,
    onSettled,
    toast,
    t,
  ]);

  return (
    <VStack spacing={3} align="stretch" pt={2}>
      <Text fontSize="sm" color="dim">
        {t("toHiveAccount")} @{recipient}
      </Text>

      <FormControl>
        <FormLabel fontSize="sm" color="dim">
          {t("token")}
        </FormLabel>
        <Select
          value={asset}
          onChange={(event) => setAsset(event.target.value as HiveAsset)}
          bg="inputBg"
          borderColor="inputBorder"
          color="inputText"
        >
          <option value="HIVE">HIVE</option>
          <option value="HBD">HBD</option>
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel fontSize="sm" color="dim">
          {t("amount")}
        </FormLabel>
        <Input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0.000"
          inputMode="decimal"
          bg="inputBg"
          borderColor="inputBorder"
          color="inputText"
          _placeholder={{ color: "inputPlaceholder" }}
        />
      </FormControl>

      <FormControl>
        <FormLabel fontSize="sm" color="dim">
          {t("memo")}
        </FormLabel>
        <Input
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          placeholder={t("memoPlaceholder")}
          bg="inputBg"
          borderColor="inputBorder"
          color="inputText"
          _placeholder={{ color: "inputPlaceholder" }}
        />
      </FormControl>

      <Button
        onClick={handleSend}
        isDisabled={!isValid || isSending}
        isLoading={isSending}
        loadingText={t("sending")}
        variant="solid"
      >
        {t("send")}
      </Button>
    </VStack>
  );
}
