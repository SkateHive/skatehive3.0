"use client";

import { Transaction, getTransactionHistory } from "@/lib/hive/client-functions";
import { KeyTypes } from "@aioha/aioha";
import { useAioha } from "@aioha/react-ui";
import {
  Box,
  Button,
  HStack,
  Image,
  Input,
  InputGroup,
  InputLeftElement,
  Skeleton,
  Text,
  Tooltip,
  VStack,
  Collapse,
  useToast,
} from "@chakra-ui/react";
import { useEffect, useCallback, useState, useMemo } from "react";
import { FaArrowDown, FaArrowUp, FaChevronDown, FaChevronUp, FaLock, FaSearch, FaTimes, FaUserPlus } from "react-icons/fa";

const BATCH_SIZE = 20;

function relativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function tokenLogo(currency: string): string {
  if (currency === "HBD") return "/logos/hbd_logo.png";
  return "/logos/hiveLogo.png";
}

const replacePixbee = (s: string) => (s?.toLowerCase() === "pixbee" ? "skatebank" : s);

type DirectionFilter = "all" | "in" | "out" | "acc";

export default function HiveTransactionHistory({ searchAccount }: { searchAccount: string }) {
  const { user, aioha } = useAioha();
  const toast = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [decryptedMemos, setDecryptedMemos] = useState<Record<number, string>>({});
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState<DirectionFilter>("all");

  const handleDecrypt = useCallback(
    async (idx: number, memo: string) => {
      try {
        const result = await aioha.decryptMemo(memo, KeyTypes.Memo);
        if (result.success) {
          const cleaned = result.result.startsWith("#") ? result.result.slice(1) : result.result;
          setDecryptedMemos((prev) => ({ ...prev, [idx]: cleaned }));
        } else {
          toast({ title: "Decryption failed", status: "error", duration: 3000, isClosable: true });
        }
      } catch {
        toast({ title: "Decryption error", status: "error", duration: 3000, isClosable: true });
      }
    },
    [aioha, toast]
  );

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    getTransactionHistory(user, searchAccount)
      .then(({ transactions: txs }) => {
        setTransactions(txs);
        setVisibleCount(BATCH_SIZE);
      })
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false));
  }, [user, searchAccount]);

  // Client-side filter — all txs already in memory, no extra API calls
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return transactions.filter((tx) => {
      const isAccOp = tx.type === "account_create" || tx.type === "create_claimed_account";
      if (direction === "acc") return isAccOp;
      if (isAccOp) return direction === "all"; // ACC ops only visible in "all" or "acc"
      if (direction === "in" && tx.to !== user) return false;
      if (direction === "out" && tx.from !== user) return false;
      if (!q) return true;
      return (
        tx.from.toLowerCase().includes(q) ||
        tx.to.toLowerCase().includes(q) ||
        (tx.memo ?? "").toLowerCase().includes(q) ||
        tx.amount.toLowerCase().includes(q)
      );
    });
  }, [transactions, search, direction, user]);

  // Reset pagination whenever filter changes
  useEffect(() => { setVisibleCount(BATCH_SIZE); }, [search, direction]);

  const visible = filtered.slice(0, visibleCount);

  return (
    <Box mt={4} border="1px solid" borderColor="border">
      {/* ── Header toggle ── */}
      <HStack
        px={4}
        py={3}
        justify="space-between"
        cursor="pointer"
        _hover={{ bg: "subtle" }}
        onClick={() => setOpen((v) => !v)}
        borderBottom={open ? "1px solid" : "none"}
        borderColor="border"
      >
        <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="widest" fontFamily="mono" color="primary">
          Hive Activity
        </Text>
        <HStack spacing={3}>
          {!loading && transactions.length > 0 && (
            <Text fontSize="xs" color="dim" fontFamily="mono">
              {transactions.length} txs
            </Text>
          )}
          <Box color="dim" fontSize="xs">
            {open ? <FaChevronUp /> : <FaChevronDown />}
          </Box>
        </HStack>
      </HStack>

      <Collapse in={open} animateOpacity>
        {/* ── Search + direction filter ── */}
        <HStack px={3} py={2} spacing={2} borderBottom="1px solid" borderColor="border" bg="subtle">
          <InputGroup size="sm" flex={1}>
            <InputLeftElement pointerEvents="none" color="dim">
              <FaSearch size={10} />
            </InputLeftElement>
            <Input
              placeholder="Search @user, memo, amount…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              borderRadius="none"
              borderColor="border"
              fontFamily="mono"
              fontSize="xs"
              _focus={{ borderColor: "primary", boxShadow: "none" }}
            />
            {search && (
              <Box
                position="absolute"
                right={2}
                top="50%"
                transform="translateY(-50%)"
                cursor="pointer"
                color="dim"
                zIndex={2}
                onClick={() => setSearch("")}
              >
                <FaTimes size={10} />
              </Box>
            )}
          </InputGroup>

          {/* Direction pills */}
          {(["all", "in", "out", "acc"] as DirectionFilter[]).map((d) => (
            <Button
              key={d}
              size="xs"
              borderRadius="none"
              fontFamily="mono"
              letterSpacing="wide"
              variant={direction === d ? "solid" : "outline"}
              colorScheme={d === "in" ? "green" : d === "out" ? "red" : d === "acc" ? "purple" : "gray"}
              onClick={(e) => { e.stopPropagation(); setDirection(d); }}
              minW="36px"
            >
              {d === "all" ? "ALL" : d === "in" ? "↓ IN" : d === "out" ? "↑ OUT" : "ACC"}
            </Button>
          ))}
        </HStack>

        {/* ── Results count when searching ── */}
        {search && (
          <Box px={4} py={1} borderBottom="1px solid" borderColor="border">
            <Text fontSize="xs" color="dim" fontFamily="mono">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""} for &quot;{search}&quot;
            </Text>
          </Box>
        )}

        {/* ── Transaction list ── */}
        {loading ? (
          <VStack spacing={0} align="stretch">
            {Array.from({ length: 5 }).map((_, i) => (
              <HStack key={i} px={4} py={3} borderBottom="1px solid" borderColor="border" justify="space-between">
                <HStack spacing={3}>
                  <Skeleton w="28px" h="28px" startColor="muted" endColor="panel" />
                  <VStack spacing={1} align="start">
                    <Skeleton h="10px" w="80px" startColor="muted" endColor="panel" />
                    <Skeleton h="8px" w="140px" startColor="muted" endColor="panel" />
                  </VStack>
                </HStack>
                <Skeleton h="10px" w="70px" startColor="muted" endColor="panel" />
              </HStack>
            ))}
          </VStack>
        ) : filtered.length === 0 ? (
          <Box px={4} py={6} textAlign="center">
            <Text color="dim" fontSize="sm" fontFamily="mono">
              {search ? `No transactions matching "${search}"` : "No transactions found"}
            </Text>
          </Box>
        ) : (
          <>
            {visible.map((tx, idx) => {
              const isIncoming = tx.to === user;
              const [amt, currency] = tx.amount.split(" ");
              const rawMemo = tx.memo ?? "";
              const isEncrypted = rawMemo.startsWith("#");
              const displayMemo = decryptedMemos[idx] ?? (isEncrypted ? "encrypted" : rawMemo);
              const counterparty = replacePixbee(isIncoming ? tx.from : tx.to);

                const isAccOp = tx.type === "account_create" || tx.type === "create_claimed_account";
              const isACC = tx.amount === "ACC";

              if (isAccOp) {
                return (
                  <HStack
                    key={idx}
                    px={4}
                    py={3}
                    borderBottom="1px solid"
                    borderColor="border"
                    justify="space-between"
                    align="start"
                    _hover={{ bg: "subtle" }}
                    spacing={3}
                  >
                    {/* Account creation indicator */}
                    <Box
                      flexShrink={0}
                      w="28px"
                      h="28px"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      border="1px solid"
                      borderColor="purple.400"
                      bg="rgba(128,90,213,0.1)"
                    >
                      <FaUserPlus color="var(--chakra-colors-purple-400)" size={10} />
                    </Box>

                    {/* New account name */}
                    <VStack spacing={0} align="start" flex={1} minW={0}>
                      <HStack spacing={1}>
                        <Text fontSize="xs" color="dim" fontFamily="mono">created</Text>
                        <Text fontSize="xs" color="purple.300" fontFamily="mono" fontWeight="bold">@{tx.to}</Text>
                      </HStack>
                    </VStack>

                    {/* Fee + time */}
                    <VStack spacing={0} align="end" flexShrink={0}>
                      <HStack spacing={1}>
                        {!isACC && <Image src="/logos/hiveLogo.png" w="12px" h="12px" objectFit="contain" alt="" />}
                        <Text fontSize="xs" fontFamily="mono" fontWeight="bold" color="purple.300">
                          {isACC ? "ACC" : `-${parseFloat(amt).toFixed(3)} ${currency}`}
                        </Text>
                      </HStack>
                      <Text fontSize="9px" color="dim" fontFamily="mono">
                        {relativeTime(tx.timestamp)}
                      </Text>
                    </VStack>
                  </HStack>
                );
              }

              return (
                <HStack
                  key={idx}
                  px={4}
                  py={3}
                  borderBottom="1px solid"
                  borderColor="border"
                  justify="space-between"
                  align="start"
                  _hover={{ bg: "subtle" }}
                  spacing={3}
                >
                  {/* Direction indicator */}
                  <Box
                    flexShrink={0}
                    w="28px"
                    h="28px"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    border="1px solid"
                    borderColor={isIncoming ? "success" : "error"}
                    bg={isIncoming ? "rgba(72,199,116,0.1)" : "rgba(252,90,90,0.1)"}
                  >
                    {isIncoming
                      ? <FaArrowDown color="var(--chakra-colors-success)" size={10} />
                      : <FaArrowUp color="var(--chakra-colors-error)" size={10} />}
                  </Box>

                  {/* Counterparty + memo */}
                  <VStack spacing={0} align="start" flex={1} minW={0}>
                    <HStack spacing={1}>
                      <Text fontSize="xs" color="dim" fontFamily="mono">{isIncoming ? "from" : "to"}</Text>
                      <Text fontSize="xs" color="primary" fontFamily="mono" fontWeight="bold">@{counterparty}</Text>
                    </HStack>
                    {displayMemo && (
                      <Tooltip label={isEncrypted && decryptedMemos[idx] ? decryptedMemos[idx] : displayMemo} hasArrow>
                        <HStack spacing={1} cursor={isEncrypted && !decryptedMemos[idx] ? "pointer" : "default"}
                          onClick={() => { if (isEncrypted && !decryptedMemos[idx]) handleDecrypt(idx, rawMemo); }}>
                          {isEncrypted && !decryptedMemos[idx] && <Box color="dim"><FaLock size={8} /></Box>}
                          <Text fontSize="xs" color="dim" fontFamily="mono" noOfLines={1}>
                            {displayMemo.length > 45 ? `${displayMemo.slice(0, 45)}…` : displayMemo}
                          </Text>
                        </HStack>
                      </Tooltip>
                    )}
                  </VStack>

                  {/* Amount + time */}
                  <VStack spacing={0} align="end" flexShrink={0}>
                    <HStack spacing={1}>
                      <Image src={tokenLogo(currency)} w="12px" h="12px" objectFit="contain" alt="" />
                      <Text fontSize="xs" fontFamily="mono" fontWeight="bold" color={isIncoming ? "success" : "error"}>
                        {isIncoming ? "+" : "-"}{parseFloat(amt).toFixed(3)} {currency}
                      </Text>
                    </HStack>
                    <Text fontSize="9px" color="dim" fontFamily="mono">
                      {relativeTime(tx.timestamp)}
                    </Text>
                  </VStack>
                </HStack>
              );
            })}

            {visibleCount < filtered.length && (
              <Box px={4} py={3} borderTop="1px solid" borderColor="border">
                <Button
                  w="100%"
                  size="sm"
                  variant="outline"
                  borderRadius="none"
                  fontFamily="mono"
                  letterSpacing="wide"
                  onClick={() => setVisibleCount((v) => Math.min(v + BATCH_SIZE, filtered.length))}
                >
                  Show more ({filtered.length - visibleCount} remaining)
                </Button>
              </Box>
            )}
          </>
        )}
      </Collapse>
    </Box>
  );
}
