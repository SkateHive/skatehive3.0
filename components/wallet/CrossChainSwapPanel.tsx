"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, HStack, Input, Spinner, Text, VStack, useToast } from "@chakra-ui/react";
import { FaBitcoin, FaLayerGroup } from "react-icons/fa";
import { useAioha } from "@aioha/react-ui";
import { KeyTypes } from "@aioha/aioha";
import useHiveAccount from "@/hooks/useHiveAccount";
import { extractNumber } from "@/lib/utils/extractNumber";
import { migrateLegacyMetadata } from "@/lib/utils/metadataMigration";
import {
  buildHeSwapOp,
  getHeBalances,
  getHiveEngineQuote,
  HE_ASSETS,
  type HeQuote,
} from "@/lib/hive/hiveEngine";
import {
  getMagiClient,
  getMagiPreview,
  isValidBtcAddress,
  clampDecimalString,
  magiInputDecimals,
  type MagiAssetIn,
  type MagiPreview,
} from "@/lib/hive/magi";

type SubMode = "l2" | "btc";
// SWAP.BTC dropped from the L2 tab: its diesel pool is thin (~0.5 wrapped BTC)
// and only yields SWAP.BTC (a Hive-Engine token, not real BTC — needs a gateway
// withdrawal). The "→ Bitcoin (Magi)" tab routes to real BTC instead.
const L2_SYMBOLS = HE_ASSETS.map((a) => a.symbol).filter((s) => s !== "SWAP.BTC");

/**
 * Hive-Engine (L2 diesel-pool) swaps + Magi cross-chain HIVE/HBD → BTC, signed
 * with Aioha. Both are Hive ops (custom_json / transfer) so Keychain, KeepKey,
 * and other Aioha providers all work.
 */
