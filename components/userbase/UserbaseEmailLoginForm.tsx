"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormHelperText,
  HStack,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { useTranslations } from "@/lib/i18n/hooks";
import { useAioha } from "@aioha/react-ui";
import { useAccount, useEnsAvatar, useEnsName } from "wagmi";
import { useFarcasterSession } from "@/hooks/useFarcasterSession";

// Blinking cursor animation
const blink = keyframes`
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
`;

type RequestStatus = "idle" | "loading" | "success" | "error";
type LookupStatus = "idle" | "checking" | "found" | "new" | "error";

// SkateHive marketing portal endpoint that adds the email to the Paragraph
// newsletter publication (paragraph.com/@skatehive). Public + idempotent;
// every newsletter email carries an unsubscribe link.
const NEWSLETTER_SUBSCRIBE_URL =
  process.env.NEXT_PUBLIC_NEWSLETTER_SUBSCRIBE_URL ||
  "https://skatehive.reelflip.com/api/newsletter/subscribe";

interface UserbaseEmailLoginFormProps {
  redirect?: string | null;
  variant?: "full" | "compact";
}

export default function UserbaseEmailLoginForm({
  redirect,
  variant = "full",
}: UserbaseEmailLoginFormProps) {
  const t = useTranslations("signIn");
  const { user: hiveUser } = useAioha();
  const { address } = useAccount();
  const { data: ensName } = useEnsName({ address, chainId: 1 });
  const { data: ensAvatar } = useEnsAvatar({
    name: ensName ?? undefined,
    chainId: 1,
    query: {
      enabled: !!ensName,
    },
  });
  const { profile: farcasterProfile } = useFarcasterSession();
  const [email, setEmail] = useState("");
  const [handle, setHandle] = useState("");
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [error, setError] = useState("");
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>("idle");
  const [lookupError, setLookupError] = useState("");
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [newsletterOptIn, setNewsletterOptIn] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup: abort any in-flight request on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const resetStatus = () => {
    if (status !== "idle") {
      setStatus("idle");
      setError("");
      setExpiresAt(null);
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    resetStatus();
  };

  const handleHandleChange = (value: string) => {
    setHandle(value);
    resetStatus();
  };

  const trimmedEmail = email.trim();
  const trimmedHandle = handle.trim();
  const isEmailValid = /.+@.+\..+/.test(trimmedEmail);
  const shouldShowHandle = lookupStatus === "new";

  // Email lookup effect - only triggers on email change
  useEffect(() => {
    if (!trimmedEmail || !isEmailValid) {
      setLookupStatus("idle");
      setLookupError("");
      setHandleAvailable(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setLookupStatus("checking");
        setLookupError("");
        const response = await fetch("/api/userbase/auth/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: trimmedEmail,
          }),
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || t("errorFallback"));
        }

        const exists = Boolean(data?.exists);
        setLookupStatus(exists ? "found" : "new");
        // Don't set handle availability here - separate effect handles it
      } catch (lookupError: any) {
        if (controller.signal.aborted) return;
        setLookupStatus("error");
        setLookupError(lookupError?.message || t("errorFallback"));
        setHandleAvailable(null);
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedEmail, isEmailValid, t]);

  // Handle availability check - separate effect, only runs when handle changes AND account is new
  useEffect(() => {
    // Only check handle availability for new accounts
    if (lookupStatus !== "new" || !trimmedHandle) {
      setHandleAvailable(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/userbase/auth/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: trimmedEmail,
            handle: trimmedHandle,
          }),
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;
        const data = await response.json();
        if (!response.ok) {
          setHandleAvailable(null);
          return;
        }

        if (typeof data?.handle_available === "boolean") {
          setHandleAvailable(data.handle_available);
        } else {
          setHandleAvailable(null);
        }
      } catch {
        if (controller.signal.aborted) return;
        setHandleAvailable(null);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedHandle, trimmedEmail, lookupStatus]);

  const sendMagicLink = async () => {
    if (!trimmedEmail) {
      setStatus("error");
      setError(t("emailRequired"));
      return;
    }

    // Abort any previous in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setStatus("loading");
      setError("");

      const payload: Record<string, string> = {
        identifier: trimmedEmail,
      };

      if (trimmedHandle) {
        payload.handle = trimmedHandle;
      }

      if (preferredAvatarUrl) {
        payload.avatar_url = preferredAvatarUrl;
      }

      if (redirect) {
        payload.redirect = redirect;
      }

      const response = await fetch("/api/userbase/auth/magic-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      // Skip state updates if aborted
      if (controller.signal.aborted) return;

      const data = await response.json();

      // Skip state updates if aborted
      if (controller.signal.aborted) return;

      if (!response.ok) {
        const details =
          typeof data?.details === "string"
            ? data.details
            : data?.details
            ? JSON.stringify(data.details)
            : null;
        const baseError = data?.error || t("errorFallback");
        const errorMessage = details ? `${baseError} (${details})` : baseError;

        setStatus("error");
        setError(errorMessage);
        return;
      }

      setStatus("success");
      setExpiresAt(typeof data?.expires_at === "string" ? data.expires_at : null);

      // Fire-and-forget newsletter opt-in — never blocks or fails the login.
      if (newsletterOptIn) {
        fetch(NEWSLETTER_SUBSCRIBE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmedEmail }),
        }).catch(() => {});
      }
    } catch (requestError) {
      // Skip state updates if request was aborted
      if (controller.signal.aborted) return;
      if (requestError instanceof Error && requestError.name === "AbortError") return;

      console.error("Magic link request failed:", requestError);
      setStatus("error");
      setError(t("errorFallback"));
    }
  };

  const successEmail = trimmedEmail;
  const expiresLabel = useMemo(() => {
    if (!expiresAt) return null;
    return new Date(expiresAt).toLocaleString();
  }, [expiresAt]);

  const hiveHandle =
    typeof hiveUser === "string"
      ? hiveUser
      : hiveUser?.name || hiveUser?.username || null;
  const preferredAvatarUrl = useMemo(() => {
    const hiveAvatar = hiveHandle
      ? `https://images.hive.blog/u/${hiveHandle}/avatar`
      : null;
    const farcasterAvatar = farcasterProfile?.pfpUrl || null;
    return hiveAvatar || ensAvatar || farcasterAvatar || null;
  }, [hiveHandle, ensAvatar, farcasterProfile]);

  const isCompact = variant === "compact";
  const canSend =
    isEmailValid &&
    (lookupStatus === "found" ||
      (lookupStatus === "new" &&
        trimmedHandle.length > 0 &&
        handleAvailable !== false));

  return (
    <VStack spacing={3} align="stretch">
      {status === "error" && (
        <Alert status="error" borderRadius="none" py={2} bg="red.900" border="1px solid" borderColor="red.700">
          <AlertIcon boxSize={3} />
          <Text fontSize="xs" fontFamily="mono" color="red.200">{error}</Text>
        </Alert>
      )}

      {status === "success" && (
        <Alert status="success" borderRadius="none" py={2} bg="green.900" border="1px solid" borderColor="green.700">
          <AlertIcon boxSize={3} />
          <Box>
            <Text fontSize="xs" fontFamily="mono" fontWeight="bold" color="green.200">{t("successTitle")}</Text>
            <Text fontSize="xs" fontFamily="mono" color="green.300">
              → <Text as="span" color="green.100">{successEmail}</Text>
            </Text>
            <Text fontSize="2xs" fontFamily="mono" color="green.600" mt={1}>
              check spam folder
            </Text>
          </Box>
        </Alert>
      )}

      {/* Email Input - Perfect CLI alignment */}
      <FormControl isRequired>
        <Box 
          bg="blackAlpha.400"
          borderRadius="sm"
          border="1px solid"
          borderColor="whiteAlpha.200"
          _focusWithin={{
            borderColor: "primary",
            boxShadow: "0 0 0 1px var(--chakra-colors-primary)",
          }}
          transition="all 0.15s"
        >
          <HStack spacing={0} alignItems="center" h={isCompact ? "32px" : "40px"} position="relative">
            <HStack spacing={0} alignItems="center" flex={1}>
              <Text 
                fontFamily="mono" 
                fontSize={isCompact ? "xs" : "sm"} 
                color="gray.500" 
                pl={3}
                pr={0}
                userSelect="none"
                flexShrink={0}
                lineHeight="1"
              >
                email&gt;
              </Text>
              <Input
                type="email"
                value={email}
                onChange={(event) => handleEmailChange(event.target.value)}
                placeholder="you@example.com"
                bg="transparent"
                border="none"
                borderRadius="none"
                color="text"
                fontFamily="mono"
                fontSize={isCompact ? "xs" : "sm"}
                _placeholder={{ color: "gray.600" }}
                _focus={{ boxShadow: "none", outline: "none" }}
                autoComplete="email"
                h="full"
                px={2}
                pl={2}
                flex={1}
                sx={{
                  caretColor: "var(--chakra-colors-primary)",
                }}
              />
            </HStack>
          </HStack>
        </Box>
        {lookupStatus === "checking" && (
          <FormHelperText fontFamily="mono" fontSize="2xs" color="gray.500" mt={1} ml={1}>
            → checking...
          </FormHelperText>
        )}
        {lookupStatus === "found" && (
          <FormHelperText fontFamily="mono" fontSize="2xs" color="green.400" mt={1} ml={1}>
            → account found
          </FormHelperText>
        )}
        {lookupStatus === "new" && (
          <FormHelperText fontFamily="mono" fontSize="2xs" color="yellow.400" mt={1} ml={1}>
            → new account detected
          </FormHelperText>
        )}
        {lookupStatus === "error" && lookupError && (
          <FormHelperText fontFamily="mono" fontSize="2xs" color="red.400" mt={1} ml={1}>
            → {lookupError}
          </FormHelperText>
        )}
      </FormControl>

      {/* Handle Input - Perfect CLI alignment */}
      {shouldShowHandle && (
        <FormControl>
          <Box 
            bg="blackAlpha.400"
            borderRadius="sm"
            border="1px solid"
            borderColor="whiteAlpha.200"
            _focusWithin={{
              borderColor: "primary",
              boxShadow: "0 0 0 1px var(--chakra-colors-primary)",
            }}
            transition="all 0.15s"
          >
            <HStack spacing={0} alignItems="center" h={isCompact ? "32px" : "40px"} position="relative">
              <HStack spacing={0} alignItems="center" flex={1}>
                <Text 
                  fontFamily="mono" 
                  fontSize={isCompact ? "xs" : "sm"} 
                  color="gray.500" 
                  pl={3}
                  pr={0}
                  userSelect="none"
                  flexShrink={0}
                  lineHeight="1"
                >
                  handle&gt;
                </Text>
                <Input
                  type="text"
                  value={handle}
                  onChange={(event) => handleHandleChange(event.target.value)}
                  placeholder="your-name"
                  bg="transparent"
                  border="none"
                  borderRadius="none"
                  color="text"
                  fontFamily="mono"
                  fontSize={isCompact ? "xs" : "sm"}
                  _placeholder={{ color: "gray.600" }}
                  _focus={{ boxShadow: "none", outline: "none" }}
                  autoComplete="username"
                  h="full"
                  px={2}
                  pl={2}
                  flex={1}
                  sx={{
                    caretColor: "var(--chakra-colors-primary)",
                  }}
                />
              </HStack>
            </HStack>
          </Box>
          {handleAvailable === false && (
            <FormHelperText fontFamily="mono" fontSize="2xs" color="red.400" mt={1} ml={1}>
              → handle taken
            </FormHelperText>
          )}
        </FormControl>
      )}

      {/* Newsletter opt-in */}
      <Checkbox
        isChecked={newsletterOptIn}
        onChange={(event) => setNewsletterOptIn(event.target.checked)}
        size="sm"
        colorScheme="green"
      >
        <Text fontFamily="mono" fontSize="2xs" color="gray.400">
          {t("newsletterOptIn")}
        </Text>
      </Checkbox>

      {/* Primary action button - EMPHASIZED */}
      <Button
        onClick={sendMagicLink}
        isLoading={status === "loading"}
        loadingText="sending..."
        size={isCompact ? "sm" : "md"}
        isDisabled={lookupStatus === "checking" || status === "loading" || !canSend}
        fontFamily="mono"
        fontSize={isCompact ? "xs" : "sm"}
        textTransform="uppercase"
        letterSpacing="wider"
        bg="primary"
        color="background"
        border="2px solid"
        borderColor="primary"
        h={isCompact ? "36px" : "44px"}
        _hover={{
          bg: "transparent",
          color: "primary",
          borderColor: "primary",
        }}
        _active={{
          bg: "primary",
          color: "background",
        }}
        _disabled={{
          bg: "gray.800",
          color: "gray.600",
          borderColor: "gray.700",
          cursor: "not-allowed",
          opacity: 0.5,
        }}
        transition="all 0.15s"
      >
        {status === "success" ? "resend →" : "authenticate →"}
      </Button>
    </VStack>
  );
}
