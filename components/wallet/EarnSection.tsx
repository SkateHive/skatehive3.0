"use client";

/**
 * Earn tab: USDC in a Morpho vault on Base and ETH staked with Lido.
 * Constants, ABIs and rate fetchers live in lib/evm/earn.ts.
 */

import { useCallback, useEffect, useState } from "react";
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
import { friendlyError, isUserRejection } from "@/lib/evm/txErrors";
import {
  EARN_CHAIN_ID, ERC20_EARN_ABI, ERC4626_ABI, LIDO_URL, MORPHO_USDC_VAULT, USDC_BASE, USDC_DECIMALS,
  fetchLidoApr, fetchMorphoVaultApy,
} from "@/lib/evm/earn";

const MAINNET_ID = 1;
/** ETH kept back on "max" so the user can still pay gas afterwards. */
const ETH_GAS_RESERVE = parseEther("0.002");
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <HStack justify="space-between">
      <Text fontFamily="mono" fontSize="xs" color="dim">{label}</Text>
      <Text fontFamily="mono" fontSize="sm" color="text" fontWeight="bold">{value}</Text>
    </HStack>
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

function MorphoUsdcCard() {
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

  useEffect(() => {
    fetchMorphoVaultApy(vault).then(setApy);
  }, [vault]);

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

  const parsed = safeParse(amount, USDC_DECIMALS);
  const limit = mode === "deposit" ? usdcBalance : maxWithdraw;
  const insufficient = parsed != null && limit != null && parsed > limit;

  const setMax = () => {
    if (limit == null) return;
    setAmount(formatUnits(limit, USDC_DECIMALS));
    setIsMax(mode === "withdraw");
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
          await client.waitForTransactionReceipt({ hash: approveHash });
        }
        setStep("depositing");
        const hash = await writeContractAsync({
          address: vault, abi: ERC4626_ABI, functionName: "deposit", args: [parsed, address], chainId: EARN_CHAIN_ID,
        });
        await client.waitForTransactionReceipt({ hash });
        toast({ title: t("wallet.earn.successDeposit"), description: hash, status: "success", duration: 6000, isClosable: true });
      } else {
        setStep("withdrawing");
        // "Max" redeems every share so no dust stays in the vault.
        const hash = isMax && shares
          ? await writeContractAsync({ address: vault, abi: ERC4626_ABI, functionName: "redeem", args: [shares, address, address], chainId: EARN_CHAIN_ID })
          : await writeContractAsync({ address: vault, abi: ERC4626_ABI, functionName: "withdraw", args: [parsed, address, address], chainId: EARN_CHAIN_ID });
        await client.waitForTransactionReceipt({ hash });
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
    }
  };

  const buttonLabel = !amount
    ? t("wallet.earn.enterAmount")
    : insufficient
      ? t("wallet.earn.insufficient")
      : mode === "deposit"
        ? t("wallet.earn.deposit")
        : t("wallet.earn.withdraw");

  return (
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
      <Row label={t("wallet.earn.deposited")} value={`${fmtNum(position, USDC_DECIMALS, 2)} USDC`} />
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
    </CardShell>
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

  const setMax = () => {
    if (!ethBalance) return;
    const max = ethBalance.value > ETH_GAS_RESERVE ? ethBalance.value - ETH_GAS_RESERVE : 0n;
    setAmount(formatUnits(max, 18));
  };

  const stake = async () => {
    if (!address || !client || parsed == null || insufficient) return;
    if (!(await ensureChain(MAINNET_ID))) return;
    setStaking(true);
    try {
      const hash = await writeContractAsync({
        address: LIDO_STETH, abi: LIDO_ABI, functionName: "submit", args: [LIDO_REFERRAL], value: parsed, chainId: MAINNET_ID,
      });
      await client.waitForTransactionReceipt({ hash });
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

export default function EarnSection() {
  const t = useTranslations();
  return (
    <VStack align="stretch" spacing={4}>
      <Box>
        <Text fontFamily="mono" fontWeight="bold" color="text" fontSize="lg" textTransform="uppercase" letterSpacing="wider">
          {t("wallet.earn.title")}
        </Text>
        <Text fontSize="sm" color="dim">{t("wallet.earn.subtitle")}</Text>
      </Box>
      <MorphoUsdcCard />
      <LidoEthCard />
      <Text fontSize="xs" color="dim" borderLeft="2px solid" borderColor="orange.300" pl={3}>
        {t("wallet.earn.risk")}
      </Text>
    </VStack>
  );
}
