import { useCallback, useMemo, useState } from "react";
import {
  Box,
  Text,
  HStack,
  VStack,
  Button,
  Spinner,
  useToast,
  Badge,
  SimpleGrid,
} from "@chakra-ui/react";
import { FaPlus, FaLock } from "react-icons/fa";
import { useSavingsJars, type SavingsJar } from "@/hooks/wallet";
import { useTranslations } from "@/contexts/LocaleContext";
import { tVars } from "@/lib/i18n/format";
import {
  SavingsJarModal,
  JarAllocateModal,
  JarDetailModal,
  JarCelebration,
  type AllocateMode,
} from "./modals";

interface SavingsJarsSectionProps {
  /** Liquid wallet HBD balance (string like "12.345" or "N/A"). */
  hbdBalance: string;
  hbdPrice: number | null;
}

function jarProgress(jar: SavingsJar): number | null {
  if (!jar.target_hbd || jar.target_hbd <= 0) return null;
  return Math.min(100, (Number(jar.allocated_hbd) / jar.target_hbd) * 100);
}

/**
 * Cofrinhos — virtual savings jars layered over the account's HBD savings,
 * presented Nubank-Caixinhas-style: cover cards with progress, a per-jar
 * detail screen, and guided save/withdraw flows.
 * See docs/COFRINHOS_SAVINGS_JARS_CONCEPT.md
 */
