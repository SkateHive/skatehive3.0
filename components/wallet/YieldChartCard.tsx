"use client";

/**
 * Shareable earnings card: hero "earned so far", invested vs value over time,
 * and a 12-month projection at the current rate. Used by Earn (USDC/Morpho)
 * and SkateBank (HBD savings). Built to be screenshotted — the Share button
 * renders the card (minus its controls) to a PNG and hands it to the native
 * share sheet on mobile, or downloads it on desktop.
 */

import { useMemo, useRef, useState } from "react";
import { Box, Button, HStack, Image, Table, Tbody, Td, Text, Th, Thead, Tr, VStack, useToast } from "@chakra-ui/react";
import { FaEye, FaEyeSlash, FaShareAlt, FaTable, FaChartArea } from "react-icons/fa";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "@/app/themeProvider";
import { useLocale, useTranslations } from "@/contexts/LocaleContext";
import { downsample, project, summarizeYield, type YieldPoint } from "@/lib/wallet/yieldSeries";

interface YieldChartCardProps {
  title: string;
  subtitle: string;
  currency: string;
  /** annual rate as a fraction */
  rate: number | null;
  rateLabel: "APY" | "APR";
  /** null while loading */
  points: YieldPoint[] | null;
  error?: boolean;
  /** shown in the footer, e.g. "@skater" or "0x12…ab" */
  owner?: string;
  fileName: string;
}

interface ChartRow {
  t: number;
  value?: number;
  projected?: number;
  invested: number;
}

const HIDDEN = "•••";

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Legend/tooltip key: a short stroke, mirroring the line it names. */
function Key({ color, opacity = 1, label }: { color: string; opacity?: number; label: string }) {
  return (
    <HStack spacing={1.5}>
      <Box w="14px" h="2px" bg={color} opacity={opacity} borderRadius="full" />
      <Text fontSize="10px" color="dim" fontFamily="mono">{label}</Text>
    </HStack>
  );
}

interface TooltipBodyProps {
  active?: boolean;
  payload?: { payload: ChartRow }[];
  money: (n: number) => string;
  date: (t: number) => string;
  primary: string;
  dim: string;
  projectedLabel: string;
  investedLabel: string;
}

/** Value leads, label follows; every series at the hovered X. */
function TooltipBody({ active, payload, money, date, primary, dim, projectedLabel, investedLabel }: TooltipBodyProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const isProj = row.value == null;
  const v = row.value ?? row.projected ?? 0;
  return (
    <Box bg="background" border="1px solid" borderColor="border" px={2} py={1.5} fontFamily="mono">
      <Text fontSize="10px" color="dim">{date(row.t)}{isProj ? ` · ${projectedLabel}` : ""}</Text>
      <HStack spacing={2}>
        <Box w="10px" h="2px" bg={primary} opacity={isProj ? 0.45 : 1} />
        <Text fontSize="sm" fontWeight="bold" color="text">{money(v)}</Text>
      </HStack>
      <HStack spacing={2}>
        <Box w="10px" h="2px" bg={dim} />
        <Text fontSize="xs" color="text">{money(row.invested)}</Text>
        <Text fontSize="10px" color="dim">{investedLabel}</Text>
      </HStack>
    </Box>
  );
}

