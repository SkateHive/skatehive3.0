"use client";
import React, { useState, useEffect } from "react";
import {
  Box,
  VStack,
  Heading,
  Text,
  Input,
  Button,
  useToast,
} from "@chakra-ui/react";
import { useAioha } from "@aioha/react-ui";
import { KeychainSDK, KeychainKeyTypes } from "keychain-sdk";
import { Operation } from "@hiveio/dhive";
import { mergeHiveProfileMetadata } from "@/lib/hive/profile-metadata";
import fetchAccount from "@/lib/hive/fetchAccount";
import { validateBtcAddress, normalizeBtcAddress } from "@/lib/utils/validateBtcAddress";
import { useTranslations } from "@/contexts/LocaleContext";

interface BtcAddressSettingsProps {
  username: string;
  /** Current BTC address parsed from Hive metadata (prefills the input). */
  currentAddress?: string;
}

const BtcAddressSettings: React.FC<BtcAddressSettingsProps> = ({
  username,
  currentAddress,
}) => {
  const t = useTranslations();
  const { user } = useAioha();
  const toast = useToast();
  const [value, setValue] = useState(currentAddress || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setValue(currentAddress || "");
  }, [currentAddress]);

  const trimmed = value.trim();
  const isValid = trimmed === "" || validateBtcAddress(trimmed);
  const hasChanges = normalizeBtcAddress(value) !== (currentAddress || "");

  const handleSave = async () => {
    if (!user || user !== username) {
      toast({
        title: t("settings.errorTitle"),
        description: t("settings.errorOwnPreferences"),
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    if (!isValid) {
      toast({
        title: t("settings.errorTitle"),
        description: t("settings.btcAddressInvalid"),
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const normalized = trimmed === "" ? "" : normalizeBtcAddress(trimmed);

    setIsSaving(true);
    try {
      const keychain = new KeychainSDK(window);
      const { jsonMetadata: currentMetadata, postingMetadata } =
        await fetchAccount(username);

      const { postingMetadata: mergedPosting, jsonMetadata: mergedJson } =
        mergeHiveProfileMetadata({
          currentPosting: postingMetadata,
          currentJson: currentMetadata,
          extensionsPatch: {
            wallets: {
              btc_address: normalized,
            },
          },
        });

      const operation: Operation = [
        "account_update2",
        {
          account: username,
          json_metadata: JSON.stringify(mergedJson),
          posting_json_metadata: JSON.stringify(mergedPosting || {}),
          extensions: [],
        },
      ];

      const result = await keychain.broadcast({
        username,
        operations: [operation],
        method: KeychainKeyTypes.active,
      } as any);

      if (!result) {
        throw new Error("Failed to update Bitcoin address");
      }

      // Mirror into userbase DB (non-fatal: Hive write is the source of truth).
      try {
        if (normalized) {
          await fetch("/api/userbase/profile/btc", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: normalized, source: "settings" }),
          });
        } else {
          await fetch("/api/userbase/profile/btc", {
            method: "DELETE",
            credentials: "include",
          });
        }
      } catch {
        // ignore — Hive metadata already updated
      }

      setValue(normalized);
      toast({
        title: t("settings.preferencesUpdated"),
        description: t("settings.btcAddressSaved"),
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error: any) {
      if (
        error.message?.includes("user_cancel") ||
        error.message?.includes("cancelled") ||
        error.message?.includes("User cancelled") ||
        error.message?.includes("User rejected") ||
        error.message?.includes("User denied")
      ) {
        // user cancelled the Keychain prompt — no error toast
      } else {
        toast({
          title: t("settings.errorTitle"),
          description: t("settings.errorSavingPreferences"),
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box bg="background" border="1px solid" borderColor="muted" p={6} shadow="sm">
      <VStack spacing={4} align="stretch">
        <Box>
          <Heading size="md" color="primary" mb={1}>
            {t("settings.btcAddress")}
          </Heading>
          <Text color="primary" fontSize="sm">
            {t("settings.btcAddressDescription")}
          </Text>
        </Box>

        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="bc1... / 1... / 3..."
          fontFamily="mono"
          bg="background"
          color="primary"
          borderColor={isValid ? "muted" : "error"}
          borderWidth="2px"
          _focus={{
            borderColor: isValid ? "accent" : "error",
            outline: "none",
          }}
          _hover={{ borderColor: isValid ? "accent" : "error" }}
        />
        {!isValid && (
          <Text color="error" fontSize="xs">
            {t("settings.btcAddressInvalid")}
          </Text>
        )}

        <Button
          onClick={handleSave}
          isLoading={isSaving}
          loadingText={t("settings.saving")}
          disabled={!hasChanges || !isValid}
          bgGradient="linear(to-r, primary, accent)"
          color="background"
          _hover={{ bg: "accent" }}
          fontWeight="bold"
          size="lg"
        >
          {t("settings.savePreferences")}
        </Button>
      </VStack>
    </Box>
  );
};

export default BtcAddressSettings;
