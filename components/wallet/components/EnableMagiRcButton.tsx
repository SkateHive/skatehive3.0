"use client";

/**
 * "Enable Magi RC" — the in-app remedy for the one requirement that had no
 * self-serve path: the VSC Resource Credits the Magi HBD→BTC swap consumes.
 *
 * RC is NOT from Hive Power. It comes from HBD parked in the VSC network:
 *   max_rcs = 10_000 (base) + HBD_in_VSC × 1_000     (HIVE does not count)
 * Every account has the 10k base (== the gate), so this is only needed when the
 * account's current RC is depleted (recharging) or to get headroom for a bigger
 * swap. The deposit is a single Hive transfer to vsc.gateway and is REFUNDABLE —
 * it stays the user's own VSC balance.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, Spinner, Text, VStack } from "@chakra-ui/react";
import { useAioha } from "@aioha/react-ui";
import { KeyTypes } from "@aioha/aioha";
import { FaBolt } from "react-icons/fa";
import {
  buildVscTopUpOp,
  getMagiRcStatus,
  suggestRcTopUpHbd,
  MAGI_MIN_RC,
  RC_BASE,
  type MagiClient,
} from "@/lib/hive/magi";

interface EnableMagiRcButtonProps {
  username: string;
  client: MagiClient;
  /** Intended swap size (e.g. the reward HBD) — sizes the deposit headroom. */
  swapHbd: number;
  /** Current RC from the parent's probe, for sizing + display. */
  rcStatus?: { amount: bigint; max: bigint } | null;
  /** Called once RC has risen so the parent re-checks eligibility. */
  onEnabled?: () => void;
}

type Phase = "idle" | "depositing" | "confirming" | "recharging" | "error";

export default function EnableMagiRcButton({
  username,
  client,
  swapHbd,
  rcStatus,
  onEnabled,
}: EnableMagiRcButtonProps) {
  const { aioha } = useAioha();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  // Self-fetch the RC ceiling (seeded by the prop) so the deposit is sized off
  // the real `max` even when the parent only has `amount` — otherwise an account
  // with HBD already parked would be told to over-deposit.
  const [status, setStatus] = useState<{ amount: bigint; max: bigint } | null>(rcStatus ?? null);

  useEffect(() => {
    let cancelled = false;
    getMagiRcStatus(client, username)
      .then((s) => !cancelled && setStatus(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client, username]);

  // How much HBD to park so the ceiling covers this swap with margin. Always
  // offer at least 1 HBD (a depleted account at the base ceiling still benefits).
  const depositHbd = useMemo(() => {
    const currentMax = status?.max ?? BigInt(RC_BASE);
    return Math.max(1, suggestRcTopUpHbd(currentMax, swapHbd));
  }, [status?.max, swapHbd]);

  const run = useCallback(async () => {
    if (!aioha) return;
    setError(null);

    // Guard: enough LIQUID HBD to fund the deposit (savings/staked don't count).
    try {
      const liq = await client.getBalance(username, "HBD");
      const needRaw = BigInt(Math.round(depositHbd * 1000));
      if (liq !== null && liq < needRaw) {
        setError(
          `Need ${depositHbd} liquid HBD to enable — you can lower your swap amount, or get more liquid HBD first.`
        );
        setPhase("error");
        return;
      }
    } catch {
      /* balance probe is best-effort; let the broadcast surface a real failure */
    }

    // Broadcast the single transfer → vsc.gateway (memo to=<user>), Active key.
    setPhase("depositing");
    try {
      const op = buildVscTopUpOp(username, String(depositHbd));
      const res = await aioha.signAndBroadcastTx(
        [op] as Parameters<typeof aioha.signAndBroadcastTx>[0],
        KeyTypes.Active
      );
      if ((res as { success?: boolean })?.success === false) {
        throw new Error((res as { error?: string })?.error || "Deposit was rejected.");
      }
    } catch (e: any) {
      setError(e?.message || "Couldn't deposit to Magi.");
      setPhase("error");
      return;
    }

    // Poll until the ceiling reflects the deposit, then decide enabled vs still
    // recharging (a deposit raises `max` immediately; `amount` regenerates).
    setPhase("confirming");
    const startMax = status?.max ?? BigInt(RC_BASE);
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      try {
        const rc = await getMagiRcStatus(client, username);
        if (rc.max > startMax || rc.amount >= MAGI_MIN_RC) {
          setStatus(rc);
          if (rc.amount >= MAGI_MIN_RC) {
            onEnabled?.();
            setPhase("idle");
          } else {
            setPhase("recharging"); // ceiling up, RC still charging toward it
          }
          return;
        }
      } catch {
        /* keep polling */
      }
    }
    // Deposit went through but the indexer hasn't reflected it yet.
    setPhase("recharging");
  }, [aioha, client, username, depositHbd, status?.max, onEnabled]);

  if (phase === "recharging") {
    return (
      <Box border="1px solid" borderColor="border" p={3}>
        <Text fontFamily="mono" fontSize="xs" color="primary">
          ✅ Deposit received — your Magi RC is charging up.
        </Text>
        <Text fontFamily="mono" fontSize="2xs" color="dim" mt={1}>
          Give it a few minutes to recharge, then convert. Your HBD is safe in
          Magi (refundable) and now powers your swaps.
        </Text>
      </Box>
    );
  }

  const busy = phase === "depositing" || phase === "confirming";

  return (
    <VStack align="stretch" spacing={1}>
      <Button
        leftIcon={busy ? <Spinner size="xs" /> : <FaBolt />}
        variant="outline"
        borderColor="primary"
        color="primary"
        borderRadius="none"
        fontFamily="mono"
        size="sm"
        textTransform="uppercase"
        _hover={{ bg: "primary", color: "background" }}
        isDisabled={busy}
        onClick={run}
      >
        {phase === "depositing"
          ? "Approve deposit…"
          : phase === "confirming"
          ? "Confirming…"
          : `Enable Magi RC · deposit ${depositHbd} HBD`}
      </Button>
      {phase === "error" ? (
        <Text fontFamily="mono" fontSize="2xs" color="red.400">
          {error}
        </Text>
      ) : (
        <Text fontFamily="mono" fontSize="2xs" color="dim">
          Parks {depositHbd} HBD in Magi to power your swaps — refundable, it
          stays your balance.
        </Text>
      )}
    </VStack>
  );
}
