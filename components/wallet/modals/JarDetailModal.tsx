import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Text,
  HStack,
  VStack,
  Button,
  Progress,
  Spinner,
  Badge,
} from "@chakra-ui/react";
import SkateModal from "@/components/shared/SkateModal";
import useIsMobile from "@/hooks/useIsMobile";
import { useTranslations, useLocale } from "@/contexts/LocaleContext";
import { tVars } from "@/lib/i18n/format";
import type { SavingsJar, JarEvent } from "@/hooks/wallet/useSavingsJars";

/** Hive HBD savings APR used for the display-only monthly yield estimate. */
const SAVINGS_APR = 0.15;

interface JarDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  jar: SavingsJar | null;
  fetchEvents: (id: string) => Promise<JarEvent[]>;
  onSave: (jar: SavingsJar) => void;
  onWithdraw: (jar: SavingsJar) => void;
  onEdit: (jar: SavingsJar) => void;
  onDelete: (jar: SavingsJar) => Promise<void>;
}

function eventLabelKey(event: JarEvent): string {
  if (event.type === "create") return "eventCreate";
  if (event.type === "fund") {
    return event.via === "wallet" ? "eventFundWallet" : "eventFund";
  }
  return event.via === "wallet" ? "eventWithdrawWallet" : "eventWithdraw";
}

/**
 * One cofrinho = one screen: big balance, friendly progress copy, monthly
 * yield estimate, Save/Withdraw as the only two primary actions, and the
 * movement history underneath (Nubank Caixinhas pattern).
 */
