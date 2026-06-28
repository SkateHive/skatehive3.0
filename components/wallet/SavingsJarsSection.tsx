import { useState, useCallback } from "react";
import {
  Box,
  Text,
  HStack,
  VStack,
  Button,
  Progress,
  Image,
  Spinner,
  useToast,
  Badge,
} from "@chakra-ui/react";
import { FaPlus, FaPencilAlt, FaTrash, FaLock } from "react-icons/fa";
import { useSavingsJars, type SavingsJar } from "@/hooks/wallet";
import { SavingsJarModal, JarAllocateModal, type AllocateMode } from "./modals";

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
 * Cofrinhos — virtual savings jars layered over the account's HBD savings.
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
  } = useSavingsJars();
  const toast = useToast();

  const [jarModalOpen, setJarModalOpen] = useState(false);
  const [editingJar, setEditingJar] = useState<SavingsJar | null>(null);
  const [allocOpen, setAllocOpen] = useState(false);
  const [allocJar, setAllocJar] = useState<SavingsJar | null>(null);
  const [allocMode, setAllocMode] = useState<AllocateMode>("add");

  const openCreate = () => {
    setEditingJar(null);
    setJarModalOpen(true);
  };
  const openEdit = (jar: SavingsJar) => {
    setEditingJar(jar);
    setJarModalOpen(true);
  };
  const openAllocate = (jar: SavingsJar, mode: AllocateMode) => {
    setAllocJar(jar);
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
      if (typeof window !== "undefined" && !window.confirm(`Delete "${jar.name}"? Its allocation returns to unallocated savings.`)) {
        return;
      }
      const res = await deleteJar(jar.id);
      toast({
        title: res.success ? "Jar deleted" : "Failed to delete jar",
        description: res.error,
        status: res.success ? "success" : "error",
        duration: 3000,
        isClosable: true,
      });
    },
    [deleteJar, toast]
  );

  const handleUnlock = useCallback(async () => {
    const ok = await connect();
    if (!ok) {
      toast({
        title: "Could not unlock cofrinhos",
        description: "Signature was cancelled or failed.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    }
  }, [connect, toast]);

  if (!isConnected) return null;

  return (
    <>
      <Box position="relative" border="2px solid" borderColor="primary" overflow="hidden">
        {/* Header */}
        <HStack px={3} py={2} bg="primary" justify="space-between">
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
              Cofrinhos
            </Text>
          </HStack>
          {authed && (
            <VStack spacing={0} align="end">
              <Text fontSize="xl" fontWeight="black" color="background" fontFamily="mono">
                {summary.allocated_total.toFixed(3)} HBD
              </Text>
              {hbdPrice && summary.allocated_total > 0 && (
                <Text fontSize="xs" color="background" opacity={0.75} fontFamily="mono">
                  ${(summary.allocated_total * hbdPrice).toFixed(2)} saved in jars
                </Text>
              )}
            </VStack>
          )}
        </HStack>

        {/* Body */}
        <Box px={3} py={3}>
          {/* Locked state */}
          {!authed && (
            <VStack spacing={3} py={4}>
              <Text fontSize="sm" color="dim" fontFamily="mono" textAlign="center" lineHeight="tall">
                Split your HBD savings into named goals — a new deck, a skate trip, a contest.
                Unlock once with a Hive signature (no funds move).
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
                Unlock Cofrinhos
              </Button>
            </VStack>
          )}

          {authed && (
            <>
              {/* Summary */}
              <HStack spacing={2} mb={3} align="stretch">
                <Box flex={1} p={2} bg="muted">
                  <Text fontSize="2xs" color="dim" fontFamily="mono" textTransform="uppercase">
                    Allocated
                  </Text>
                  <Text fontSize="sm" color="primary" fontWeight="bold" fontFamily="mono">
                    {summary.allocated_total.toFixed(3)}
                  </Text>
                </Box>
                <Box flex={1} p={2} bg="muted">
                  <Text fontSize="2xs" color="dim" fontFamily="mono" textTransform="uppercase">
                    Unallocated
                  </Text>
                  <Text
                    fontSize="sm"
                    color={summary.unallocated < 0 ? "red.400" : "text"}
                    fontWeight="bold"
                    fontFamily="mono"
                  >
                    {summary.unallocated.toFixed(3)}
                  </Text>
                </Box>
              </HStack>

              {summary.over_allocated && (
                <Box p={2} bg="muted" mb={3} border="1px solid" borderColor="red.400">
                  <Text color="red.400" fontSize="xs" fontFamily="mono">
                    Jars claim more than your on-chain savings. Cash-outs elsewhere may have
                    reduced your balance — adjust your jars to match.
                  </Text>
                </Box>
              )}

              {/* New jar */}
              <Button
                leftIcon={<FaPlus />}
                onClick={openCreate}
                size="sm"
                w="100%"
                mb={3}
                bg="muted"
                color="text"
                borderRadius="none"
                fontFamily="mono"
                fontWeight="bold"
                _hover={{ bg: "accent", color: "background" }}
              >
                New Jar
              </Button>

              {loading && jars.length === 0 && (
                <HStack justify="center" py={4}>
                  <Spinner size="sm" color="primary" />
                </HStack>
              )}

              {!loading && jars.length === 0 && (
                <Text fontSize="xs" color="dim" fontFamily="mono" textAlign="center" py={3}>
                  No jars yet. Create your first cofrinho above.
                </Text>
              )}

              {/* Jar list */}
              <VStack spacing={2} align="stretch">
                {jars.map((jar) => {
                  const progress = jarProgress(jar);
                  return (
                    <Box key={jar.id} p={3} bg="muted" borderLeft="4px solid" borderColor={jar.color}>
                      <HStack justify="space-between" align="start" mb={1}>
                        <HStack spacing={2}>
                          <Text fontSize="lg">{jar.icon}</Text>
                          <Box>
                            <HStack spacing={2}>
                              <Text fontSize="sm" fontWeight="bold" color="text" fontFamily="mono">
                                {jar.name}
                              </Text>
                              {jar.is_wishlist && (
                                <Badge fontSize="2xs" colorScheme="purple">goal</Badge>
                              )}
                            </HStack>
                            {jar.deadline && (
                              <Text fontSize="2xs" color="dim" fontFamily="mono">
                                by {jar.deadline}
                              </Text>
                            )}
                          </Box>
                        </HStack>
                        <Box textAlign="right">
                          <Text fontSize="sm" color="primary" fontWeight="bold" fontFamily="mono">
                            {jar.is_wishlist ? "" : Number(jar.allocated_hbd).toFixed(3)}
                            {jar.target_hbd ? ` / ${jar.target_hbd.toFixed(3)}` : ""}
                          </Text>
                          <Text fontSize="2xs" color="dim" fontFamily="mono">HBD</Text>
                        </Box>
                      </HStack>

                      {progress !== null && !jar.is_wishlist && (
                        <Progress
                          value={progress}
                          size="xs"
                          borderRadius="none"
                          mb={2}
                          sx={{ "& > div": { backgroundColor: jar.color } }}
                          bg="background"
                        />
                      )}

                      <HStack spacing={1} mt={1}>
                        {!jar.is_wishlist && (
                          <>
                            <Button size="xs" borderRadius="none" fontFamily="mono" onClick={() => openAllocate(jar, "add")} colorScheme="green" variant="outline">
                              Add
                            </Button>
                            <Button size="xs" borderRadius="none" fontFamily="mono" onClick={() => openAllocate(jar, "take")} variant="outline" colorScheme="orange" isDisabled={Number(jar.allocated_hbd) <= 0}>
                              Take out
                            </Button>
                          </>
                        )}
                        <Button size="xs" borderRadius="none" variant="ghost" onClick={() => openEdit(jar)} aria-label="Edit jar">
                          <FaPencilAlt />
                        </Button>
                        <Button size="xs" borderRadius="none" variant="ghost" colorScheme="red" onClick={() => handleDelete(jar)} aria-label="Delete jar">
                          <FaTrash />
                        </Button>
                      </HStack>
                    </Box>
                  );
                })}
              </VStack>
            </>
          )}
        </Box>
      </Box>

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
      />
    </>
  );
}
