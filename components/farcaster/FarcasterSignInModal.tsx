"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  HStack,
  Image,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { SiFarcaster } from "react-icons/si";
import * as QRCode from "qrcode";
import SkateModal from "@/components/shared/SkateModal";
import useIsMobile from "@/hooks/useIsMobile";
import { useTranslations } from "@/contexts/LocaleContext";

interface FarcasterSignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Relay sign-in URL from auth-kit. Null while the channel is still opening. */
  url: string | null;
  isError: boolean;
  error?: { message?: string } | null;
  onRetry: () => void;
}

/**
 * How long to wait for the relay to hand us a channel URL before treating it as
 * a failure. Without this the user sits on a spinner forever when the relay is
 * unreachable — which is the silent breakage issue #94 reported.
 */
const CHANNEL_TIMEOUT_MS = 20_000;

/**
 * Sign-in surface for the Farcaster auth-kit relay flow.
 *
 * Desktop shows a QR code to scan with the phone — the relay URL is not
 * something a desktop browser can complete on its own. Mobile gets a direct
 * deep link. Both open from a real click, so the browser never blocks them.
 */
export default function FarcasterSignInModal({
  isOpen,
  onClose,
  url,
  isError,
  error,
  onRetry,
}: FarcasterSignInModalProps) {
  const isMobile = useIsMobile();
  const t = useTranslations();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    },
    []
  );

  // Copy reads `url` at click time on purpose — the URL arrives asynchronously
  // after this modal mounts, so anything capturing it at mount would copy an
  // empty string.
  const onCopy = useCallback(() => {
    if (!url) return;
    navigator.clipboard?.writeText(url).then(
      () => {
        setHasCopied(true);
        if (copyResetRef.current) clearTimeout(copyResetRef.current);
        copyResetRef.current = setTimeout(() => setHasCopied(false), 2000);
      },
      () => {
        // Clipboard can be denied by permissions — the QR and deep link remain.
      }
    );
  }, [url]);

  useEffect(() => {
    if (!url) {
      setQrDataUrl(null);
      return;
    }

    let cancelled = false;
    QRCode.toDataURL(url, {
      width: 256,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((data) => {
        if (!cancelled) setQrDataUrl(data);
      })
      .catch(() => {
        // QR is a convenience — the deep link and copy fallback still work.
        if (!cancelled) setQrDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    if (!isOpen || url) {
      setTimedOut(false);
      return;
    }
    const id = setTimeout(() => setTimedOut(true), CHANNEL_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [isOpen, url]);

  const handleOpenInApp = useCallback(() => {
    if (!url) return;
    // Called straight from the click, so this is never popup-blocked.
    window.open(url, "_blank", "noopener,noreferrer");
  }, [url]);

  const handleRetry = useCallback(() => {
    setTimedOut(false);
    onRetry();
  }, [onRetry]);

  const failed = isError || timedOut;

  return (
    <SkateModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("auth.farcasterSignInTitle")}
      size="sm"
      isCentered
    >
      <Box p={5}>
        {failed ? (
          <VStack spacing={4} py={4} role="alert" aria-live="assertive">
            <Text fontFamily="mono" fontSize="sm" color="red.400">
              {t("auth.farcasterConnectFailed")}
            </Text>
            <Text
              fontFamily="mono"
              fontSize="xs"
              color="gray.400"
              textAlign="center"
            >
              {error?.message || t("auth.farcasterTimedOut")}
            </Text>
            <Button
              size="sm"
              fontFamily="mono"
              variant="outline"
              borderRadius={0}
              onClick={handleRetry}
            >
              {t("auth.farcasterRetry")}
            </Button>
          </VStack>
        ) : !url ? (
          <VStack spacing={3} py={8}>
            <Spinner color="primary" />
            <Text fontFamily="mono" fontSize="xs" color="gray.400">
              {t("auth.farcasterOpeningChannel")}
            </Text>
          </VStack>
        ) : isMobile ? (
          <VStack spacing={4} py={2}>
            <Text
              fontFamily="mono"
              fontSize="xs"
              color="gray.400"
              textAlign="center"
            >
              {t("auth.farcasterApproveHint")}
            </Text>
            <Button
              w="full"
              fontFamily="mono"
              borderRadius={0}
              colorScheme="purple"
              leftIcon={<SiFarcaster />}
              onClick={handleOpenInApp}
            >
              {t("auth.farcasterOpenApp")}
            </Button>
            <Button
              size="xs"
              variant="ghost"
              fontFamily="mono"
              color="gray.500"
              onClick={onCopy}
            >
              {hasCopied
                ? t("auth.farcasterLinkCopied")
                : t("auth.farcasterCopyLink")}
            </Button>
          </VStack>
        ) : (
          <VStack spacing={4} py={2}>
            <Text
              fontFamily="mono"
              fontSize="xs"
              color="gray.400"
              textAlign="center"
            >
              {t("auth.farcasterScanHint")}
            </Text>

            {qrDataUrl ? (
              <Box p={2} bg="white" borderRadius="sm">
                <Image
                  src={qrDataUrl}
                  alt={t("auth.farcasterQrAlt")}
                  boxSize="220px"
                />
              </Box>
            ) : (
              <Box boxSize="220px" display="grid" placeItems="center">
                <Spinner color="primary" />
              </Box>
            )}

            <HStack spacing={2}>
              <Button
                size="xs"
                variant="ghost"
                fontFamily="mono"
                color="gray.500"
                onClick={handleOpenInApp}
              >
                {t("auth.farcasterOpenNewTab")}
              </Button>
              <Button
                size="xs"
                variant="ghost"
                fontFamily="mono"
                color="gray.500"
                onClick={onCopy}
              >
                {hasCopied
                  ? t("auth.farcasterLinkCopied")
                  : t("auth.farcasterCopyLink")}
              </Button>
            </HStack>
          </VStack>
        )}
      </Box>
    </SkateModal>
  );
}
