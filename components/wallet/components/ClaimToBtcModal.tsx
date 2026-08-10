"use client";

/**
 * Claim → BTC pipeline (Phase 1, manual). For SkateHive's top users: claim your
 * Hive author rewards and convert the liquid HBD portion to real BTC via Magi,
 * settled to your saved Bitcoin address.
 *
 * It's two Hive transactions (can't be atomic):
 *   1. claim_reward_balance  → reward HBD becomes liquid
 *   2. Magi [deposit, swap]  → BTC settles to the recipient
 * If step 2 fails after step 1, the HBD is safely liquid in the wallet and the
 * user can retry from the Swap tab — we say so explicitly.
 *
 * Gated on the "best users" criteria: saved BTC address, high HP (curation
 * threshold), enough RC for the swap, and a non-dust reward. Missing items are
 * shown as a guided checklist instead of a dead end.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useAioha } from "@aioha/react-ui";
import { KeyTypes } from "@aioha/aioha";
import { FaBitcoin, FaCheck, FaTimes } from "react-icons/fa";
import {
  getMagiClient,
  getMagiPreview,
  isValidBtcAddress,
  MAGI_MIN_RC,
  type MagiPreview,
} from "@/lib/hive/magi";

/** HP curation threshold — only high-stake "best users" can route to BTC. */
export const MIN_HP_FOR_BTC = 500;
/** Don't offer a conversion for dust (fixed ~8.2k RC cost isn't worth it). */
const MIN_HBD_TO_CONVERT = 0.5;

type Step = "checks" | "claiming" | "converting" | "done" | "error";

interface ClaimToBtcModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  /** Claimable reward HBD (the liquid portion we convert). */
  rewardHbd: number;
  btcAddress?: string;
  hivePower: number;
  /** Called after a successful claim so the parent can refresh balances. */
  onClaimed?: () => void;
}

