"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Text,
  useToast,
} from "@chakra-ui/react";
import { useTranslations } from "@/contexts/LocaleContext";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";

interface PostingKeyStatus {
  stored: boolean;
  custody?: string;
  status?: string;
  created_at?: string;
  last_used_at?: string;
  rotation_count?: number;
}

interface UserbasePostingKeyPanelProps {
  variant?: "settings" | "modal";
  refreshSignal?: number;
  onSaveSuccess?: () => void;
}

export default function UserbasePostingKeyPanel({
  variant = "settings",
  refreshSignal,
  onSaveSuccess,
}: UserbasePostingKeyPanelProps) {
  const t = useTranslations();
  const toast = useToast();
  const { user, identitiesVersion } = useUserbaseAuth();

  const [postingKey, setPostingKey] = useState("");
  const [postingStatus, setPostingStatus] =
    useState<PostingKeyStatus | null>(null);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isRemovingKey, setIsRemovingKey] = useState(false);
  const [hiveIdentity, setHiveIdentity] = useState<string | null>(null);

  const hasHiveIdentity = !!hiveIdentity;

  const fetchPostingKeyStatus = useCallback(async () => {
    if (!user) return;
    try {
      const response = await fetch("/api/userbase/keys/posting", {
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok) {
        setPostingStatus(data);
      }
    } catch (error) {
      console.error("Failed to fetch posting key status", error);
    }
  }, [user]);

  const refreshHiveIdentity = useCallback(async () => {
    if (!user) return;
    try {
      const response = await fetch("/api/userbase/identities", {
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok) {
        const hive = (data?.identities || []).find(
          (identity: any) => identity.type === "hive"
        );
        setHiveIdentity(hive?.handle || null);
      }
    } catch (error) {
      console.error("Failed to refresh hive identity", error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshHiveIdentity();
      fetchPostingKeyStatus();
    }
  }, [
    user,
    refreshHiveIdentity,
    fetchPostingKeyStatus,
    refreshSignal,
    identitiesVersion,
  ]);

  const handleSavePostingKey = async () => {
    if (!postingKey.trim()) {
      toast({
        title: t("settings.postingKeyMissing"),
        status: "warning",
        duration: 2500,
      });
      return;
    }

    if (!hasHiveIdentity) {
      toast({
        title: t("settings.needsHiveIdentity"),
        status: "warning",
        duration: 2500,
      });
      return;
    }

    setIsSavingKey(true);
    try {
      const response = await fetch("/api/userbase/keys/posting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posting_key: postingKey.trim(),
          handle: hiveIdentity,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || t("settings.postingKeyError"));
      }
      setPostingKey("");
      await fetchPostingKeyStatus();
      toast({
        title: t("settings.postingKeySaved"),
        status: "success",
        duration: 2500,
      });
      onSaveSuccess?.();
    } catch (error: any) {
      toast({
        title: t("settings.postingKeyError"),
        description: error?.message,
        status: "error",
        duration: 3000,
      });
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleRemovePostingKey = async () => {
    setIsRemovingKey(true);
    try {
      const response = await fetch("/api/userbase/keys/posting", {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || t("settings.postingKeyError"));
      }
      await fetchPostingKeyStatus();
      toast({
        title: t("settings.postingKeyRemoved"),
        status: "success",
        duration: 2500,
      });
    } catch (error: any) {
      toast({
        title: t("settings.postingKeyError"),
        description: error?.message,
        status: "error",
        duration: 3000,
      });
    } finally {
      setIsRemovingKey(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Box>
      <Heading
        size={variant === "modal" ? "xs" : "sm"}
        color="primary"
        mb={2}
      >
        {t("settings.postingKeyTitle")}
      </Heading>
      <Text color="primary" fontSize="sm" mb={4}>
        {t("settings.postingKeyDescription")}
      </Text>

      {postingStatus?.stored ? (
        <Text color="primary" fontSize="sm" mb={3}>
          {t("settings.postingKeyStored")}
        </Text>
      ) : (
        <Text color="primary" fontSize="sm" mb={3}>
          {t("settings.postingKeyNotStored")}
        </Text>
      )}

      <FormControl>
        <FormLabel color="primary">{t("settings.postingKeyLabel")}</FormLabel>
        <Input
          type="password"
          value={postingKey}
          onChange={(event) => setPostingKey(event.target.value)}
          placeholder={t("settings.postingKeyPlaceholder")}
          bg="inputBg"
          borderColor="inputBorder"
          color="inputText"
          _placeholder={{ color: "inputPlaceholder" }}
        />
        <FormHelperText color="dim">
          {t("settings.postingKeyHelper")}
        </FormHelperText>
      </FormControl>

      {!hasHiveIdentity && (
        <Text color="warning" fontSize="sm" mt={2}>
          {t("settings.needsHiveIdentity")}
        </Text>
      )}

      <HStack mt={4} spacing={3}>
        <Button
          onClick={handleSavePostingKey}
          isLoading={isSavingKey}
          size="sm"
          isDisabled={!hasHiveIdentity}
        >
          {t("settings.savePostingKey")}
        </Button>
        <Button
          onClick={handleRemovePostingKey}
          isLoading={isRemovingKey}
          size="sm"
          variant="outline"
        >
          {t("settings.removePostingKey")}
        </Button>
      </HStack>
    </Box>
  );
}
