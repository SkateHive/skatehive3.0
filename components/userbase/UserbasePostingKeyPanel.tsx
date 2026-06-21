"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
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
  // Curation-trail consent: opt-IN by default. When checked, the user's stored
  // key may upvote SkateHive official posts via the marketing trail.
  const [supportOfficial, setSupportOfficial] = useState(true);
  const [savingPref, setSavingPref] = useState(false);
  // Per-user vote weight for the trail boost, as a percentage (default 50%).
  const [voteWeight, setVoteWeight] = useState(50);

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

  const fetchTrailPreference = useCallback(async () => {
    if (!user) return;
    try {
      const response = await fetch("/api/userbase/keys/trail-preference", {
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok && typeof data?.support_official === "boolean") {
        setSupportOfficial(data.support_official);
        if (typeof data?.vote_weight === "number") {
          setVoteWeight(Math.round(data.vote_weight / 100));
        }
      }
    } catch (error) {
      console.error("Failed to fetch trail preference", error);
    }
  }, [user]);

  const handleWeightCommit = async (pct: number) => {
    setSavingPref(true);
    try {
      const response = await fetch("/api/userbase/keys/trail-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote_weight: pct * 100 }),
      });
      if (!response.ok) throw new Error("Failed to save weight");
      toast({ title: `Voto ajustado para ${pct}%`, status: "success", duration: 1800 });
    } catch (error: any) {
      toast({ title: "Não foi possível salvar o peso.", description: error?.message, status: "error", duration: 3000 });
    } finally {
      setSavingPref(false);
    }
  };

  const handleToggleSupport = async (next: boolean) => {
    setSupportOfficial(next); // optimistic
    setSavingPref(true);
    try {
      const response = await fetch("/api/userbase/keys/trail-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ support_official: next }),
      });
      if (!response.ok) throw new Error("Failed to save preference");
      toast({
        title: next
          ? "Você está apoiando os posts oficiais da SkateHive 🛹"
          : "Você saiu da curadoria dos posts oficiais.",
        status: "success",
        duration: 2500,
      });
    } catch (error: any) {
      setSupportOfficial(!next); // revert
      toast({ title: "Não foi possível salvar.", description: error?.message, status: "error", duration: 3000 });
    } finally {
      setSavingPref(false);
    }
  };

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
      fetchTrailPreference();
    }
  }, [
    user,
    refreshHiveIdentity,
    fetchPostingKeyStatus,
    fetchTrailPreference,
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

      {postingStatus?.stored && (
        <Box mt={5} pt={4} borderTopWidth="1px" borderColor="border">
          <Checkbox
            isChecked={supportOfficial}
            isDisabled={savingPref}
            onChange={(e) => handleToggleSupport(e.target.checked)}
            colorScheme="green"
          >
            <Text as="span" color="primary" fontSize="sm" fontWeight="medium">
              Apoiar os posts oficiais da SkateHive
            </Text>
          </Checkbox>
          <FormHelperText color="dim" mt={1}>
            Com isso marcado, sua conta dá um upvote automático nos posts
            oficiais (SkateHive, Gnars, Reelflip, Nogenta) pra fortalecer a
            comunidade. Você pode desmarcar quando quiser — aí sai da curadoria.
          </FormHelperText>

          {supportOfficial && (
            <Box mt={4}>
              <HStack justify="space-between" mb={1}>
                <Text color="primary" fontSize="sm" fontWeight="medium">
                  Peso do meu voto
                </Text>
                <Text color="primary" fontSize="sm" fontWeight="bold">
                  {voteWeight}%
                </Text>
              </HStack>
              <Slider
                aria-label="peso-do-voto"
                min={1}
                max={100}
                step={1}
                value={voteWeight}
                isDisabled={savingPref}
                onChange={setVoteWeight}
                onChangeEnd={handleWeightCommit}
                colorScheme="green"
              >
                <SliderTrack>
                  <SliderFilledTrack />
                </SliderTrack>
                <SliderThumb />
              </Slider>
              <FormHelperText color="dim" mt={1}>
                Quanto do seu poder de voto vai em cada post oficial. Padrão 50%.
              </FormHelperText>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
