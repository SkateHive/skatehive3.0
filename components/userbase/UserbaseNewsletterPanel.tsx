"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Heading,
  HStack,
  Spinner,
  Switch,
  Text,
} from "@chakra-ui/react";
import { useTranslations } from "@/contexts/LocaleContext";

type State =
  | { kind: "loading" }
  | { kind: "ready"; subscribed: boolean; saving: boolean }
  | { kind: "error"; message: string };

/**
 * Newsletter subscription toggle for the signed-in account. Reads/writes the
 * preference via /api/userbase/newsletter, which proxies to the marketing
 * portal (Paragraph publication) server-side.
 */
export default function UserbaseNewsletterPanel() {
  const t = useTranslations();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/userbase/newsletter")
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || typeof data?.subscribed !== "boolean") {
          setState({ kind: "error", message: data?.error || "Unavailable" });
        } else {
          setState({ kind: "ready", subscribed: data.subscribed, saving: false });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "error", message: "Unavailable" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(next: boolean) {
    if (state.kind !== "ready" || state.saving) return;
    const prev = state.subscribed;
    setState({ kind: "ready", subscribed: next, saving: true });
    try {
      const res = await fetch("/api/userbase/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscribed: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.subscribed !== "boolean") {
        throw new Error(data?.error || "save failed");
      }
      setState({ kind: "ready", subscribed: data.subscribed, saving: false });
    } catch {
      setState({ kind: "ready", subscribed: prev, saving: false });
    }
  }

  return (
    <Box border="1px solid" borderColor="muted" p={4}>
      <Heading size="sm" color="primary" mb={1}>
        {t("settings.newsletterTitle")}
      </Heading>
      <Text color="primary" fontSize="sm" opacity={0.8} mb={3}>
        {t("settings.newsletterDescription")}
      </Text>
      {state.kind === "loading" && <Spinner size="sm" color="primary" />}
      {state.kind === "error" && (
        <Text fontSize="sm" color="red.300">
          {state.message}
        </Text>
      )}
      {state.kind === "ready" && (
        <HStack spacing={3}>
          <Switch
            isChecked={state.subscribed}
            isDisabled={state.saving}
            onChange={(e) => toggle(e.target.checked)}
            colorScheme="green"
          />
          <Text fontSize="sm" color="primary">
            {t("settings.newsletterToggle")}
          </Text>
          {state.saving && <Spinner size="xs" color="primary" />}
        </HStack>
      )}
    </Box>
  );
}