export default function CrossChainSwapPanel() {
  const { user, aioha } = useAioha();
  const { hiveAccount } = useHiveAccount(user || "");
  const toast = useToast();

  const [subMode, setSubMode] = useState<SubMode>("l2");

  // Balances -----------------------------------------------------------------
  const hiveBalance = hiveAccount?.balance ? extractNumber(hiveAccount.balance.toString()) : 0;
  const hbdBalance = hiveAccount?.hbd_balance ? extractNumber(hiveAccount.hbd_balance.toString()) : 0;
  const [heBalances, setHeBalances] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getHeBalances(user)
      .then((rows) => {
        if (cancelled) return;
        const map: Record<string, number> = {};
        for (const r of rows) map[r.symbol] = Number(r.balance) || 0;
        setHeBalances(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  const magiClient = useMemo(() => (aioha ? getMagiClient(aioha) : null), [aioha]);

  const notify = (title: string, status: "error" | "success" | "info" = "error") =>
    toast({ title, status, duration: 4000, isClosable: true });

  // ---- Hive-Engine (L2) ----------------------------------------------------
  const [l2Sell, setL2Sell] = useState("SWAP.HBD");
  const [l2Buy, setL2Buy] = useState("SWAP.HIVE");
  const [l2Amount, setL2Amount] = useState("");
  const [l2Quote, setL2Quote] = useState<HeQuote | null>(null);
  const [l2Quoting, setL2Quoting] = useState(false);
  const [l2Busy, setL2Busy] = useState(false);
  const [l2Err, setL2Err] = useState<string | null>(null);

  useEffect(() => {
    setL2Quote(null);
    setL2Err(null);
    const amt = Number(l2Amount);
    if (!(amt > 0) || l2Sell === l2Buy) return;
    const id = setTimeout(async () => {
      setL2Quoting(true);
      try {
        const q = await getHiveEngineQuote({ sellSymbol: l2Sell, buySymbol: l2Buy, amountIn: l2Amount, slippagePct: 0.5 });
        setL2Quote(q);
      } catch (e) {
        setL2Err(e instanceof Error ? e.message : "No route");
      } finally {
        setL2Quoting(false);
      }
    }, 500);
    return () => clearTimeout(id);
  }, [l2Amount, l2Sell, l2Buy]);

  const doL2Swap = async () => {
    if (!user || !aioha || !l2Quote) return;
    if (Number(l2Amount) > (heBalances[l2Sell] ?? 0)) return notify(`Insufficient ${l2Sell}`);
    setL2Busy(true);
    try {
      const ops = l2Quote.execPlan.map((h) => buildHeSwapOp(user, h));
      const res = await aioha.signAndBroadcastTx(ops, KeyTypes.Active);
      if ((res as { success?: boolean })?.success === false) throw new Error((res as { error?: string })?.error || "Rejected");
      notify(`Swapped ${l2Amount} ${l2Sell} → ${l2Buy}`, "success");
      setL2Amount("");
      setL2Quote(null);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Swap failed");
    } finally {
      setL2Busy(false);
    }
  };

  // ---- Magi cross-chain (→ BTC) --------------------------------------------
  const [mIn, setMIn] = useState<MagiAssetIn>("HBD");
  const [mAmount, setMAmount] = useState("");
  const [mAddr, setMAddr] = useState("");
  const [mPreview, setMPreview] = useState<MagiPreview | null>(null);
  const [mQuoting, setMQuoting] = useState(false);
  const [mBusy, setMBusy] = useState(false);
  const [mErr, setMErr] = useState<string | null>(null);

  const mAddrOk = isValidBtcAddress(mAddr);

  // The user's saved Bitcoin address (Hive extensions.wallets.btc_address).
  // Pre-fill the recipient with it once, while the field is still empty — they
  // can still overwrite it. Saves re-typing a BTC address on every swap.
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
      const p = await getMagiPreview(magiClient, { username: user, assetIn: mIn, assetOut: "BTC", amountIn: mAmount, recipient: mAddr, slippagePct: 0.5 });
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
      // Broadcast the pre-built [deposit, swap] ops ourselves (NOT client.quickSwap,
      // whose internal pre-deposit sim always false-negatives). Same Aioha path as L2.
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

  // ---- shared UI helpers ----------------------------------------------------
  const fieldSx = { bg: "background", color: "primary", borderColor: "primary", fontFamily: "mono" } as const;
  const eyebrow = { fontSize: "10px", fontFamily: "mono", color: "primary", opacity: 0.7, letterSpacing: "wider", textTransform: "uppercase" } as const;

  if (!user) {
    return (
      <Text fontFamily="mono" fontSize="sm" color="primary" opacity={0.7} py={4} textAlign="center">
        Connect your Hive account to swap on Hive-Engine or bridge to BTC via Magi.
      </Text>
    );
  }

  return (
    <VStack align="stretch" spacing={3}>
      {/* sub-mode toggle */}
      <HStack spacing={0} border="1px solid" borderColor="primary">
        {([["l2", "Hive-Engine", <FaLayerGroup key="l" />], ["btc", "→ Bitcoin", <FaBitcoin key="b" />]] as const).map(([key, label, icon]) => (
          <Button
            key={key}
            flex={1}
            size="sm"
            borderRadius="none"
            fontFamily="mono"
            fontSize="xs"
            textTransform="uppercase"
            leftIcon={icon}
            bg={subMode === key ? "primary" : "transparent"}
            color={subMode === key ? "background" : "primary"}
            opacity={subMode === key ? 1 : 0.6}
            _hover={{ opacity: 1 }}
            onClick={() => setSubMode(key as SubMode)}
          >
            {label}
          </Button>
        ))}
      </HStack>

      {subMode === "l2" ? (
        <VStack align="stretch" spacing={2}>
          <Text {...eyebrow}>Swap Hive-Engine tokens (diesel pools)</Text>
          <HStack>
            <VStack flex={1} align="stretch" spacing={1}>
              <Text {...eyebrow}>From · bal {(heBalances[l2Sell] ?? 0).toFixed(6)}</Text>
              <select value={l2Sell} onChange={(e) => setL2Sell(e.target.value)} style={{ background: "var(--chakra-colors-background)", color: "var(--chakra-colors-primary)", fontFamily: "monospace", padding: 6, border: "1px solid var(--chakra-colors-primary)" }}>
                {L2_SYMBOLS.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </VStack>
            <VStack flex={1} align="stretch" spacing={1}>
              <Text {...eyebrow}>To</Text>
              <select value={l2Buy} onChange={(e) => setL2Buy(e.target.value)} style={{ background: "var(--chakra-colors-background)", color: "var(--chakra-colors-primary)", fontFamily: "monospace", padding: 6, border: "1px solid var(--chakra-colors-primary)" }}>
                {L2_SYMBOLS.filter((s) => s !== l2Sell).map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </VStack>
          </HStack>
          <Input placeholder="0.0" value={l2Amount} onChange={(e) => setL2Amount(e.target.value)} type="number" sx={fieldSx} />
          <HStack justify="space-between" minH="18px">
            <Text fontSize="xs" fontFamily="mono" color="primary" opacity={0.7}>
              {l2Quoting ? "quoting…" : l2Quote ? `≈ ${l2Quote.expectedOut.toFixed(8)} ${l2Buy}${l2Quote.hops > 1 ? ` · ${l2Quote.hops}-hop` : ""}` : l2Err || ""}
            </Text>
            {l2Quote && <Text fontSize="xs" fontFamily="mono" color="primary" opacity={0.6}>min {l2Quote.minOut.toFixed(8)}</Text>}
          </HStack>
          <Button bg="primary" color="background" fontFamily="mono" borderRadius="none" isDisabled={!l2Quote || l2Busy} isLoading={l2Busy} onClick={doL2Swap}>
            Swap
          </Button>
        </VStack>
      ) : (
        <VStack align="stretch" spacing={2}>
          <Text {...eyebrow}>Bridge to real BTC via Magi (routes through HBD)</Text>
          <HStack>
            {(["HBD", "HIVE"] as const).map((a) => (
              <Button key={a} flex={1} size="sm" borderRadius="none" fontFamily="mono" bg={mIn === a ? "primary" : "transparent"} color={mIn === a ? "background" : "primary"} borderWidth="1px" borderColor="primary" onClick={() => setMIn(a)}>
                {a} → BTC
              </Button>
            ))}
          </HStack>
          <Text {...eyebrow}>Amount · bal {(mIn === "HIVE" ? hiveBalance : hbdBalance).toFixed(3)}</Text>
          <Input placeholder="0.0" value={mAmount} onChange={(e) => setMAmount(clampDecimalString(e.target.value, magiInputDecimals(mIn)))} type="number" sx={fieldSx} />
          <Text {...eyebrow}>Your Bitcoin address</Text>
          <Input placeholder="bc1… / 1… / 3…" value={mAddr} onChange={(e) => setMAddr(e.target.value)} sx={{ ...fieldSx, borderColor: mAddr && !mAddrOk ? "red.400" : "primary" }} />
          {mAddr && !mAddrOk && <Text fontSize="10px" color="red.400" fontFamily="mono">Not a valid Bitcoin address (not an xpub/zpub).</Text>}
          {registeredBtc && mAddr === registeredBtc && mAddrOk && (
            <Text fontSize="10px" fontFamily="mono" color="primary" opacity={0.6}>Using your saved Bitcoin address — edit above to send elsewhere.</Text>
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
          <Text fontSize="10px" fontFamily="mono" color="primary" opacity={0.6}>Mainnet · signs two Hive ops. Magi settles BTC to your address after its confirmations. (SDK v0.0.3 — start small.)</Text>
          <Button bg="primary" color="background" fontFamily="mono" borderRadius="none" isDisabled={!mPreview || mBusy || !mAddrOk || !!mPreview?.blockReason} isLoading={mBusy} onClick={doMagiSwap}>
            {mBusy ? <Spinner size="sm" /> : mPreview?.blockReason ? mPreview.blockReason : "Swap to BTC"}
          </Button>
        </VStack>
      )}
    </VStack>
  );
}