export default function SavingsJarsSection({ hbdBalance, hbdPrice }: SavingsJarsSectionProps) {
  const {
    jars,
    summary,
    authed,
    loading,
    unlocking,
    isConnected,
    connect,
    createJar,
    updateJar,
    deleteJar,
    allocate,
    fundFromWallet,
    withdrawToWallet,
    fetchEvents,
  } = useSavingsJars();
  const t = useTranslations("cofrinhos");
  const toast = useToast();

  const [jarModalOpen, setJarModalOpen] = useState(false);
  const [editingJar, setEditingJar] = useState<SavingsJar | null>(null);
  const [allocOpen, setAllocOpen] = useState(false);
  const [allocJarId, setAllocJarId] = useState<string | null>(null);
  const [allocMode, setAllocMode] = useState<AllocateMode>("add");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [celebrationJar, setCelebrationJar] = useState<SavingsJar | null>(null);

  // Derive from the live list so modals stay fresh after refreshes.
  const detailJar = useMemo(
    () => jars.find((jar) => jar.id === detailId) ?? null,
    [jars, detailId]
  );
  const allocJar = useMemo(
    () => jars.find((jar) => jar.id === allocJarId) ?? null,
    [jars, allocJarId]
  );

  const openCreate = () => {
    setEditingJar(null);
    setJarModalOpen(true);
  };
  const openEdit = (jar: SavingsJar) => {
    setEditingJar(jar);
    setJarModalOpen(true);
  };
  const openAllocate = (jar: SavingsJar, mode: AllocateMode) => {
    setAllocJarId(jar.id);
    setAllocMode(mode);
    setAllocOpen(true);
  };

  const handleSave = useCallback(
    (input: Parameters<typeof createJar>[0]) =>
      editingJar ? updateJar(editingJar.id, input) : createJar(input),
    [editingJar, createJar, updateJar]
  );

  const handleDelete = useCallback(
    async (jar: SavingsJar) => {
      const res = await deleteJar(jar.id);
      toast({
        title: res.success ? t("deletedToast") : res.error,
        status: res.success ? "success" : "error",
        duration: 3500,
        isClosable: true,
      });
      if (res.success) setDetailId(null);
    },
    [deleteJar, toast, t]
  );

  const handleUnlock = useCallback(async () => {
    const ok = await connect();
    if (!ok) {
      toast({
        title: t("unlockFailedTitle"),
        description: t("unlockFailedDesc"),
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    }
  }, [connect, toast, t]);

  if (!isConnected) return null;

  const totalUsd =
    hbdPrice && summary.allocated_total > 0
      ? (summary.allocated_total * hbdPrice).toFixed(2)
      : null;

  return (
    <>
      <Box position="relative" border="2px solid" borderColor="primary" overflow="hidden">
        {/* Header */}
        <HStack px={3} py={2} bg="primary" justify="space-between" align="center">
          <HStack spacing={2}>
            <Text fontSize="lg">🐷</Text>
            <Text
              fontWeight="black"
              fontSize="sm"
              color="background"
              textTransform="uppercase"
              letterSpacing="widest"
              fontFamily="mono"
            >
              {t("title")}
            </Text>
          </HStack>
          {authed && (
            <VStack spacing={0} align="end">
              <Text
                fontSize="xl"
                fontWeight="black"
                color="background"
                fontFamily="mono"
                lineHeight={1.2}
                sx={{ fontVariantNumeric: "tabular-nums" }}
              >
                {summary.allocated_total.toFixed(3)} HBD
              </Text>
              <Text fontSize="2xs" color="background" opacity={0.75} fontFamily="mono" textTransform="uppercase">
                {totalUsd ? `$${totalUsd} · ` : ""}
                {t("savedInGoals")}
              </Text>
            </VStack>
          )}
        </HStack>

        {/* Body */}
        <Box px={3} py={3}>
          {/* Locked state */}
          {!authed && (
            <VStack spacing={3} py={4}>
              <Text fontSize="sm" color="dim" fontFamily="mono" textAlign="center" lineHeight="tall">
                {t("unlockTitle")}
              </Text>
              <Button
                leftIcon={<FaLock />}
                onClick={handleUnlock}
                isLoading={unlocking}
                bg="primary"
                color="background"
                borderRadius="none"
                fontFamily="mono"
                fontWeight="black"
                letterSpacing="wide"
                _hover={{ bg: "accent" }}
              >
                {t("unlockCta")}
              </Button>
            </VStack>
          )}

          {authed && (
            <>
              <Text fontSize="xs" color="dim" fontFamily="mono" mb={3} lineHeight="tall">
                {tVars(t("freeSavings"), {
                  amount: Math.max(0, summary.unallocated).toFixed(3),
                })}
              </Text>

              {summary.over_allocated && (
                <Box p={2} bg="muted" mb={3} borderLeft="3px solid" borderColor="error">
                  <Text color="error" fontSize="xs" fontFamily="mono" lineHeight="tall">
                    {t("overAllocated")}
                  </Text>
                </Box>
              )}

              {loading && jars.length === 0 && (
                <HStack justify="center" py={4}>
                  <Spinner size="sm" color="primary" />
                </HStack>
              )}

              {!loading && jars.length === 0 && (
                <Text fontSize="xs" color="dim" fontFamily="mono" textAlign="center" pb={3}>
                  {t("empty")}
                </Text>
              )}

              {/* Cover cards */}
              <SimpleGrid columns={2} spacing={2.5}>
                {jars.map((jar) => {
                  const progress = jarProgress(jar);
                  const done = progress !== null && progress >= 100;
                  return (
                    <Button
                      key={jar.id}
                      onClick={() => setDetailId(jar.id)}
                      variant="unstyled"
                      h="auto"
                      minH="112px"
                      p={2.5}
                      bg="panel"
                      border="1px solid"
                      borderColor="border"
                      borderTop="3px solid"
                      borderTopColor={jar.color}
                      borderRadius="none"
                      display="flex"
                      flexDirection="column"
                      alignItems="flex-start"
                      gap={1.5}
                      whiteSpace="normal"
                      textAlign="left"
                      position="relative"
                      transition="border-color .15s, transform .15s"
                      _hover={{ borderColor: jar.color, transform: "translateY(-2px)" }}
                      aria-label={jar.name}
                    >
                      {done && (
                        <Badge
                          position="absolute"
                          top={1.5}
                          right={1.5}
                          fontSize="2xs"
                          bg={jar.color}
                          color="background"
                          borderRadius="none"
                          textTransform="uppercase"
                        >
                          {t("goalReached")}
                        </Badge>
                      )}
                      {jar.is_wishlist && !done && (
                        <Badge
                          position="absolute"
                          top={1.5}
                          right={1.5}
                          fontSize="2xs"
                          colorScheme="purple"
                        >
                          {t("wishlistBadge")}
                        </Badge>
                      )}
                      <Text fontSize="xl" lineHeight={1}>
                        {jar.icon}
                      </Text>
                      <Text fontSize="xs" fontWeight="bold" color="text" fontFamily="mono" noOfLines={2}>
                        {jar.name}
                      </Text>
                      <Text
                        fontSize="sm"
                        fontWeight="black"
                        fontFamily="mono"
                        color={jar.color}
                        mt="auto"
                        sx={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {jar.is_wishlist ? "" : Number(jar.allocated_hbd).toFixed(3)}
                        {jar.target_hbd ? (
                          <Text as="span" fontSize="2xs" color="dim" fontWeight="normal">
                            {jar.is_wishlist ? "" : " / "}
                            {jar.target_hbd.toFixed(3)} HBD
                          </Text>
                        ) : (
                          <Text as="span" fontSize="2xs" color="dim" fontWeight="normal">
                            {" "}
                            HBD
                          </Text>
                        )}
                      </Text>
                      {progress !== null && !jar.is_wishlist && (
                        <Box w="100%" h="4px" bg="background" position="relative" overflow="hidden">
                          <Box
                            position="absolute"
                            left={0}
                            top={0}
                            bottom={0}
                            w={`${progress}%`}
                            bg={jar.color}
                            transition="width .4s ease"
                          />
                        </Box>
                      )}
                    </Button>
                  );
                })}

                {/* New jar */}
                <Button
                  onClick={openCreate}
                  variant="unstyled"
                  h="auto"
                  minH="112px"
                  border="1px dashed"
                  borderColor="dim"
                  borderRadius="none"
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                  justifyContent="center"
                  gap={1.5}
                  color="dim"
                  transition="color .15s, border-color .15s"
                  _hover={{ color: "primary", borderColor: "primary" }}
                >
                  <FaPlus />
                  <Text
                    fontSize="2xs"
                    fontFamily="mono"
                    textTransform="uppercase"
                    letterSpacing="widest"
                    textAlign="center"
                  >
                    {t("newJar")}
                  </Text>
                </Button>
              </SimpleGrid>
            </>
          )}
        </Box>
      </Box>

      <JarDetailModal
        isOpen={!!detailJar}
        onClose={() => setDetailId(null)}
        jar={detailJar}
        fetchEvents={fetchEvents}
        onSave={(jar) => openAllocate(jar, "add")}
        onWithdraw={(jar) => openAllocate(jar, "take")}
        onEdit={openEdit}
        onDelete={handleDelete}
      />
      <SavingsJarModal
        isOpen={jarModalOpen}
        onClose={() => setJarModalOpen(false)}
        jar={editingJar}
        onSave={handleSave}
      />
      <JarAllocateModal
        isOpen={allocOpen}
        onClose={() => setAllocOpen(false)}
        jar={allocJar}
        mode={allocMode}
        unallocated={summary.unallocated}
        walletHbd={hbdBalance === "N/A" ? "0" : hbdBalance}
        allocate={allocate}
        fundFromWallet={fundFromWallet}
        withdrawToWallet={withdrawToWallet}
        onGoalReached={setCelebrationJar}
        onDone={(message) =>
          toast({ title: message, status: "success", duration: 3000, isClosable: true })
        }
      />
      <JarCelebration jar={celebrationJar} onClose={() => setCelebrationJar(null)} />
    </>
  );
}
