"use client";

/**
 * Earn tab: USDC in a Morpho vault on Base and ETH staked with Lido.
 * Constants, ABIs and rate fetchers live in lib/evm/earn.ts.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Button, HStack, Input, InputGroup, InputRightElement, Link, Text, VStack, useToast,
} from "@chakra-ui/react";
import {
  useAccount, useBalance, useChainId, usePublicClient, useReadContract, useReadContracts, useSwitchChain, useWriteContract,
} from "wagmi";
import { formatUnits, parseEther, parseUnits } from "viem";
import { useTranslations } from "@/contexts/LocaleContext";
import { LIDO_ABI, LIDO_REFERRAL, LIDO_STETH } from "@/lib/evm/lido";
import { isChainBoundWallet, chainBoundSwitchMessage } from "@/lib/evm/walletChain";
import { friendlyError, isTransportError, isUserRejection } from "@/lib/evm/txErrors";
import {
  BASESCAN_TX, EARN_CHAIN_ID, ERC20_EARN_ABI, ERC4626_ABI, LIDO_URL, MORPHO_USDC_VAULT, USDC_BASE, USDC_DECIMALS,
  fetchLidoApr, fetchMorphoSharePrices, fetchMorphoVaultActivity, fetchMorphoVaultApy, type VaultActivity,
} from "@/lib/evm/earn";
import { buildVaultSeries } from "@/lib/wallet/yieldSeries";
import { YieldChartCard, shortAddress } from "./YieldChart";

const MAINNET_ID = 1;
/** Fallback ETH kept back on "max" when the fee can't be estimated. */
const ETH_GAS_RESERVE = parseEther("0.002");
/** Lido submit() uses ~80k gas; reserve for 100k at 1.5× the current max fee. */
const LIDO_GAS_LIMIT = 100_000n;
const AMOUNT_RE = /^\d*\.?\d*$/;

const fmtRate = (r: number | null) => (r == null ? "—" : `${(r * 100).toFixed(2)}%`);
const fmtNum = (v: bigint | undefined, decimals: number, digits = 4) =>
  v == null ? "—" : Number(formatUnits(v, decimals)).toLocaleString(undefined, { maximumFractionDigits: digits });

function safeParse(value: string, decimals: number): bigint | null {
  if (!value || !AMOUNT_RE.test(value)) return null;
  try {
    const n = parseUnits(value, decimals);
    return n > 0n ? n : null;
  } catch {
    return null;
  }
}

type EarnClient = NonNullable<ReturnType<typeof usePublicClient>>;

/** viem resolves the receipt of a reverted tx instead of throwing — make it throw. */
async function waitForSuccess(client: EarnClient, hash: `0x${string}`, revertedMessage: string) {
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(revertedMessage);
}

/** Run a pre-sign simulation; only a contract revert blocks, RPC hiccups don't. */
async function preflight(simulate: () => Promise<unknown>) {
  try {
    await simulate();
  } catch (e) {
    if (!isTransportError(e)) throw e;
  }
}

/** Switch the wallet to `target` if needed. Returns false when it couldn't. */
function useEnsureChain() {
  const chainId = useChainId();
  const { connector } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const toast = useToast();
  const t = useTranslations();
  return useCallback(
    async (target: number) => {
      if (chainId === target) return true;
      if (isChainBoundWallet(connector)) {
        toast({ title: t("wallet.earn.switchFailed"), description: chainBoundSwitchMessage(target), status: "warning", duration: 8000, isClosable: true });
        return false;
      }
      try {
        await switchChainAsync({ chainId: target });
        return true;
      } catch (e) {
        if (isUserRejection(e)) toast({ title: t("wallet.earn.cancelled"), status: "info", duration: 2000, isClosable: true });
        else toast({ title: t("wallet.earn.switchFailed"), description: friendlyError(e), status: "error", duration: 4000, isClosable: true });
        return false;
      }
    },
    [chainId, connector, switchChainAsync, toast, t],
  );
}

