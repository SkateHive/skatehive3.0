"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, HStack, Input, Spinner, Text, VStack, useToast } from "@chakra-ui/react";
import { useAioha } from "@aioha/react-ui";
import { KeyTypes } from "@aioha/aioha";
import useHiveAccount from "@/hooks/useHiveAccount";
import { extractNumber } from "@/lib/utils/extractNumber";
import { migrateLegacyMetadata } from "@/lib/utils/metadataMigration";
import EnableMagiRcButton from "@/components/wallet/components/EnableMagiRcButton";
import BtcToHiveDeposit from "@/components/wallet/BtcToHiveDeposit";
import {
  getMagiClient,
  getMagiPreview,
  isValidBtcAddress,
  clampDecimalString,
  magiInputDecimals,
  type MagiAssetIn,
  type MagiPreview,
} from "@/lib/hive/magi";

/**
 * Magi cross-chain swap: HIVE/HBD → real BTC, signed with Aioha (two Hive ops:
 * transfer + custom_json, so Keychain / KeepKey / any Aioha provider works).
 * Magi settles real BTC to the recipient address — the proper native route (the
 * old Hive-Engine SWAP.BTC path was thin wrapped-token liquidity and was removed).
 */
export default function CrossChainSwapPanel() {
  const { user, aioha } = useAioha();
  const { hiveAccount } = useHiveAccount(user || "");
  const toast = useToast();

  const hiveBalance = hiveAccount?.balance ? extractNumber(hiveAccount.balance.toString()) : 0;
  const hbdBalance = hiveAccount?.hbd_balance ? extractNumber(hiveAccount.hbd_balance.toString()) : 0;

  const magiClient = useMemo(() => (aioha ? getMagiClient(aioha) : null), [aioha]);
  const notify = (title: string, status: "error" | "success" | "info" = "error") =>
    toast({ title, status, duration: 4000, isClosable: true });

  const [mDir, setMDir] = useState<"sell" | "buy">("sell");
  const [mIn, setMIn] = useState<MagiAssetIn>("HBD");
  const [mAmount, setMAmount] = useState("");
  const [mAddr, setMAddr] = useState("");
  const [mPreview, setMPreview] = useState<MagiPreview | null>(null);
  const [mQuoting, setMQuoting] = useState(false);
  const [mBusy, setMBusy] = useState(false);
  const [mErr, setMErr] = useState<string | null>(null);

  const mAddrOk = isValidBtcAddress(mAddr);

  // Pre-fill the recipient with the user's saved BTC address once (while empty).
  const registeredBtc = useMemo(() => {
    const raw = hiveAccount?.json_metadata;
    if (!raw) return "";
    try {
      return migrateLegacyMetadata(JSON.parse(raw))?.extensions?.wallets?.btc_address || "";
    } catch {
      return "";
    }
  }, [hiveAccount?.json_metadata]);
  const prefilledAddrRef = useRef(false);
  useEffect(() => {
    if (!prefilledAddrRef.current && registeredBtc && !mAddr) {
      setMAddr(registeredBtc);
      prefilledAddrRef.current = true;
    }
  }, [registeredBtc, mAddr]);

  const quoteMagi = useCallback(async () => {
    setMPreview(null);
    setMErr(null);
    if (!magiClient || !user || !(Number(mAmount) > 0) || !mAddrOk) return;
    setMQuoting(true);
    try {
      const p = await getMagiPreview(magiClient, {
        username: user,
        assetIn: mIn,
        assetOut: "BTC",
        amountIn: mAmount,
        recipient: mAddr,
        slippagePct: 0.5,
      });
      setMPreview(p);
    } catch (e) {
      setMErr(e instanceof Error ? e.message : "No quote");
    } finally {
      setMQuoting(false);
    }
  }, [magiClient, user, mAmount, mAddr, mAddrOk, mIn]);

  useEffect(() => {
    const id = setTimeout(quoteMagi, 600);
    return () => clearTimeout(id);
  }, [quoteMagi]);

  const doMagiSwap = async () => {
    // A blocked quote (insufficient balance / RC / unsafe sim) still shows the
    // BTC output but must never broadcast — the deposit would strand.
    if (!user || !aioha || !mPreview || mPreview.blockReason) return;
    if (!mAddrOk) return notify("Enter a valid Bitcoin address");
    setMBusy(true);
    try {
      const res = await aioha.signAndBroadcastTx(
        mPreview.ops as Parameters<typeof aioha.signAndBroadcastTx>[0],
        KeyTypes.Active
      );
      if ((res as { success?: boolean })?.success === false) {
        throw new Error((res as { error?: string })?.error || "Rejected");
      }
      const txId = String((res as { result?: unknown })?.result ?? "");
      notify(
        `Magi swap submitted${txId ? ` (tx ${txId.slice(0, 8)}…)` : ""} — BTC settles shortly`,
        "success"
      );
      setMAmount("");
      setMPreview(null);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Magi swap failed");
    } finally {
      setMBusy(false);
    }
  };

  const fieldSx = { bg: "background", color: "primary", borderColor: "primary", fontFamily: "mono" } as const;
  const eyebrow = { fontSize: "10px", fontFamily: "mono", color: "primary", opacity: 0.7, letterSpacing: "wider", textTransform: "uppercase" } as const;

  if (!user) {
    return (
      <Text fontFamily="mono" fontSize="sm" color="primary" opacity={0.7} py={4} textAlign="center">
        Connect your Hive account to bridge HIVE/HBD to real BTC via Magi.
      </Text>
    );
  }

  return (
    <VStack align="stretch" spacing={2}>
      {/* Direction: sell (HIVE/HBD → BTC) or buy (BTC → HIVE/HBD). */}
      <HStack>
        {(
          [
            ["sell", "→ BTC"],
            ["buy", "BTC →"],
          ] as const
        ).map(([d, label]) => (
          <Button
            key={d}
            flex={1}
            size="sm"
            borderRadius="none"
            fontFamily="mono"
            fontWeight="bold"
            bg={mDir === d ? "primary" : "transparent"}
            color={mDir === d ? "background" : "primary"}
            borderWidth="1px"
            borderColor="primary"
            onClick={() => setMDir(d)}
          >
            {label}
          </Button>
        ))}
      </HStack>

      {mDir === "buy" ? (
        magiClient ? (
          <BtcToHiveDeposit username={user} client={magiClient} />
        ) : null
      ) : (
        <>
      <Text {...eyebrow}>Bridge to real BTC via Magi (routes through HBD)</Text>
      <HStack>
        {(["HBD", "HIVE"] as const).map((a) => (
          <Button
            key={a}
            flex={1}
            size="sm"
            borderRadius="none"
            fontFamily="mono"
            bg={mIn === a ? "primary" : "transparent"}
            color={mIn === a ? "background" : "primary"}
            borderWidth="1px"
            borderColor="primary"
            onClick={() => setMIn(a)}
          >
            {a} → BTC
          </Button>
        ))}
      </HStack>
      <Text {...eyebrow}>Amount · bal {(mIn === "HIVE" ? hiveBalance : hbdBalance).toFixed(3)}</Text>
      <Input
        placeholder="0.0"
        value={mAmount}
        onChange={(e) => setMAmount(clampDecimalString(e.target.value, magiInputDecimals(mIn)))}
        type="number"
        sx={fieldSx}
      />
      <Text {...eyebrow}>Your Bitcoin address</Text>
      <Input
        placeholder="bc1… / 1… / 3…"
        value={mAddr}
        onChange={(e) => setMAddr(e.target.value)}
        sx={{ ...fieldSx, borderColor: mAddr && !mAddrOk ? "red.400" : "primary" }}
      />
      {mAddr && !mAddrOk && (
        <Text fontSize="10px" color="red.400" fontFamily="mono">Not a valid Bitcoin address (not an xpub/zpub).</Text>
      )}
      {registeredBtc && mAddr === registeredBtc && mAddrOk && (
        <Text fontSize="10px" fontFamily="mono" color="primary" opacity={0.6}>
          Using your saved Bitcoin address — edit above to send elsewhere.
        </Text>
      )}
      <HStack justify="space-between" minH="18px">
        <Text fontSize="xs" fontFamily="mono" color="primary" opacity={0.7}>
          {mQuoting ? "quoting…" : mPreview ? `≈ ${mPreview.expectedOut} BTC` : mErr || ""}
        </Text>
        {mPreview && <Text fontSize="xs" fontFamily="mono" color="primary" opacity={0.6}>min {mPreview.minOut}</Text>}
      </HStack>
      {mPreview?.blockReason && (
        <Text fontSize="10px" fontFamily="mono" color="red.400">
          {mPreview.blockDetail || mPreview.blockReason}
        </Text>
      )}
      {mPreview?.blockReason === "Not enough Resource Credits" && magiClient && user && (
        <EnableMagiRcButton
          username={user}
          client={magiClient}
          swapHbd={mIn === "HBD" ? Number(mAmount) || 2 : 2}
          onEnabled={quoteMagi}
        />
      )}
      <Text fontSize="10px" fontFamily="mono" color="primary" opacity={0.6}>
        One signature, two steps: ① bridges your HBD into VSC, ② swaps it to real BTC — Magi settles it to your address. Needs liquid HBD + RC. Mainnet — start small.
      </Text>
      <Button
        bg="primary"
        color="background"
        fontFamily="mono"
        borderRadius="none"
        isDisabled={!mPreview || mBusy || !mAddrOk || !!mPreview?.blockReason}
        isLoading={mBusy}
        onClick={doMagiSwap}
      >
        {mBusy ? <Spinner size="sm" /> : mPreview?.blockReason ? mPreview.blockReason : "Swap to BTC"}
      </Button>
        </>
      )}
    </VStack>
  );
}