export default function YieldChartCard({ title, subtitle, currency, rate, rateLabel, points, error, owner, fileName }: YieldChartCardProps) {
  const t = useTranslations();
  const { locale } = useLocale();
  const { theme } = useTheme();
  const toast = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const [hideAmounts, setHideAmounts] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [sharing, setSharing] = useState(false);

  const c = theme.colors as Record<string, string>;
  const primary = c.primary;
  const dim = c.dim || c.text;
  const surface = c.background;

  const summary = useMemo(() => (points ? summarizeYield(points) : null), [points]);
  const projection = useMemo(() => (points && rate ? project(points, rate, 12) : []), [points, rate]);

  const rows = useMemo<ChartRow[]>(() => {
    if (!points?.length) return [];
    const real: ChartRow[] = downsample(points).map((p) => ({ t: p.t, value: p.value, invested: p.invested }));
    // The projection starts at the last real point so the two segments join.
    const last = real[real.length - 1];
    last.projected = last.value;
    return [...real, ...projection.map((p) => ({ t: p.t, projected: p.value, invested: p.invested }))];
  }, [points, projection]);

  const lastReal = rows.filter((r) => r.value != null).pop();
  // Enough decimals that adjacent ticks differ (0.103 → 0.113 needs 3+).
  const tickDigits = useMemo(() => {
    const vals = rows.flatMap((r) => [r.value, r.projected, r.invested].filter((v): v is number => v != null));
    if (!vals.length) return 2;
    const span = Math.max(...vals) - Math.min(...vals);
    if (span <= 0) return 2;
    return Math.min(6, Math.max(0, Math.ceil(-Math.log10(span / 4)) + 1));
  }, [rows]);
  const projectedEnd = projection[projection.length - 1];

  const decimals = summary && summary.value < 10 ? 4 : 2;
  const fmt = (n: number, d = decimals) => n.toLocaleString(locale, { minimumFractionDigits: Math.min(2, d), maximumFractionDigits: d });
  const money = (n: number, d = decimals) => (hideAmounts ? HIDDEN : `${fmt(n, d)} ${currency}`);
  const pct = (n: number) => `${(n * 100).toLocaleString(locale, { maximumFractionDigits: 2 })}%`;
  const shortDate = (s: number) => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(new Date(s * 1000));
  const longDate = (s: number) => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(s * 1000));

  const share = async () => {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: surface,
        filter: (node) => !(node instanceof HTMLElement && node.dataset.noexport === "true"),
      });
      if (!blob) throw new Error("empty image");
      const file = new File([blob], `${fileName}.png`, { type: "image/png" });
      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: t("wallet.yield.shareText") });
          return;
        } catch (e) {
          // Closing the sheet is a choice, not a failure.
          if ((e as Error)?.name === "AbortError") return;
          // Safari drops the tap's user activation while the image renders
          // (NotAllowedError) — fall through to a download instead of failing.
        }
      }
      downloadBlob(blob, file.name);
      toast({ title: t("wallet.yield.downloaded"), status: "success", duration: 2500 });
    } catch {
      toast({ title: t("wallet.yield.shareFailed"), status: "error", duration: 3000 });
    } finally {
      setSharing(false);
    }
  };

  const tableRows = useMemo(() => {
    const real = rows.filter((r) => r.value != null);
    const picked = downsample(real.map((r) => ({ t: r.t, invested: r.invested, value: r.value! })), 6);
    return projectedEnd ? [...picked, projectedEnd] : picked;
  }, [rows, projectedEnd]);

  return (
    <Box border="1px solid" borderColor="border" bg="background" data-testid="yield-chart-card">
      <Box ref={cardRef} p={4} bg="background">
        {/* Brand row — this is what makes a screenshot recognisable */}
        <HStack justify="space-between" mb={3}>
          <HStack spacing={2}>
            <Image src="/logos/skatehive-logo-rounded.png" alt="" w="22px" h="22px" />
            <Text fontFamily="mono" fontWeight="black" fontSize="sm" color="text" letterSpacing="widest">SKATEHIVE</Text>
          </HStack>
          {rate != null && (
            <Text fontFamily="mono" fontSize="xs" fontWeight="bold" color="background" bg="primary" px={2} py={0.5}>
              {pct(rate)} {rateLabel}
            </Text>
          )}
        </HStack>

        <Text fontFamily="mono" fontSize="xs" color="dim" textTransform="uppercase" letterSpacing="wider">
          {title} · {subtitle}
        </Text>

        {error ? (
          <Text fontFamily="mono" fontSize="sm" color="red.400" py={6}>{t("wallet.yield.loadError")}</Text>
        ) : points == null ? (
          <Text fontFamily="mono" fontSize="sm" color="dim" py={6}>…</Text>
        ) : !summary ? (
          <Text fontFamily="mono" fontSize="sm" color="dim" py={6}>{t("wallet.yield.empty")}</Text>
        ) : (
          <>
            {/* Hero */}
            <Text fontFamily="mono" fontSize="xs" color="dim" mt={3}>{t("wallet.yield.earnedSoFar")}</Text>
            <Text
              fontFamily="mono"
              fontWeight="black"
              color="primary"
              fontSize={{ base: "4xl", md: "5xl" }}
              lineHeight="1"
              textShadow={`0 0 18px ${primary}55`}
              wordBreak="break-all"
            >
              {hideAmounts ? `+${pct(summary.returnPct)}` : `+${fmt(summary.earned, summary.earned < 1 ? 6 : 2)}`}
              {!hideAmounts && (
                <Text as="span" fontSize="lg" ml={2} color="text">{currency}</Text>
              )}
            </Text>
            <Text fontFamily="mono" fontSize="xs" color="dim" mt={1}>
              {!hideAmounts && `${t("wallet.yield.onInvested").replace("{amount}", money(summary.invested, 2))} · `}
              {t("wallet.yield.since").replace("{date}", longDate(summary.since))}
            </Text>

            {/* Stat strip */}
            <HStack mt={4} spacing={0} border="1px solid" borderColor="border" align="stretch">
              {[
                { label: t("wallet.yield.valueNow"), value: money(summary.value) },
                { label: t("wallet.yield.in12Months"), value: projectedEnd ? money(projectedEnd.value) : "—" },
                { label: t("wallet.yield.return"), value: `+${pct(summary.returnPct)}` },
              ].map((s, i) => (
                <Box key={s.label} flex={1} p={2} borderLeft={i ? "1px solid" : "none"} borderColor="border" minW={0}>
                  <Text fontFamily="mono" fontSize="10px" color="dim" noOfLines={1}>{s.label}</Text>
                  <Text fontFamily="mono" fontSize={{ base: "xs", md: "sm" }} fontWeight="bold" color="text" wordBreak="break-word">{s.value}</Text>
                </Box>
              ))}
            </HStack>

            {/* Chart or table */}
            {showTable ? (
              <Table size="sm" mt={4} fontFamily="mono">
                <Thead>
                  <Tr>
                    <Th color="dim" px={1}>{t("wallet.yield.date")}</Th>
                    <Th color="dim" px={1} isNumeric>{t("wallet.yield.legendInvested")}</Th>
                    <Th color="dim" px={1} isNumeric>{t("wallet.yield.legendValue")}</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {tableRows.map((r) => (
                    <Tr key={r.t}>
                      <Td px={1} color="text" fontSize="xs">{shortDate(r.t)}{r.projected ? " *" : ""}</Td>
                      <Td px={1} color="text" fontSize="xs" isNumeric sx={{ fontVariantNumeric: "tabular-nums" }}>{money(r.invested)}</Td>
                      <Td px={1} color="text" fontSize="xs" isNumeric sx={{ fontVariantNumeric: "tabular-nums" }}>{money(r.value)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            ) : (
              <Box mt={4} h={{ base: "170px", md: "200px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke={dim} strokeOpacity={0.15} />
                    <XAxis
                      dataKey="t"
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      tickFormatter={shortDate}
                      tick={{ fill: dim, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={28}
                    />
                    <YAxis
                      hide={hideAmounts}
                      width={40}
                      tick={{ fill: dim, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      domain={["auto", "auto"]}
                      tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toLocaleString(locale, { maximumFractionDigits: tickDigits }))}
                    />
                    <Tooltip
                      content={<TooltipBody money={money} date={longDate} primary={primary} dim={dim} projectedLabel={t("wallet.yield.legendProjected")} investedLabel={t("wallet.yield.legendInvested")} />}
                      cursor={{ stroke: dim, strokeWidth: 1 }}
                    />
                    <Line dataKey="invested" type="stepAfter" stroke={dim} strokeWidth={2} dot={false} activeDot={false} isAnimationActive={false} />
                    <Area dataKey="projected" type="monotone" stroke={primary} strokeOpacity={0.45} strokeWidth={2} fill={primary} fillOpacity={0.04} dot={false} activeDot={false} connectNulls isAnimationActive={false} />
                    <Area
                      dataKey="value"
                      type="monotone"
                      stroke={primary}
                      strokeWidth={2}
                      strokeLinecap="round"
                      fill={primary}
                      fillOpacity={0.1}
                      dot={false}
                      activeDot={{ r: 4, fill: primary, stroke: surface, strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                    {lastReal?.value != null && (
                      <ReferenceDot x={lastReal.t} y={lastReal.value} r={4} fill={primary} stroke={surface} strokeWidth={2} />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
            )}

            {/* Legend (two+ series → always present) */}
            <HStack spacing={4} mt={2} flexWrap="wrap">
              <Key color={primary} label={t("wallet.yield.legendValue")} />
              <Key color={dim} label={t("wallet.yield.legendInvested")} />
              {projection.length > 0 && <Key color={primary} opacity={0.45} label={t("wallet.yield.legendProjected")} />}
            </HStack>
          </>
        )}

        {/* Footer — attribution for screenshots */}
        <HStack justify="space-between" mt={4} pt={2} borderTop="1px solid" borderColor="border">
          <Text fontFamily="mono" fontSize="10px" color="dim">{owner ?? ""}</Text>
          <Text fontFamily="mono" fontSize="10px" color="dim">skatehive.app</Text>
        </HStack>
      </Box>

      {/* Controls — excluded from the exported image */}
      {summary && !error && (
        <HStack spacing={0} borderTop="1px solid" borderColor="border" data-noexport="true">
          <Button flex={1} size="sm" h="auto" minH={8} py={2} whiteSpace="normal" fontSize={{ base: "xs", md: "sm" }} variant="ghost" borderRadius="none" fontFamily="mono" leftIcon={<FaShareAlt />} isLoading={sharing} onClick={share}>
            {t("wallet.yield.share")}
          </Button>
          <Button flex={1} size="sm" h="auto" minH={8} py={2} whiteSpace="normal" fontSize={{ base: "xs", md: "sm" }} variant="ghost" borderRadius="none" fontFamily="mono" borderLeft="1px solid" borderColor="border"
            leftIcon={hideAmounts ? <FaEye /> : <FaEyeSlash />} onClick={() => setHideAmounts((v) => !v)}>
            {hideAmounts ? t("wallet.yield.showAmounts") : t("wallet.yield.hideAmounts")}
          </Button>
          <Button flex={1} size="sm" h="auto" minH={8} py={2} whiteSpace="normal" fontSize={{ base: "xs", md: "sm" }} variant="ghost" borderRadius="none" fontFamily="mono" borderLeft="1px solid" borderColor="border"
            leftIcon={showTable ? <FaChartArea /> : <FaTable />} onClick={() => setShowTable((v) => !v)}>
            {showTable ? t("wallet.yield.chart") : t("wallet.yield.table")}
          </Button>
        </HStack>
      )}
    </Box>
  );
}

/** "0x1234…abcd" for wallets without a handle. */
export const shortAddress = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : undefined);
