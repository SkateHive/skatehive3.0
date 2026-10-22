"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "@/contexts/LocaleContext";
import { fetchHbdSavingsEvents } from "@/lib/hive/savingsHistory";
import { buildSavingsSeries, type SavingsEvent } from "@/lib/wallet/yieldSeries";
import YieldChartCard from "./YieldChartCard";

interface SavingsYieldChartProps {
  username: string;
  /** current on-chain savings_hbd_balance */
  savingsBalance: number;
  /** interest accrued since the last payment (lib/hive/savingsInterest.ts) */
  accruedInterest: number;
  /** live HBD savings rate */
  apr: number;
}

/** SkateBank earnings card: HBD savings deposits + interest, from chain history. */
export default function SavingsYieldChart({ username, savingsBalance, accruedInterest, apr }: SavingsYieldChartProps) {
  const t = useTranslations();
  const [events, setEvents] = useState<SavingsEvent[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Never pair the previous account's history with this account's balance.
    setEvents(null);
    setFailed(false);
    fetchHbdSavingsEvents(username).then((ev) => {
      if (cancelled) return;
      setEvents(ev ?? []);
      setFailed(ev == null);
    });
    return () => {
      cancelled = true;
    };
  }, [username]);

  const points = useMemo(
    () => (events == null ? null : buildSavingsSeries(events, savingsBalance, accruedInterest, apr, Math.floor(Date.now() / 1000))),
    [events, savingsBalance, accruedInterest, apr],
  );

  // Nothing ever saved → no card (the HBD savings section already has the CTA).
  if (events != null && events.length === 0 && savingsBalance <= 0 && !failed) return null;

  return (
    <YieldChartCard
      title={t("wallet.yield.hbdTitle")}
      subtitle="Hive"
      currency="HBD"
      rate={apr}
      rateLabel="APR"
      points={points}
      error={failed}
      owner={`@${username}`}
      fileName="skatehive-hbd-savings"
    />
  );
}
