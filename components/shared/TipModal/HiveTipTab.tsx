"use client";

import { useCallback, useState } from "react";
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Input,
  VStack,
} from "@chakra-ui/react";
import { useTranslations } from "@/contexts/LocaleContext";
import { useHiveActions, useHBDActions } from "@/hooks/wallet";
import RecipientStrip from "./RecipientStrip";
import TipErrorBar from "./TipErrorBar";
import TokenSelect from "./TokenSelect";

const ASSET_OPTIONS = [
  { value: "HIVE", label: "HIVE", logo: "/logos/hiveLogo.png" },
  { value: "HBD", label: "HBD", logo: "/logos/hbd_logo.png" },
];

type HiveAsset = "HIVE" | "HBD";

interface HiveTipTabProps {
  recipient: string;
  onSettled: (amount: string, symbol: string, txUrl: string | null) => void;
}

export default function HiveTipTab({ recipient, onSettled }: HiveTipTabProps) {
  const t = useTranslations("tip");
  const { sendHive } = useHiveActions();
  const { sendHBD } = useHBDActions();

  const [asset, setAsset] = useState<HiveAsset>("HIVE");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const amountNumber = parseFloat(amount);
  const isValid = Number.isFinite(amountNumber) && amountNumber > 0;

  const handleSend = useCallback(async () => {
    if (!isValid || isSending) return;
    setIsSending(true);
    setSendError(null);
    try {
      const send = asset === "HIVE" ? sendHive : sendHBD;
      const result = await send(recipient, amountNumber, memo || undefined);

      if (!result.success) {
        setSendError(result.error || t("errorTitle"));
        return;
      }

      onSettled(amount, asset, null);
    } finally {
      setIsSending(false);
    }
  }, [isValid, isSending, asset, sendHive, sendHBD, recipient, amountNumber, memo, amount, onSettled, t]);

  return (
    <Box position="relative">
      <VStack spacing={0} align="stretch" pb={sendError ? "70px" : 0}>
        <RecipientStrip label={`@${recipient}`} note={t("noteHive")} />

        <FormControl mt={4}>
          <FormLabel fontSize="10px" letterSpacing="2px" color="dim" textTransform="uppercase">
            {t("amount")}
          </FormLabel>
          <Flex
            align="stretch"
            bg="inputBg"
            border="1px solid"
            borderColor="inputBorder"
            opacity={isSending ? 0.45 : 1}
            _focusWithin={{ borderColor: "primary" }}
          >
            <Input
              variant="unstyled"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.000"
              inputMode="decimal"
              fontSize="26px"
              color="inputText"
              _placeholder={{ color: "inputPlaceholder" }}
              px={4}
              py={3}
              isDisabled={isSending}
            />
            <Flex align="center" borderLeft="1px solid" borderColor="inputBorder" px={3}>
              <TokenSelect
                value={asset}
                options={ASSET_OPTIONS}
                onChange={(next) => setAsset(next as HiveAsset)}
                isDisabled={isSending}
              />
            </Flex>
          </Flex>
        </FormControl>

        <FormControl mt={3.5}>
          <FormLabel fontSize="10px" letterSpacing="2px" color="dim" textTransform="uppercase">
            {t("memo")}
          </FormLabel>
          <Input
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            placeholder={t("memoPlaceholder")}
            bg="inputBg"
            borderColor="inputBorder"
            color="inputText"
            borderRadius={0}
            _placeholder={{ color: "inputPlaceholder" }}
            _focus={{ borderColor: "primary", boxShadow: "none" }}
            opacity={isSending ? 0.45 : 1}
            isDisabled={isSending}
          />
        </FormControl>

        <Button
          onClick={handleSend}
          isDisabled={!isValid || isSending}
          mt={5}
          h="44px"
          borderRadius={0}
          fontFamily="mono"
          fontWeight="bold"
          letterSpacing="3px"
          textTransform="uppercase"
          bg={isSending ? "background" : "primary"}
          color={isSending ? "primary" : "background"}
          border="1px solid"
          borderColor="primary"
          _hover={{ opacity: 0.85 }}
        >
          {isSending ? t("sending") : t("send")}
        </Button>
      </VStack>

      {sendError && (
        <TipErrorBar message={sendError} onRetry={handleSend} onDismiss={() => setSendError(null)} />
      )}
    </Box>
  );
}
