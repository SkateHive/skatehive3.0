"use client";

/**
 * Reverse Magi direction: BTC → HBD/HIVE. Unlike the outbound swap, this needs
 * no Hive signing and no VSC RC — Magi gives the user a personal BTC deposit
 * address; any BTC sent there is converted to the chosen asset and settled to
 * their Hive account after Bitcoin confirmations.
 */

import { useCallback, useEffect, useState } from "react";
import { Button, HStack, Image, Spinner, Text, VStack, useToast } from "@chakra-ui/react";
import { FaCopy } from "react-icons/fa";
import * as QRCode from "qrcode";
import { getBtcDepositAddress, type MagiBuyAsset, type MagiClient } from "@/lib/hive/magi";

interface BtcToHiveDepositProps {
  username: string;
  client: MagiClient;
}

export default function BtcToHiveDeposit({ username, client }: BtcToHiveDepositProps) {
  const toast = useToast();
  const [assetOut, setAssetOut] = useState<MagiBuyAsset>("HBD");
  const [address, setAddress] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAddress(null);
    setQr(null);
    (async () => {
      try {
        const addr = await getBtcDepositAddress(client, username, assetOut);
        if (cancelled) return;
        setAddress(addr);
        try {
          const dataUrl = await QRCode.toDataURL(addr, {
            width: 240,
            margin: 2,
            color: { dark: "#000000", light: "#ffffff" },
          });
          if (!cancelled) setQr(dataUrl);
        } catch {
          /* address still usable without the QR */
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't get a deposit address");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, username, assetOut]);

  const copy = useCallback(() => {
    if (!address) return;
    navigator.clipboard?.writeText(address);
    toast({ title: "BTC address copied", status: "success", duration: 2000, isClosable: true });
  }, [address, toast]);

  const eyebrow = {
    fontSize: "10px",
    fontFamily: "mono",
    color: "primary",
    opacity: 0.7,
    letterSpacing: "wider",
    textTransform: "uppercase",
  } as const;

  return (
    <VStack align="stretch" spacing={2}>
      <Text {...eyebrow}>Receive real BTC → get {assetOut} on Hive (via Magi)</Text>

      <HStack>
        {(["HBD", "HIVE"] as const).map((a) => (
          <Button
            key={a}
            flex={1}
            size="sm"
            borderRadius="none"
            fontFamily="mono"
            bg={assetOut === a ? "primary" : "transparent"}
            color={assetOut === a ? "background" : "primary"}
            borderWidth="1px"
            borderColor="primary"
            onClick={() => setAssetOut(a)}
          >
            BTC → {a}
          </Button>
        ))}
      </HStack>

      {loading && (
        <HStack justify="center" py={6} spacing={2}>
          <Spinner size="sm" color="primary" />
          <Text fontFamily="mono" fontSize="xs" color="primary" opacity={0.7}>
            Getting your BTC deposit address…
          </Text>
        </HStack>
      )}

      {error && (
        <Text fontFamily="mono" fontSize="xs" color="red.400">
          {error}
        </Text>
      )}

      {address && !loading && (
        <>
          {qr && (
            <HStack justify="center" py={1}>
              <Image src={qr} alt="BTC deposit QR" boxSize="180px" border="1px solid" borderColor="primary" />
            </HStack>
          )}
          <Text {...eyebrow}>Your BTC deposit address</Text>
          <HStack
            border="1px solid"
            borderColor="primary"
            bg="background"
            px={2}
            py={2}
            justify="space-between"
            spacing={2}
          >
            <Text fontFamily="mono" fontSize="xs" color="primary" wordBreak="break-all">
              {address}
            </Text>
            <Button
              size="xs"
              variant="ghost"
              color="primary"
              borderRadius="none"
              leftIcon={<FaCopy />}
              onClick={copy}
              flexShrink={0}
            >
              Copy
            </Button>
          </HStack>
          <Text fontFamily="mono" fontSize="10px" color="primary" opacity={0.6}>
            Send any amount of BTC to this address. Magi converts it to {assetOut} at
            market rate and settles it to @{username} on Hive after Bitcoin
            confirmations. No signature or RC needed — it&apos;s just a BTC send.
          </Text>
        </>
      )}
    </VStack>
  );
}