export function JarDetailModal({
  isOpen,
  onClose,
  jar,
  fetchEvents,
  onSave,
  onWithdraw,
  onEdit,
  onDelete,
}: JarDetailModalProps) {
  const t = useTranslations("cofrinhos");
  const { locale } = useLocale();
  const isMobile = useIsMobile();

  const [events, setEvents] = useState<JarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const allocated = Number(jar?.allocated_hbd ?? 0);

  const jarId = jar?.id;
  useEffect(() => {
    setConfirmingDelete(false);
    if (!isOpen || !jarId) return;
    let cancelled = false;
    setEventsLoading(true);
    fetchEvents(jarId)
      .then((list) => {
        if (!cancelled) setEvents(list);
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Keyed on id + balance only: `jar` gets a new object identity on every
    // refresh(), so depending on it would refetch history on unrelated changes.
    // `allocated` covers the "balance moved, reload history" trigger.
  }, [isOpen, jarId, allocated, fetchEvents]);

  const progress = useMemo(() => {
    if (!jar?.target_hbd || jar.target_hbd <= 0) return null;
    return Math.min(100, (allocated / jar.target_hbd) * 100);
  }, [jar, allocated]);

  if (!jar) return null;

  const goalDone = progress !== null && progress >= 100;
  const missing = jar.target_hbd ? Math.max(0, jar.target_hbd - allocated) : 0;
  const monthlyYield = (allocated * SAVINGS_APR) / 12;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
    });

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(jar);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SkateModal
      isOpen={isOpen}
      onClose={onClose}
      title={`${jar.icon} ${jar.name}`}
      size={isMobile ? "full" : "md"}
    >
      <Box>
        {/* Tinted identity header */}
        <Box
          px={4}
          pt={4}
          pb={3}
          bgGradient={`linear(to-b, ${jar.color}22, transparent)`}
          borderBottom="1px solid"
          borderColor="border"
        >
          <HStack justify="center" spacing={2}>
            {jar.is_wishlist && (
              <Badge fontSize="2xs" colorScheme="purple">{t("wishlistBadge")}</Badge>
            )}
            {jar.deadline && (
              <Text fontSize="2xs" color="dim" fontFamily="mono" textTransform="uppercase" letterSpacing="wider">
                {tVars(t("goalBy"), {
                  date: new Date(`${jar.deadline}T00:00:00`).toLocaleDateString(locale, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }),
                })}
              </Text>
            )}
          </HStack>

          <VStack spacing={0} py={3}>
            <Text
              fontSize="3xl"
              fontWeight="black"
              fontFamily="mono"
              color={jar.color}
              lineHeight={1}
              sx={{ fontVariantNumeric: "tabular-nums" }}
            >
              {allocated.toFixed(3)}
            </Text>
            <Text fontSize="2xs" color="dim" fontFamily="mono" textTransform="uppercase" letterSpacing="widest" mt={1}>
              {t("hbdSaved")}
            </Text>
          </VStack>

          {progress !== null && !jar.is_wishlist && (
            <Box>
              <Text fontSize="xs" color="text" fontFamily="mono" textAlign="center" mb={2} lineHeight="tall">
                {goalDone
                  ? tVars(t("goalDoneCopy"), { target: jar.target_hbd!.toFixed(3) })
                  : tVars(t("progressCopy"), {
                      pct: Math.round(progress),
                      missing: missing.toFixed(3),
                    })}
              </Text>
              <Progress
                value={progress}
                size="sm"
                borderRadius="none"
                bg="background"
                sx={{ "& > div": { backgroundColor: jar.color } }}
              />
            </Box>
          )}
        </Box>

        <Box px={4} py={3}>
          {!jar.is_wishlist && allocated > 0 && (
            <Box p={2} bg="panel" border="1px solid" borderColor="border" mb={3}>
              <Text fontSize="xs" color="dim" fontFamily="mono" lineHeight="tall">
                ✦ {tVars(t("yieldLine"), { amount: monthlyYield.toFixed(3) })}
              </Text>
            </Box>
          )}

          {/* The only two big actions */}
          {!jar.is_wishlist && (
            <HStack spacing={3} mb={4}>
              <Button
                flex={1}
                onClick={() => onSave(jar)}
                bg="primary"
                color="background"
                borderRadius="none"
                fontFamily="mono"
                fontWeight="black"
                letterSpacing="wide"
                _hover={{ bg: "accent" }}
              >
                ↓ {t("save")}
              </Button>
              <Button
                flex={1}
                onClick={() => onWithdraw(jar)}
                variant="outline"
                borderColor="primary"
                color="primary"
                borderRadius="none"
                fontFamily="mono"
                fontWeight="black"
                letterSpacing="wide"
                isDisabled={allocated <= 0}
                _hover={{ bg: "muted" }}
              >
                ↑ {t("withdraw")}
              </Button>
            </HStack>
          )}

          {/* History */}
          <Box mb={3}>
            <Text
              fontSize="2xs"
              color="dim"
              fontFamily="mono"
              textTransform="uppercase"
              letterSpacing="widest"
              borderBottom="1px solid"
              borderColor="border"
              pb={1}
              mb={1}
            >
              {t("history")}
            </Text>
            {eventsLoading && events.length === 0 && (
              <HStack justify="center" py={3}>
                <Spinner size="sm" color="primary" />
              </HStack>
            )}
            {!eventsLoading && events.length === 0 && (
              <Text fontSize="xs" color="dim" fontFamily="mono" py={2} textAlign="center">
                {t("historyEmpty")}
              </Text>
            )}
            <VStack spacing={0} align="stretch">
              {events.map((event) => {
                const isOut = event.type === "withdraw";
                const amount = Number(event.amount_hbd);
                return (
                  <HStack
                    key={event.id}
                    justify="space-between"
                    py={2}
                    borderBottom="1px solid"
                    borderColor="subtle"
                    spacing={2}
                  >
                    <HStack spacing={2} minW={0}>
                      <Text fontSize="xs" color="dim" fontFamily="mono" flexShrink={0}>
                        {event.type === "create" ? "✦" : isOut ? "↑" : "↓"}
                      </Text>
                      <Text fontSize="xs" color="text" fontFamily="mono" noOfLines={1}>
                        {t(eventLabelKey(event))}
                      </Text>
                      <Text fontSize="2xs" color="dim" fontFamily="mono" flexShrink={0}>
                        · {formatDate(event.created_at)}
                      </Text>
                    </HStack>
                    {event.type !== "create" && (
                      <Text
                        fontSize="xs"
                        fontWeight="bold"
                        fontFamily="mono"
                        color={isOut ? "warning" : "success"}
                        sx={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {isOut ? "−" : "+"}
                        {amount.toFixed(3)}
                      </Text>
                    )}
                  </HStack>
                );
              })}
            </VStack>
          </Box>

          {/* Quiet meta actions */}
          {confirmingDelete ? (
            <HStack justify="center" spacing={3} py={1} flexWrap="wrap">
              <Text fontSize="2xs" color="error" fontFamily="mono" textTransform="uppercase">
                {t("deleteConfirm")}
              </Text>
              <Button
                size="xs"
                variant="link"
                color="error"
                fontFamily="mono"
                textTransform="uppercase"
                onClick={handleDelete}
                isLoading={deleting}
              >
                {t("deleteYes")}
              </Button>
              <Button
                size="xs"
                variant="link"
                color="dim"
                fontFamily="mono"
                textTransform="uppercase"
                onClick={() => setConfirmingDelete(false)}
              >
                {t("deleteNo")}
              </Button>
            </HStack>
          ) : (
            <HStack justify="center" spacing={5} py={1}>
              <Button
                size="xs"
                variant="link"
                color="dim"
                fontFamily="mono"
                textTransform="uppercase"
                textDecoration="underline"
                onClick={() => onEdit(jar)}
                _hover={{ color: "primary" }}
              >
                {t("edit")}
              </Button>
              <Button
                size="xs"
                variant="link"
                color="dim"
                fontFamily="mono"
                textTransform="uppercase"
                textDecoration="underline"
                onClick={() => setConfirmingDelete(true)}
                _hover={{ color: "error" }}
              >
                {t("delete")}
              </Button>
            </HStack>
          )}
        </Box>
      </Box>
    </SkateModal>
  );
}
