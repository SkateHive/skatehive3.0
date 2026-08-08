"use client";

/**
 * Matcha-style token + chain selector for the ERC-20 swap.
 *
 * - Filter by chain (Base / Ethereum / Arbitrum)
 * - Popular tokens, the user's held tokens (with USD), and recent picks
 * - Search by name/symbol, or paste any address to import it (resolved on-chain)
 *
 * Selecting a token on a different chain is allowed — the parent switches the
 * wallet network to match, so this modal doubles as the network switcher.
 */
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  HStack,
  Image,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  Spinner,
  Text,
  VStack,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { FaCheck, FaSearch } from "react-icons/fa";
import { isAddress, getAddress, type Address } from "viem";
import { usePublicClient } from "wagmi";
import { PortfolioContext } from "@/contexts/PortfolioContext";
import { useTranslations } from "@/contexts/LocaleContext";
import TokenChainLogo from "./TokenChainLogo";
import {
  NATIVE_TOKEN,
  SWAP_CHAINS,
  SWAP_CHAIN_IDS,
  findToken,
  isNativeToken,
  networkToChainId,
  popularForChain,
  tokensForChain,
  type SwapToken,
} from "@/lib/evm/swapTokens";

const RECENT_KEY = "skatehive.swap.recent";
const RECENT_MAX = 8;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const ERC20_META_ABI = [
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;

interface HeldToken {
  token: SwapToken;
  balance: number;
  balanceUSD: number;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

function fmtBalance(n: number): string {
  if (n === 0) return "0";
  if (n < 0.0001) return n.toExponential(2);
  if (n < 1) return n.toFixed(4);
  if (n < 1000) return n.toFixed(2);
  return Math.floor(n).toLocaleString();
}

function fmtUsd(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

// ─── Recent (localStorage) ───────────────────────────────────────────────────

function loadRecent(): SwapToken[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as SwapToken[];
    return Array.isArray(arr) ? arr.filter((t) => SWAP_CHAIN_IDS.includes(t.chainId)) : [];
  } catch {
    return [];
  }
}

function saveRecent(token: SwapToken) {
  if (typeof window === "undefined") return;
  try {
    const current = loadRecent().filter(
      (t) => !(t.chainId === token.chainId && t.address.toLowerCase() === token.address.toLowerCase()),
    );
    const next = [token, ...current].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / serialization errors */
  }
}

// ─── Logo ────────────────────────────────────────────────────────────────────

/** Token logo + chain badge (shared with the swap/bridge panels). */
function TokenAvatar({ token, size = "32px" }: { token: SwapToken; size?: string }) {
  return <TokenChainLogo token={token} size={size} />;
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function TokenRow({
  token,
  held,
  isSelected,
  isExcluded,
  onClick,
}: {
  token: SwapToken;
  held?: HeldToken;
  isSelected: boolean;
  isExcluded: boolean;
  onClick: () => void;
}) {
  return (
    <HStack
      px={4}
      py={2.5}
      spacing={3}
      cursor={isExcluded ? "not-allowed" : "pointer"}
      opacity={isExcluded ? 0.3 : 1}
      bg={isSelected ? "muted" : "transparent"}
      borderLeft="2px solid"
      borderColor={isSelected ? "primary" : "transparent"}
      _hover={isExcluded ? {} : { bg: "muted", borderColor: "primary" }}
      transition="all 0.1s"
      onClick={isExcluded ? undefined : onClick}
    >
      <TokenAvatar token={token} />
      <VStack spacing={0} align="start" flex={1} minW={0}>
        <Text fontSize="sm" fontWeight="black" fontFamily="mono" color="text" isTruncated>
          {token.symbol}
        </Text>
        <Text fontSize="10px" color="dim" fontFamily="mono" noOfLines={1}>
          {isNativeToken(token.address) ? token.name : shortAddr(token.address)}
        </Text>
      </VStack>
      <VStack spacing={0} align="end" flexShrink={0}>
        {held && held.balance > 0 ? (
          <>
            <Text fontSize="xs" fontFamily="mono" fontWeight="bold" color="text">
              {fmtBalance(held.balance)}
            </Text>
            {held.balanceUSD > 0 && (
              <Text fontSize="10px" fontFamily="mono" color="dim">
                {fmtUsd(held.balanceUSD)}
              </Text>
            )}
          </>
        ) : isSelected ? (
          <FaCheck color="var(--chakra-colors-primary)" size={12} />
        ) : null}
      </VStack>
    </HStack>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

interface TokenSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: SwapToken) => void;
  selectedAddress?: string;
  /** Other side's token address (disabled on the same chain). */
  excludeAddress?: string;
  /** Wallet's current chain — used as the initial filter. */
  activeChainId: number;
}

export default function TokenSelectorModal({
  isOpen,
  onClose,
  onSelect,
  selectedAddress,
  excludeAddress,
  activeChainId,
}: TokenSelectorModalProps) {
  const t = useTranslations();
  const initialChain = SWAP_CHAIN_IDS.includes(activeChainId) ? activeChainId : SWAP_CHAINS[0].id;
  const [chainFilter, setChainFilter] = useState<number>(initialChain);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<SwapToken[]>([]);
  const [showAllHeld, setShowAllHeld] = useState(false);

  const publicClient = usePublicClient({ chainId: chainFilter });
  const portfolioCtx = useContext(PortfolioContext);
  const portfolioTokens = portfolioCtx?.aggregatedPortfolio?.tokens;

  // Reset transient state when reopened / active chain changes.
  useEffect(() => {
    if (isOpen) {
      setChainFilter(SWAP_CHAIN_IDS.includes(activeChainId) ? activeChainId : SWAP_CHAINS[0].id);
      setQuery("");
      setShowAllHeld(false);
      setRecent(loadRecent());
    }
  }, [isOpen, activeChainId]);

  // ── Held tokens for the current chain filter (from portfolio) ────────────
  const heldByAddress = useMemo(() => {
    const map = new Map<string, HeldToken>();
    if (!portfolioTokens) return map;
    for (const pt of portfolioTokens) {
      const cid = networkToChainId(pt.network ?? "");
      if (cid !== chainFilter) continue;
      const info = pt.token;
      const rawAddr = (info?.address ?? pt.address ?? "").toLowerCase();
      const balance = info?.balance ?? 0;
      if (!rawAddr || balance <= 0) continue;
      const native = rawAddr === ZERO_ADDRESS || rawAddr === NATIVE_TOKEN || (info?.symbol === "ETH" && rawAddr === ZERO_ADDRESS);
      const address = native ? NATIVE_TOKEN : rawAddr;
      const registry = findToken(chainFilter, address);
      const token: SwapToken = {
        chainId: chainFilter,
        symbol: info?.symbol ?? registry?.symbol ?? "?",
        name: info?.name ?? registry?.name ?? "",
        address,
        decimals: info?.decimals ?? registry?.decimals ?? 18,
        logo: registry?.logo,
      };
      map.set(address.toLowerCase(), { token, balance, balanceUSD: info?.balanceUSD ?? 0 });
    }
    return map;
  }, [portfolioTokens, chainFilter]);

  const heldList = useMemo(
    () => Array.from(heldByAddress.values()).sort((a, b) => b.balanceUSD - a.balanceUSD),
    [heldByAddress],
  );

  // ── Registry + held merged into the full list for this chain ─────────────
  const registryTokens = useMemo(() => tokensForChain(chainFilter), [chainFilter]);

  const fullList = useMemo(() => {
    const seen = new Set(registryTokens.map((t) => t.address.toLowerCase()));
    const extras = heldList.map((h) => h.token).filter((t) => !seen.has(t.address.toLowerCase()));
    return [...registryTokens, ...extras];
  }, [registryTokens, heldList]);

  // ── Search / address import ──────────────────────────────────────────────
  const trimmed = query.trim();
  const looksLikeAddress = isAddress(trimmed);

  const filtered = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (!q) return fullList;
    return fullList.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q),
    );
  }, [trimmed, fullList]);

  const [imported, setImported] = useState<SwapToken | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    setImported(null);
    if (!looksLikeAddress || !publicClient) return;
    const addr = getAddress(trimmed);
    if (findToken(chainFilter, addr) || heldByAddress.has(addr.toLowerCase())) return;

    let cancelled = false;
    setImporting(true);
    const timer = setTimeout(async () => {
      try {
        const [symbol, name, decimals] = await Promise.all([
          publicClient.readContract({ address: addr, abi: ERC20_META_ABI, functionName: "symbol" }),
          publicClient.readContract({ address: addr, abi: ERC20_META_ABI, functionName: "name" }),
          publicClient.readContract({ address: addr, abi: ERC20_META_ABI, functionName: "decimals" }),
        ]);
        if (cancelled) return;
        setImported({
          chainId: chainFilter,
          symbol: String(symbol),
          name: String(name),
          address: addr,
          decimals: Number(decimals),
        });
      } catch {
        if (!cancelled) setImported(null);
      } finally {
        if (!cancelled) setImporting(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, looksLikeAddress, publicClient, chainFilter, heldByAddress]);

  const popular = useMemo(() => popularForChain(chainFilter), [chainFilter]);

  const excluded = excludeAddress?.toLowerCase();
  const selected = selectedAddress?.toLowerCase();

  const handleSelect = useCallback(
    (token: SwapToken) => {
      saveRecent(token);
      onSelect(token);
      setQuery("");
      onClose();
    },
    [onSelect, onClose],
  );

  const heldToShow = showAllHeld ? heldList : heldList.slice(0, 5);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(6px)" bg="blackAlpha.700" />
      <ModalContent bg="background" border="2px solid" borderColor="primary" borderRadius="none" mx={4} maxH="88vh">
        <ModalCloseButton color="dim" top={3} right={3} zIndex={2} />
        <ModalBody px={0} py={0}>
          {/* Search */}
          <Box px={4} pt={4} pb={3}>
            <InputGroup size="lg">
              <InputLeftElement pointerEvents="none" h="100%">
                <FaSearch color="var(--chakra-colors-dim)" />
              </InputLeftElement>
              <Input
                placeholder={t("swapTokens.searchPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                bg="muted"
                border="1px solid"
                borderColor="border"
                borderRadius="none"
                fontFamily="mono"
                fontSize="sm"
                color="text"
                h="48px"
                _placeholder={{ color: "dim" }}
                _focus={{ borderColor: "primary", boxShadow: "none" }}
                autoFocus
              />
            </InputGroup>
          </Box>

          {/* Chain filter */}
          <Box px={4} pb={3}>
            <Wrap spacing={2}>
              {SWAP_CHAINS.map((c) => {
                const active = c.id === chainFilter;
                return (
                  <WrapItem key={c.id}>
                    <Button
                      size="sm"
                      h="34px"
                      borderRadius="full"
                      variant="outline"
                      borderColor={active ? "primary" : "border"}
                      bg={active ? "muted" : "transparent"}
                      color={active ? "primary" : "text"}
                      fontFamily="mono"
                      fontWeight="bold"
                      fontSize="xs"
                      leftIcon={<Image src={c.logo} w="16px" h="16px" borderRadius="full" alt="" fallback={<span />} />}
                      onClick={() => { setChainFilter(c.id); setShowAllHeld(false); }}
                      _hover={{ borderColor: "primary" }}
                    >
                      {c.name}
                    </Button>
                  </WrapItem>
                );
              })}
            </Wrap>
          </Box>

          {/* Popular */}
          {!trimmed && popular.length > 0 && (
            <Box px={4} pb={3}>
              <Text fontSize="10px" fontFamily="mono" color="dim" textTransform="uppercase" letterSpacing="wider" mb={2}>
                {t("swapTokens.popular")}
              </Text>
              <Wrap spacing={2}>
                {popular.map((tok) => {
                  const isExcl = tok.address.toLowerCase() === excluded && tok.chainId === activeChainId;
                  return (
                    <WrapItem key={tok.address}>
                      <Button
                        size="sm"
                        h="32px"
                        borderRadius="full"
                        variant="outline"
                        borderColor="border"
                        color="text"
                        fontFamily="mono"
                        fontWeight="bold"
                        fontSize="xs"
                        opacity={isExcl ? 0.3 : 1}
                        cursor={isExcl ? "not-allowed" : "pointer"}
                        leftIcon={<TokenAvatar token={tok} size="18px" />}
                        onClick={() => !isExcl && handleSelect(tok)}
                        _hover={isExcl ? {} : { borderColor: "primary", bg: "muted" }}
                      >
                        {tok.symbol}
                      </Button>
                    </WrapItem>
                  );
                })}
              </Wrap>
            </Box>
          )}

          <Box h="1px" bg="border" />

          <VStack
            spacing={0}
            align="stretch"
            overflowY="auto"
            maxH="46vh"
            sx={{
              "&::-webkit-scrollbar": { w: "4px" },
              "&::-webkit-scrollbar-thumb": { bg: "border", borderRadius: "2px" },
            }}
          >
            {/* Address import result */}
            {looksLikeAddress && importing && (
              <HStack px={4} py={3} spacing={2}>
                <Spinner size="xs" color="primary" />
                <Text fontSize="xs" color="dim" fontFamily="mono">{t("swapTokens.importing")}</Text>
              </HStack>
            )}
            {looksLikeAddress && imported && (
              <>
                <Text fontSize="10px" fontFamily="mono" color="dim" textTransform="uppercase" letterSpacing="wider" px={4} pt={3} pb={1}>
                  {t("swapTokens.imported")}
                </Text>
                <TokenRow
                  token={imported}
                  isSelected={imported.address.toLowerCase() === selected}
                  isExcluded={false}
                  onClick={() => handleSelect(imported)}
                />
              </>
            )}

            {/* My Tokens */}
            {!trimmed && heldList.length > 0 && (
              <>
                <Text fontSize="10px" fontFamily="mono" color="dim" textTransform="uppercase" letterSpacing="wider" px={4} pt={3} pb={1}>
                  {t("swapTokens.myTokens")}
                </Text>
                {heldToShow.map((h) => (
                  <TokenRow
                    key={`held-${h.token.address}`}
                    token={h.token}
                    held={h}
                    isSelected={h.token.address.toLowerCase() === selected}
                    isExcluded={h.token.address.toLowerCase() === excluded && chainFilter === activeChainId}
                    onClick={() => handleSelect(h.token)}
                  />
                ))}
                {heldList.length > 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    color="primary"
                    fontFamily="mono"
                    fontSize="xs"
                    onClick={() => setShowAllHeld((s) => !s)}
                    _hover={{ bg: "muted" }}
                  >
                    {showAllHeld ? t("swapTokens.showLess") : t("swapTokens.showMore")}
                  </Button>
                )}
              </>
            )}

            {/* Recent */}
            {!trimmed && recent.filter((r) => r.chainId === chainFilter).length > 0 && (
              <>
                <HStack justify="space-between" px={4} pt={3} pb={1}>
                  <Text fontSize="10px" fontFamily="mono" color="dim" textTransform="uppercase" letterSpacing="wider">
                    {t("swapTokens.recent")}
                  </Text>
                  <Button
                    variant="ghost"
                    size="xs"
                    h="16px"
                    color="dim"
                    fontFamily="mono"
                    fontSize="10px"
                    onClick={() => { window.localStorage.removeItem(RECENT_KEY); setRecent([]); }}
                    _hover={{ color: "primary" }}
                  >
                    {t("swapTokens.clear")}
                  </Button>
                </HStack>
                {recent
                  .filter((r) => r.chainId === chainFilter)
                  .map((r) => (
                    <TokenRow
                      key={`recent-${r.address}`}
                      token={r}
                      held={heldByAddress.get(r.address.toLowerCase())}
                      isSelected={r.address.toLowerCase() === selected}
                      isExcluded={r.address.toLowerCase() === excluded && chainFilter === activeChainId}
                      onClick={() => handleSelect(r)}
                    />
                  ))}
              </>
            )}

            {/* Full list */}
            <Text fontSize="10px" fontFamily="mono" color="dim" textTransform="uppercase" letterSpacing="wider" px={4} pt={3} pb={1}>
              {t("swapTokens.tokens")}
            </Text>
            {filtered.map((tok) => (
              <TokenRow
                key={tok.address}
                token={tok}
                held={heldByAddress.get(tok.address.toLowerCase())}
                isSelected={tok.address.toLowerCase() === selected}
                isExcluded={tok.address.toLowerCase() === excluded && tok.chainId === activeChainId}
                onClick={() => handleSelect(tok)}
              />
            ))}

            {trimmed && filtered.length === 0 && !imported && !importing && (
              <Box py={6} textAlign="center">
                <Text fontSize="xs" color="dim" fontFamily="mono">{t("swapTokens.noResults")}</Text>
              </Box>
            )}
            <Box h={2} />
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
