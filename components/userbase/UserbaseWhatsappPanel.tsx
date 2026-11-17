"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Code, Heading, HStack, Text, VStack } from "@chakra-ui/react";
import { useTranslations } from "@/contexts/LocaleContext";
import { LinkCodeRequestGuard } from "@/lib/userbase/linkCodeRequest";

type CodeState = { code: string; expiresAt: string; botNumber: string | null };

// Link a WhatsApp number to this account: the site shows a short-lived code,
// the person sends it to the bot from that WhatsApp, and the API binds the
// number (it only ever stores a hash of it).
export default function UserbaseWhatsappPanel() {
  const t = useTranslations();
  const [state, setState] = useState<CodeState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // The parent keys this panel by user id, so an account switch remounts it;
  // the guard also drops a response that lands after unmount or a newer click.
  const guard = useRef(new LinkCodeRequestGuard());
  useEffect(() => {
    const g = guard.current;
    return () => g.invalidate();
  }, []);

  const getCode = useCallback(async () => {
    const token = guard.current.begin();
    setLoading(true);
    setError(false);
    setState(null);
    try {
      const res = await fetch("/api/userbase/whatsapp/link-code", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!guard.current.isCurrent(token)) return;
      if (!res.ok || !data?.code) throw new Error("link_code_failed");
      setState({ code: data.code, expiresAt: data.expires_at, botNumber: data.bot_number ?? null });
    } catch {
      if (!guard.current.isCurrent(token)) return;
      setState(null);
      setError(true);
    } finally {
      if (guard.current.isCurrent(token)) setLoading(false);
    }
  }, []);

  const waLink = state?.botNumber
    ? `https://wa.me/${state.botNumber.replace(/\D/g, "")}?text=${encodeURIComponent(state.code)}`
    : null;

  return (
    <VStack align="stretch" spacing={3}>
      <Box>
        <Heading size="sm" color="primary" mb={1}>
          {t("settings.whatsappCardTitle")}
        </Heading>
        <Text fontSize="sm" color="dim">
          {t("settings.whatsappCardDescription")}
        </Text>
      </Box>
      {state ? (
        <VStack align="stretch" spacing={2}>
          <Text fontSize="sm">{t("settings.whatsappCodeInstructions")}</Text>
          <HStack>
            <Code fontSize="lg" px={3} py={1} colorScheme="green">
              {state.code}
            </Code>
            {waLink && (
              <Button as="a" href={waLink} target="_blank" rel="noopener noreferrer" size="sm"
                variant="outline" borderColor="border" color="primary" borderRadius="none"
                _hover={{ borderColor: "primary" }}>
                WhatsApp
              </Button>
            )}
          </HStack>
          <Text fontSize="xs" color="dim">{t("settings.whatsappCodeExpires")}</Text>
        </VStack>
      ) : null}
      {error && (
        <Text fontSize="sm" color="red.400">{t("settings.whatsappCodeError")}</Text>
      )}
      <Box>
        <Button onClick={getCode} isLoading={loading} size="sm" variant="outline" borderColor="border"
          color="primary" borderRadius="none" _hover={{ borderColor: "primary" }}>
          {t("settings.whatsappGenerateCode")}
        </Button>
      </Box>
    </VStack>
  );
}