export default function ClaimToBtcModal({
  isOpen,
  onClose,
  username,
  rewardHbd,
  btcAddress,
  hivePower,
  onClaimed,
}: ClaimToBtcModalProps) {
  const toast = useToast();
  const router = useRouter();
  const { aioha } = useAioha();
  const client = useMemo(() => (aioha ? getMagiClient(aioha) : null), [aioha]);

  const [step, setStep] = useState<Step>("checks");
  const [rcAvailable, setRcAvailable] = useState<bigint | null>(null);
  const [estBtc, setEstBtc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimedButNotConverted, setClaimedButNotConverted] = useState(false);

  const addrOk = isValidBtcAddress(btcAddress || "");
  const hpOk = hivePower >= MIN_HP_FOR_BTC;
  const amountOk = rewardHbd >= MIN_HBD_TO_CONVERT;
  const rcOk = rcAvailable !== null && rcAvailable >= MAGI_MIN_RC;
  const allOk = addrOk && hpOk && amountOk && rcOk;

  // On open: fetch RC + a BTC estimate (read-only). The estimate ignores the
  // pre-claim balance block — we're about to claim that HBD.
  useEffect(() => {
    if (!isOpen) {
      setStep("checks");
      setError(null);
      setEstBtc(null);
      setRcAvailable(null);
      setClaimedButNotConverted(false);
      return;
    }
    if (!client || !username) return;
    // Need a valid address + non-dust amount to build a preview (which yields
    // both the BTC estimate and the real Hive RC). Without an address the CTA
    // is "add address" anyway, so RC stays unknown until then.
    if (!addrOk || !amountOk) {
      setRcAvailable(null);
      setEstBtc(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const p = await getMagiPreview(client, {
          username,
          assetIn: "HBD",
          assetOut: "BTC",
          amountIn: String(rewardHbd),
          recipient: btcAddress as string,
          slippagePct: 0.5,
        });
        if (!cancelled) {
          setEstBtc(p.expectedOut);
          setRcAvailable(p.rcAvailable);
        }
      } catch {
        if (!cancelled) setRcAvailable(0n);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, client, username, rewardHbd, btcAddress, addrOk, amountOk]);

  const run = useCallback(async () => {
    if (!client || !aioha || !allOk || !btcAddress) return;
    setError(null);

    // Step 1 — claim rewards (reward HBD → liquid).
    setStep("claiming");
    try {
      const claim = await aioha.claimRewards();
      if ((claim as { success?: boolean })?.success === false) {
        throw new Error((claim as { error?: string })?.error || "Claim was rejected.");
      }
    } catch (e: any) {
      setError(e?.message || "Couldn't claim your rewards.");
      setStep("error");
      return;
    }
    onClaimed?.();

    // Wait for the liquid HBD to reflect the claim (block time ~3s).
    setStep("converting");
    const needRaw = (() => {
      try {
        // 3-dp HBD → smallest units
        return BigInt(Math.round(rewardHbd * 1000));
      } catch {
        return 0n;
      }
    })();
    let settled = false;
    for (let i = 0; i < 8; i++) {
      try {
        const liq = await client.getBalance(username, "HBD");
        if (liq !== null && liq >= needRaw) {
          settled = true;
          break;
        }
      } catch {
        /* keep polling */
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    setClaimedButNotConverted(true); // from here, HBD is claimed; a failure is recoverable

    // Step 2 — build the Magi swap for the claimed HBD and gate it.
    let preview: MagiPreview;
    try {
      preview = await getMagiPreview(client, {
        username,
        assetIn: "HBD",
        assetOut: "BTC",
        amountIn: String(rewardHbd),
        recipient: btcAddress,
        slippagePct: 0.5,
      });
    } catch (e: any) {
      setError(e?.message || "Couldn't quote the BTC conversion.");
      setStep("error");
      return;
    }
    if (preview.blockReason) {
      setError(
        settled
          ? preview.blockDetail || preview.blockReason
          : "Your claim is still settling on Hive — wait a moment, then convert from the Swap tab."
      );
      setStep("error");
      return;
    }

    // Step 2b — broadcast the [deposit, swap] ops.
    try {
      const res = await aioha.signAndBroadcastTx(
        preview.ops as Parameters<typeof aioha.signAndBroadcastTx>[0],
        KeyTypes.Active
      );
      if ((res as { success?: boolean })?.success === false) {
        throw new Error((res as { error?: string })?.error || "Conversion was rejected.");
      }
    } catch (e: any) {
      setError(e?.message || "The BTC conversion failed.");
      setStep("error");
      return;
    }

    setStep("done");
    toast({
      title: "Converting to BTC ₿",
      description: `≈ ${preview.expectedOut} BTC on its way to your address.`,
      status: "success",
      duration: 8000,
      isClosable: true,
    });
  }, [client, aioha, allOk, btcAddress, username, rewardHbd, onClaimed, toast]);

  const CheckRow = ({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) => (
    <HStack align="start" spacing={2}>
      <Box color={ok ? "primary" : "red.400"} mt="2px">
        {ok ? <FaCheck size={12} /> : <FaTimes size={12} />}
      </Box>
      <Box>
        <Text fontFamily="mono" fontSize="sm" color={ok ? "primary" : "text"}>
          {label}
        </Text>
        {!ok && hint && (
          <Text fontFamily="mono" fontSize="2xs" color="dim">
            {hint}
          </Text>
        )}
      </Box>
    </HStack>
  );

  const busy = step === "claiming" || step === "converting";

  return (
    <Modal isOpen={isOpen} onClose={busy ? () => {} : onClose} size="sm" isCentered>
      <ModalOverlay />
      <ModalContent bg="background" borderRadius="none" border="2px solid" borderColor="primary">
        <ModalHeader
          fontFamily="mono"
          fontWeight="black"
          textTransform="uppercase"
          letterSpacing="widest"
          fontSize="sm"
          color="primary"
          borderBottom="1px solid"
          borderColor="border"
        >
          <HStack spacing={2}>
            <FaBitcoin />
            <Text>Claim to Bitcoin</Text>
          </HStack>
        </ModalHeader>
        {!busy && <ModalCloseButton />}
        <ModalBody py={5}>
          <VStack align="stretch" spacing={4}>
            {/* Amount + estimate */}
            <Box border="1px solid" borderColor="border" p={3}>
              <Text fontFamily="mono" fontSize="2xs" color="dim" textTransform="uppercase" letterSpacing="wider">
                Convert
              </Text>
              <HStack justify="space-between" mt={1}>
                <Text fontFamily="mono" fontSize="lg" color="primary" fontWeight="black">
                  {rewardHbd.toFixed(3)} HBD
                </Text>
                <Text fontFamily="mono" fontSize="sm" color="primary">
                  ≈ {estBtc ?? "…"} BTC
                </Text>
              </HStack>
              <Text fontFamily="mono" fontSize="2xs" color="dim" mt={1}>
                Only your liquid HBD converts — your HP stays as stake (your power on the network).
              </Text>
            </Box>

            {step === "checks" && (
              <>
                <VStack align="stretch" spacing={2}>
                  <CheckRow ok={addrOk} label="Bitcoin address saved" hint="Add your BTC address in profile settings." />
                  <CheckRow
                    ok={hpOk}
                    label={`≥ ${MIN_HP_FOR_BTC} HP`}
                    hint={`You have ${Math.floor(hivePower)} HP — power up HIVE to qualify.`}
                  />
                  <CheckRow
                    ok={rcOk}
                    label="Enough Resource Credits"
                    hint={
                      rcAvailable === null
                        ? "Checking…"
                        : `Need ~${Number(MAGI_MIN_RC) / 1000}k RC, you have ${(Number(rcAvailable) / 1000).toFixed(1)}k — wait to recharge or power up.`
                    }
                  />
                  <CheckRow ok={amountOk} label={`≥ ${MIN_HBD_TO_CONVERT} HBD reward`} hint="Reward too small to convert right now." />
                </VStack>

                {!addrOk ? (
                  <Button
                    bg="primary"
                    color="background"
                    fontFamily="mono"
                    borderRadius="none"
                    textTransform="uppercase"
                    onClick={() => router.push(`/user/${username}?edit=1`)}
                  >
                    Add Bitcoin address
                  </Button>
                ) : (
                  <Button
                    leftIcon={<FaBitcoin />}
                    bg="primary"
                    color="background"
                    fontFamily="mono"
                    borderRadius="none"
                    textTransform="uppercase"
                    isDisabled={!allOk}
                    onClick={run}
                  >
                    {allOk ? "Claim & convert to BTC" : "Not eligible yet"}
                  </Button>
                )}
                <Text fontFamily="mono" fontSize="2xs" color="dim" textAlign="center">
                  Two signatures: claim, then convert. Mainnet — real BTC settles to your address.
                </Text>
              </>
            )}

            {busy && (
              <VStack spacing={2} py={4}>
                <Text fontFamily="mono" fontSize="sm" color="primary" animation="pulse 1.5s infinite">
                  {step === "claiming" ? "① Claiming rewards…" : "② Converting to BTC…"}
                </Text>
                <Text fontFamily="mono" fontSize="2xs" color="dim">
                  Approve the signature in your wallet.
                </Text>
              </VStack>
            )}

            {step === "done" && (
              <VStack spacing={2} py={2}>
                <Text fontFamily="mono" color="primary" fontWeight="black">
                  ✅ On its way — ≈ {estBtc} BTC
                </Text>
                <Text fontFamily="mono" fontSize="2xs" color="dim" textAlign="center">
                  Magi settles BTC to your address after its confirmations.
                </Text>
                <Button variant="outline" borderRadius="none" fontFamily="mono" size="sm" onClick={onClose}>
                  Close
                </Button>
              </VStack>
            )}

            {step === "error" && (
              <VStack align="stretch" spacing={2}>
                <Text fontFamily="mono" fontSize="sm" color="red.400">
                  {error}
                </Text>
                {claimedButNotConverted && (
                  <Text fontFamily="mono" fontSize="2xs" color="dim">
                    Your rewards were claimed as HBD and are safe in your wallet — retry the conversion from the Swap tab.
                  </Text>
                )}
                <Button variant="outline" borderRadius="none" fontFamily="mono" size="sm" onClick={onClose}>
                  Close
                </Button>
              </VStack>
            )}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