function AmountInput({ value, onChange, onMax, placeholder }: { value: string; onChange: (v: string) => void; onMax: () => void; placeholder: string }) {
  const t = useTranslations();
  return (
    <InputGroup>
      <Input
        value={value}
        onChange={(e) => AMOUNT_RE.test(e.target.value) && onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        fontFamily="mono"
        borderRadius="none"
        borderColor="border"
        bg="background"
        pr="64px"
      />
      <InputRightElement width="60px">
        <Button size="xs" variant="ghost" fontFamily="mono" color="primary" borderRadius="none" onClick={onMax}>
          {t("wallet.earn.max")}
        </Button>
      </InputRightElement>
    </InputGroup>
  );
}

function Row({ label, value, color = "text" }: { label: string; value: string; color?: string }) {
  return (
    <HStack justify="space-between">
      <Text fontFamily="mono" fontSize="xs" color="dim">{label}</Text>
      <Text fontFamily="mono" fontSize="sm" color={color} fontWeight="bold">{value}</Text>
    </HStack>
  );
}

function ActivityList({ items }: { items: VaultActivity[] }) {
  const t = useTranslations();
  if (items.length === 0) return null;
  return (
    <Box borderTop="1px solid" borderColor="border" pt={2}>
      <Text fontFamily="mono" fontSize="xs" color="dim" mb={1} textTransform="uppercase">{t("wallet.earn.history")}</Text>
      <VStack align="stretch" spacing={1}>
        {items.slice(0, 5).map((a) => (
          <HStack key={`${a.txHash}:${a.logIndex}`} justify="space-between" fontFamily="mono" fontSize="xs">
            <Link href={BASESCAN_TX(a.txHash)} isExternal color="primary">
              {a.type === "Deposit" ? t("wallet.earn.deposit") : t("wallet.earn.withdraw")}
            </Link>
            <Text color="dim" fontSize="xs">{new Date(a.timestamp * 1000).toLocaleDateString()}</Text>
            <Text color="text" fontSize="xs">{a.type === "Deposit" ? "+" : "−"}{fmtNum(a.assets, USDC_DECIMALS, 2)} USDC</Text>
          </HStack>
        ))}
      </VStack>
    </Box>
  );
}

function CardShell({ title, rateLabel, rate, description, children }: { title: string; rateLabel: string; rate: number | null; description: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box border="1px solid" borderColor="border" bg="background" p={4}>
      <HStack justify="space-between" align="flex-start" mb={1}>
        <Text fontFamily="mono" fontWeight="bold" color="text" textTransform="uppercase" letterSpacing="wider">{title}</Text>
        <Text fontFamily="mono" fontSize="sm" color="primary" fontWeight="bold" whiteSpace="nowrap">
          {fmtRate(rate)} {rateLabel}
        </Text>
      </HStack>
      <Text fontSize="xs" color="dim" mb={3}>{description}</Text>
      <VStack align="stretch" spacing={3}>{children}</VStack>
    </Box>
  );
}

// ─── USDC → Morpho (Base) ───────────────────────────────────────────────────

function MorphoUsdcCard({ owner }: { owner?: string }) {
  const t = useTranslations();
  const toast = useToast();
  const { address } = useAccount();
  const ensureChain = useEnsureChain();
  const client = usePublicClient({ chainId: EARN_CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const vault = MORPHO_USDC_VAULT.address;

  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [isMax, setIsMax] = useState(false);
  const [step, setStep] = useState<null | "approving" | "depositing" | "withdrawing">(null);
  const [apy, setApy] = useState<number | null>(null);

  const [activity, setActivity] = useState<{ principal: bigint; items: VaultActivity[] } | null>(null);

  useEffect(() => {
    fetchMorphoVaultApy(vault).then(setApy);
  }, [vault]);

  const [sharePrices, setSharePrices] = useState<{ t: number; price: number }[] | null>(null);
  const [historyFailed, setHistoryFailed] = useState(false);

  // Indexer data belongs to ONE address: switching wallets clears it, and an
  // in-flight response for the previous address is aborted, never applied.
  const activityAbort = useRef<AbortController | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadActivity = useCallback(() => {
    activityAbort.current?.abort();
    if (!address) return;
    const ctrl = new AbortController();
    activityAbort.current = ctrl;
    fetchMorphoVaultActivity(address, vault, EARN_CHAIN_ID, ctrl.signal).then((a) => {
      if (!ctrl.signal.aborted) setActivity(a);
    });
  }, [address, vault]);
  useEffect(() => {
    setActivity(null);
    setSharePrices(null);
    setHistoryFailed(false);
    loadActivity();
    return () => {
      activityAbort.current?.abort();
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [loadActivity]);

  const firstTs = activity?.items.length ? activity.items[activity.items.length - 1].timestamp : null;
  useEffect(() => {
    if (firstTs == null) return;
    const ctrl = new AbortController();
    fetchMorphoSharePrices(vault, firstTs, EARN_CHAIN_ID, ctrl.signal).then((p) => {
      if (ctrl.signal.aborted) return;
      setSharePrices(p ?? []);
      setHistoryFailed(p == null);
    });
    return () => ctrl.abort();
  }, [vault, firstTs]);

  const { data, refetch } = useReadContracts({
    contracts: address
      ? [
          { address: USDC_BASE, abi: ERC20_EARN_ABI, functionName: "balanceOf", args: [address], chainId: EARN_CHAIN_ID },
          { address: USDC_BASE, abi: ERC20_EARN_ABI, functionName: "allowance", args: [address, vault], chainId: EARN_CHAIN_ID },
          { address: vault, abi: ERC4626_ABI, functionName: "balanceOf", args: [address], chainId: EARN_CHAIN_ID },
          { address: vault, abi: ERC4626_ABI, functionName: "maxWithdraw", args: [address], chainId: EARN_CHAIN_ID },
        ]
      : [],
    query: { enabled: !!address },
  });
  const usdcBalance = data?.[0]?.result as bigint | undefined;
  const allowance = data?.[1]?.result as bigint | undefined;
  const shares = data?.[2]?.result as bigint | undefined;
  const maxWithdraw = data?.[3]?.result as bigint | undefined;

  const { data: positionAssets, refetch: refetchPosition } = useReadContract({
    address: vault, abi: ERC4626_ABI, functionName: "convertToAssets", args: [shares ?? 0n], chainId: EARN_CHAIN_ID,
    query: { enabled: shares != null && shares > 0n },
  });
  const position = shares === 0n ? 0n : (positionAssets as bigint | undefined);
  // Live value minus net deposits. convertToAssets rounds down, so right after
  // a deposit this can read −0.000001 — clamp to 0. Unknown principal → "—".
  const earned = position != null && activity ? (position > activity.principal ? position - activity.principal : 0n) : undefined;
  const series = useMemo(() => {
    if (!activity || sharePrices == null) return null;
    const events = activity.items.map((a) => {
      const sign = a.type === "Deposit" ? 1 : -1;
      return { t: a.timestamp, assets: sign * Number(formatUnits(a.assets, USDC_DECIMALS)), shares: sign * Number(formatUnits(a.shares, 18)) };
    });
    const live = position != null ? Number(formatUnits(position, USDC_DECIMALS)) : null;
    return buildVaultSeries(events, sharePrices, live, Math.floor(Date.now() / 1000));
  }, [activity, sharePrices, position]);

  const monthly = position != null && apy != null ? Number(formatUnits(position, USDC_DECIMALS)) * apy / 12 : null;

  const parsed = safeParse(amount, USDC_DECIMALS);
  const limit = mode === "deposit" ? usdcBalance : maxWithdraw;
  const insufficient = parsed != null && limit != null && parsed > limit;

  // Redeeming every share leaves no dust, but only works when the vault has
  // the liquidity for the whole position; otherwise MAX = maxWithdraw.
  const canRedeemAll = position != null && maxWithdraw != null && maxWithdraw >= position;

  const setMax = () => {
    if (limit == null) return;
    setAmount(formatUnits(limit, USDC_DECIMALS));
    setIsMax(mode === "withdraw" && canRedeemAll);
  };

  const run = async () => {
    if (!address || !client || parsed == null || insufficient) return;
    if (!(await ensureChain(EARN_CHAIN_ID))) return;
    try {
      if (mode === "deposit") {
        if ((allowance ?? 0n) < parsed) {
          setStep("approving");
          // Exact amount, never an unlimited approval.
          const approveHash = await writeContractAsync({
            address: USDC_BASE, abi: ERC20_EARN_ABI, functionName: "approve", args: [vault, parsed], chainId: EARN_CHAIN_ID,
          });
          await waitForSuccess(client, approveHash, t("wallet.earn.reverted"));
        }
        setStep("depositing");
        // A paused vault or a reached supply cap reverts here, before the user signs.
        await preflight(() =>
          client.simulateContract({ address: vault, abi: ERC4626_ABI, functionName: "deposit", args: [parsed, address], account: address }),
        );
        const hash = await writeContractAsync({
          address: vault, abi: ERC4626_ABI, functionName: "deposit", args: [parsed, address], chainId: EARN_CHAIN_ID,
        });
        await waitForSuccess(client, hash, t("wallet.earn.reverted"));
        toast({ title: t("wallet.earn.successDeposit"), description: hash, status: "success", duration: 6000, isClosable: true });
      } else {
        setStep("withdrawing");
        const redeemAll = isMax && canRedeemAll && !!shares;
        // Missing vault liquidity reverts here, before the user signs.
        await preflight(() =>
          redeemAll
            ? client.simulateContract({ address: vault, abi: ERC4626_ABI, functionName: "redeem", args: [shares!, address, address], account: address })
            : client.simulateContract({ address: vault, abi: ERC4626_ABI, functionName: "withdraw", args: [parsed, address, address], account: address }),
        );
        const hash = redeemAll
          ? await writeContractAsync({ address: vault, abi: ERC4626_ABI, functionName: "redeem", args: [shares!, address, address], chainId: EARN_CHAIN_ID })
          : await writeContractAsync({ address: vault, abi: ERC4626_ABI, functionName: "withdraw", args: [parsed, address, address], chainId: EARN_CHAIN_ID });
        await waitForSuccess(client, hash, t("wallet.earn.reverted"));
        toast({ title: t("wallet.earn.successWithdraw"), description: hash, status: "success", duration: 6000, isClosable: true });
      }
      setAmount("");
      setIsMax(false);
    } catch (e) {
      if (isUserRejection(e)) toast({ title: t("wallet.earn.cancelled"), status: "info", duration: 2000, isClosable: true });
      else toast({ title: t("wallet.earn.failed"), description: friendlyError(e), status: "error", duration: 6000, isClosable: true });
    } finally {
      setStep(null);
      await refetch();
      await refetchPosition();
      // The indexer trails the chain by a few seconds.
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(loadActivity, 8000);
    }
  };

  const buttonLabel = !amount
    ? t("wallet.earn.enterAmount")
    : insufficient
      ? t("wallet.earn.insufficient")
      : mode === "deposit"
        ? t("wallet.earn.deposit")
        : t("wallet.earn.withdraw");

  const hasHistory = !!activity?.items.length;

  return (
    <>
    {hasHistory && (
      <YieldChartCard
        title={t("wallet.earn.usdcTitle")}
        subtitle="Morpho · Base"
        currency="USDC"
        rate={apy}
        rateLabel="APY"
        points={series}
        error={historyFailed}
        owner={owner ?? shortAddress(address)}
        fileName="skatehive-usdc-earnings"
      />
    )}
    <CardShell
      title={t("wallet.earn.usdcTitle")}
      rateLabel="APY"
      rate={apy}
      description={
        <>
          {t("wallet.earn.usdcDesc").replace("{vault}", MORPHO_USDC_VAULT.name)}{" "}
          <Link href={MORPHO_USDC_VAULT.url} isExternal color="primary">{t("wallet.earn.viewOnMorpho")}</Link>
        </>
      }
    >
      <Row label={t("wallet.earn.currentValue")} value={`${fmtNum(position, USDC_DECIMALS, 6)} USDC`} />
      {position != null && position > 0n && (
        <>
          <Row label={t("wallet.earn.deposited")} value={activity ? `${fmtNum(activity.principal, USDC_DECIMALS, 2)} USDC` : "—"} />
          <Row label={t("wallet.earn.earned")} value={earned == null ? "—" : `+${fmtNum(earned, USDC_DECIMALS, 6)} USDC`} color={earned == null ? "dim" : "green.400"} />
          <Row label={t("wallet.earn.perMonth")} value={monthly == null ? "—" : `~${monthly.toLocaleString(undefined, { maximumFractionDigits: 4 })} USDC`} />
          <Row label={t("wallet.earn.shares")} value={`${fmtNum(shares, 18, 4)} gtUSDCp`} />
        </>
      )}
      <Row label={t("wallet.earn.available")} value={`${fmtNum(usdcBalance, USDC_DECIMALS, 2)} USDC`} />
      <HStack spacing={0}>
        {(["deposit", "withdraw"] as const).map((m) => (
          <Button
            key={m}
            flex={1}
            size="sm"
            borderRadius="none"
            fontFamily="mono"
            variant={mode === m ? "solid" : "outline"}
            bg={mode === m ? "primary" : "transparent"}
            color={mode === m ? "background" : "text"}
            borderColor="border"
            onClick={() => { setMode(m); setAmount(""); setIsMax(false); }}
          >
            {t(`wallet.earn.${m}`)}
          </Button>
        ))}
      </HStack>
      <AmountInput value={amount} onChange={(v) => { setAmount(v); setIsMax(false); }} onMax={setMax} placeholder="0.00 USDC" />
      <Button
        borderRadius="none"
        fontFamily="mono"
        bg="primary"
        color="background"
        isDisabled={!address || parsed == null || insufficient}
        isLoading={step != null}
        loadingText={step ? t(`wallet.earn.${step}`) : undefined}
        onClick={run}
      >
        {buttonLabel}
      </Button>
      {activity && <ActivityList items={activity.items} />}
    </CardShell>
    </>
  );
}

// ─── ETH → Lido stETH (mainnet) ─────────────────────────────────────────────

function LidoEthCard() {
  const t = useTranslations();
  const toast = useToast();
  const { address } = useAccount();
  const ensureChain = useEnsureChain();
  const client = usePublicClient({ chainId: MAINNET_ID });
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState("");
  const [staking, setStaking] = useState(false);
  const [apr, setApr] = useState<number | null>(null);

  useEffect(() => {
    fetchLidoApr().then(setApr);
  }, []);

  const { data: ethBalance, refetch: refetchEth } = useBalance({ address, chainId: MAINNET_ID });
  const { data: stEth, refetch: refetchStEth } = useReadContract({
    address: LIDO_STETH, abi: ERC20_EARN_ABI, functionName: "balanceOf", args: address ? [address] : undefined, chainId: MAINNET_ID,
    query: { enabled: !!address },
  });

  const parsed = safeParse(amount, 18);
  const insufficient = parsed != null && ethBalance != null && parsed > ethBalance.value;

  const setMax = async () => {
    if (!ethBalance) return;
    // Reserve what the stake will actually cost now, not a fixed 0.002 ETH
    // (that is ~50× today's fee and turned small balances into MAX = 0).
    let reserve = ETH_GAS_RESERVE;
    try {
      const fees = await client?.estimateFeesPerGas();
      if (fees?.maxFeePerGas) reserve = (LIDO_GAS_LIMIT * fees.maxFeePerGas * 3n) / 2n;
    } catch {
      /* keep the fallback */
    }
    const max = ethBalance.value > reserve ? ethBalance.value - reserve : 0n;
    setAmount(formatUnits(max, 18));
  };

  const stake = async () => {
    if (!address || !client || parsed == null || insufficient) return;
    if (!(await ensureChain(MAINNET_ID))) return;
    setStaking(true);
    try {
      // A paused or limit-reached staking queue reverts here, before the user
      // is asked to sign. RPC hiccups don't block the stake.
      try {
        await client.simulateContract({
          address: LIDO_STETH, abi: LIDO_ABI, functionName: "submit", args: [LIDO_REFERRAL], value: parsed, account: address,
        });
      } catch (e) {
        if (!isTransportError(e)) {
          toast({ title: t("wallet.earn.stakingUnavailable"), description: friendlyError(e), status: "warning", duration: 6000, isClosable: true });
          return;
        }
      }
      const hash = await writeContractAsync({
        address: LIDO_STETH, abi: LIDO_ABI, functionName: "submit", args: [LIDO_REFERRAL], value: parsed, chainId: MAINNET_ID,
      });
      await waitForSuccess(client, hash, t("wallet.earn.reverted"));
      toast({ title: t("wallet.earn.successStake"), description: hash, status: "success", duration: 6000, isClosable: true });
      setAmount("");
    } catch (e) {
      if (isUserRejection(e)) toast({ title: t("wallet.earn.cancelled"), status: "info", duration: 2000, isClosable: true });
      else toast({ title: t("wallet.earn.failed"), description: friendlyError(e), status: "error", duration: 6000, isClosable: true });
    } finally {
      setStaking(false);
      await Promise.all([refetchEth(), refetchStEth()]);
    }
  };

  return (
    <CardShell
      title={t("wallet.earn.ethTitle")}
      rateLabel="APR"
      rate={apr}
      description={
        <>
          {t("wallet.earn.ethDesc")}{" "}
          <Link href={LIDO_URL} isExternal color="primary">{t("wallet.earn.viewOnLido")}</Link>
        </>
      }
    >
      <Row label={t("wallet.earn.staked")} value={`${fmtNum(stEth as bigint | undefined, 18)} stETH`} />
      <Row label={t("wallet.earn.available")} value={`${fmtNum(ethBalance?.value, 18)} ETH`} />
      <AmountInput value={amount} onChange={setAmount} onMax={setMax} placeholder="0.0 ETH" />
      <Button
        borderRadius="none"
        fontFamily="mono"
        bg="primary"
        color="background"
        isDisabled={!address || parsed == null || insufficient}
        isLoading={staking}
        loadingText={t("wallet.earn.staking")}
        onClick={stake}
      >
        {!amount ? t("wallet.earn.enterAmount") : insufficient ? t("wallet.earn.insufficient") : t("wallet.earn.stake")}
      </Button>
      <Text fontSize="xs" color="dim">{t("wallet.earn.unstakeHint")}</Text>
    </CardShell>
  );
}

export default function EarnSection({ owner }: { owner?: string }) {
  const t = useTranslations();
  return (
    <VStack align="stretch" spacing={4}>
      <Box>
        <Text fontFamily="mono" fontWeight="bold" color="text" fontSize="lg" textTransform="uppercase" letterSpacing="wider">
          {t("wallet.earn.title")}
        </Text>
        <Text fontSize="sm" color="dim">{t("wallet.earn.subtitle")}</Text>
      </Box>
      <MorphoUsdcCard owner={owner} />
      <LidoEthCard />
      <Text fontSize="xs" color="dim" borderLeft="2px solid" borderColor="orange.300" pl={3}>
        {t("wallet.earn.risk")}
      </Text>
    </VStack>
  );
}
