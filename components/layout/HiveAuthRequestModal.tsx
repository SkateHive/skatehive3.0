"use client";
import React, { useEffect, useState } from "react";
import { Box, Button, HStack, Image, Spinner, Text, VStack } from "@chakra-ui/react";
import * as QRCode from "qrcode";
import SkateModal from "@/components/shared/SkateModal";
import { useTranslations } from "@/contexts/LocaleContext";
import {
  cancelHiveAuthRequest,
  expireHiveAuthRequest,
  isMobileBrowser,
  subscribeHiveAuthRequest,
  type HiveAuthRequest,
  type HiveAuthRequestKind,
} from "@/lib/hive/hiveAuthRequests";

const TITLE_KEYS: Record<HiveAuthRequestKind, string> = {
  login: "titleLogin",
  challenge: "titleChallenge",
  sign: "titleSign",
};

/**
 * Shows the pending HiveAuth request (login, signature or transaction) so the
 * user can approve it in the Hive Keychain app. Mobile gets a button that opens
 * the app (iOS only opens another app from a tap); desktop gets a QR code.
 */
export default function HiveAuthRequestModal() {
  const t = useTranslations("hiveAuth");
  const [request, setRequest] = useState<HiveAuthRequest | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    setMobile(isMobileBrowser());
    return subscribeHiveAuthRequest(setRequest);
  }, []);

  useEffect(() => {
    const expire = request?.expire;
    if (!expire) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.ceil((expire - Date.now()) / 1000)));
      expireHiveAuthRequest();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [request]);

  useEffect(() => {
    setQr(null);
    if (!request || mobile) return;
    let cancelled = false;
    QRCode.toDataURL(request.payload, {
      width: 256,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((data) => {
        if (!cancelled) setQr(data);
      })
      .catch(() => {
        // The QR is a convenience: the has:// link around it still works.
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [request, mobile]);

  if (!request) return null;

  return (
    <SkateModal
      isOpen
      onClose={cancelHiveAuthRequest}
      title={t(TITLE_KEYS[request.kind])}
      isCentered
      size="sm"
      closeOnOverlayClick={false}
    >
      <VStack spacing={4} p={4} align="stretch">
        <Text fontFamily="mono" fontSize="sm" color="text" textAlign="center">
          {mobile ? t("mobileHint") : t("desktopHint")}
        </Text>

        {mobile ? (
          <Button
            as="a"
            href={request.payload}
            bg="primary"
            color="background"
            fontFamily="mono"
            fontSize="sm"
            textTransform="lowercase"
            h="44px"
            _hover={{ opacity: 0.9 }}
          >
            {t("openApp")}
          </Button>
        ) : (
          <Box
            as="a"
            href={request.payload}
            alignSelf="center"
            bg="white"
            p={2}
            borderRadius="sm"
            _focusVisible={{ outline: "2px solid", outlineColor: "primary", outlineOffset: "2px" }}
          >
            {qr ? (
              <Image src={qr} alt={t("qrAlt")} boxSize="224px" />
            ) : (
              <Box boxSize="224px" display="flex" alignItems="center" justifyContent="center">
                <Spinner color="black" />
              </Box>
            )}
          </Box>
        )}

        <HStack spacing={2} justify="center" role="status" aria-live="polite">
          <Spinner size="xs" color="gray.500" />
          <Text fontFamily="mono" fontSize="2xs" color="gray.500">
            {t("waiting")}
          </Text>
          {/* Kept out of the live region so screen readers are not told every second. */}
          {secondsLeft !== null && (
            <Text fontFamily="mono" fontSize="2xs" color="gray.500" aria-hidden="true">
              · {secondsLeft}s
            </Text>
          )}
        </HStack>

        <Button
          variant="ghost"
          size="sm"
          fontFamily="mono"
          fontSize="xs"
          color="gray.400"
          textTransform="lowercase"
          onClick={cancelHiveAuthRequest}
        >
          {t("cancel")}
        </Button>
      </VStack>
    </SkateModal>
  );
}
