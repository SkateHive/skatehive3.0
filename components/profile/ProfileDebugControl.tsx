"use client";

import { InfoIcon } from "@chakra-ui/icons";
import {
  Box,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Tooltip,
  useDisclosure,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Text,
  VStack,
  HStack,
  Badge,
  Code,
  Divider,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Button,
  useToast,
  Flex,
  Circle,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { useTranslations } from "@/lib/i18n/hooks";
import { FaHive, FaEthereum, FaLink, FaUnlink, FaStar, FaSync } from "react-icons/fa";
import { SiFarcaster } from "react-icons/si";

interface ProfileDebugControlProps {
  payload?: Record<string, any> | null;
}

// Helper to render a field row
function DebugField({ label, value, hideIfFalsy }: { label: string; value: any; hideIfFalsy?: boolean }) {
  // Hide field if hideIfFalsy is true and value is falsy
  if (hideIfFalsy && !value) {
    return null;
  }

  const displayValue = value === null || value === undefined
    ? <Text as="span" color="gray.600" fontStyle="italic" fontSize="xs">not set</Text>
    : typeof value === "boolean"
    ? <Badge colorScheme={value ? "green" : "gray"} fontSize="2xs">{value ? "✓ YES" : "✗ NO"}</Badge>
    : typeof value === "object"
    ? <Code fontSize="xs" whiteSpace="pre-wrap" display="block" p={2} bg="blackAlpha.300" borderRadius="sm">{JSON.stringify(value, null, 2)}</Code>
    : <Text as="span" fontFamily="mono" fontSize="sm" color="text">{String(value)}</Text>;

  return (
    <HStack justify="space-between" align="flex-start" w="100%" py={1}>
      <Text fontSize="sm" color="gray.400" minW="140px">{label}</Text>
      <Box flex="1" textAlign="right">{displayValue}</Box>
    </HStack>
  );
}

// Section component for organizing fields
function DebugSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <VStack align="stretch" spacing={1} w="100%">
      <Text fontSize="xs" color="primary" fontWeight="bold" textTransform="uppercase" mb={1}>
        {title}
      </Text>
      {children}
      <Divider borderColor="whiteAlpha.200" my={2} />
    </VStack>
  );
}

export default function ProfileDebugControl({
  payload,
}: ProfileDebugControlProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const t = useTranslations("profileDebug");
  const toast = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Extract identity data for tabs
  const hiveIdentity = useMemo(() => {
    if (!payload) return null;
    const identities = payload.userbaseIdentities || [];
    return identities.find((i: any) => i.type === "hive") || null;
  }, [payload]);

  const evmIdentity = useMemo(() => {
    if (!payload) return null;
    const identities = payload.userbaseIdentities || [];
    return identities.find((i: any) => i.type === "evm") || null;
  }, [payload]);

  const farcasterIdentity = useMemo(() => {
    if (!payload) return null;
    const identities = payload.userbaseIdentities || [];
    return identities.find((i: any) => i.type === "farcaster") || null;
  }, [payload]);

  // Determine connection states
  const hiveConnected = !!payload?.hiveAccountName;
  const evmConnected = !!payload?.resolvedEthereumAddress;
  const farcasterConnected = !!farcasterIdentity;

  // Quick action handlers
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Trigger a refresh by reloading the page or calling a refresh API
      window.location.reload();
    } catch (error) {
      toast({
        title: "Refresh failed",
        status: "error",
        duration: 3000,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleUnlink = async (identityId: string, type: string) => {
    try {
      const response = await fetch("/api/userbase/identities", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: identityId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unlink failed");
      }
      toast({
        title: `${type} identity unlinked`,
        status: "success",
        duration: 3000,
      });
      setTimeout(() => window.location.reload(), 500);
    } catch (error: any) {
      toast({
        title: "Unlink failed",
        description: error?.message,
        status: "error",
        duration: 3000,
      });
    }
  };

  return (
    <>
      <Tooltip label={t('open')} placement="top">
        <IconButton
          aria-label={t('open')}
          icon={<InfoIcon />}
          size="xs"
          variant="ghost"
          color="primary"
          borderRadius="none"
          border="1px solid"
          borderColor="whiteAlpha.300"
          bg="whiteAlpha.200"
          _hover={{ borderColor: 'primary', bg: 'whiteAlpha.300' }}
          onClick={onOpen}
        />
      </Tooltip>

      <Modal isOpen={isOpen} onClose={onClose} size="6xl" isCentered scrollBehavior="inside">
        <ModalOverlay bg="blackAlpha.800" backdropFilter="blur(10px)" />
        <ModalContent bg="background" color="text" maxH="90vh" borderRadius="none" border="2px solid" borderColor="primary">
          <ModalHeader borderBottom="2px solid" borderColor="primary" bg="blackAlpha.400">
            <HStack justify="space-between">
              <HStack>
                <InfoIcon color="primary" />
                <Text fontFamily="mono" textTransform="uppercase" letterSpacing="wider" fontSize="md">
                  {t('title')} - Identity Manager
                </Text>
              </HStack>
              <Button
                size="xs"
                leftIcon={<FaSync />}
                onClick={handleRefresh}
                isLoading={isRefreshing}
                variant="ghost"
                fontFamily="mono"
                color="primary"
                _hover={{ bg: "whiteAlpha.200" }}
              >
                refresh
              </Button>
            </HStack>
          </ModalHeader>
          <ModalCloseButton color="primary" _hover={{ bg: "whiteAlpha.200" }} />
          <ModalBody pb={6} px={6}>
            {payload ? (
              <Tabs variant="line" colorScheme="green" size="sm">
                <TabList borderBottom="2px solid" borderColor="whiteAlpha.200">
                  <Tab
                    _selected={{ color: 'primary', borderColor: 'primary', borderBottomWidth: '2px' }}
                    fontFamily="mono"
                    textTransform="uppercase"
                    fontSize="xs"
                    letterSpacing="wider"
                  >
                    Comparative View
                  </Tab>
                  <Tab
                    _selected={{ color: 'primary', borderColor: 'primary', borderBottomWidth: '2px' }}
                    fontFamily="mono"
                    textTransform="uppercase"
                    fontSize="xs"
                    letterSpacing="wider"
                  >
                    Context Data
                  </Tab>
                  <Tab
                    _selected={{ color: 'gray.400', borderColor: 'gray.400', borderBottomWidth: '2px' }}
                    fontFamily="mono"
                    textTransform="uppercase"
                    fontSize="xs"
                    letterSpacing="wider"
                  >
                    Raw JSON
                  </Tab>
                </TabList>

                <TabPanels>
                  {/* Comparative View Tab */}
                  <TabPanel px={0} py={4}>
                    <Box overflowX="auto">
                      <Table variant="simple" size="sm">
                        <Thead>
                          <Tr bg="blackAlpha.400">
                            <Th
                              color="gray.400"
                              fontFamily="mono"
                              textTransform="uppercase"
                              fontSize="xs"
                              borderColor="whiteAlpha.200"
                            >
                              Identity Type
                            </Th>
                            <Th
                              color="gray.400"
                              fontFamily="mono"
                              textTransform="uppercase"
                              fontSize="xs"
                              borderColor="whiteAlpha.200"
                            >
                              Status
                            </Th>
                            <Th
                              color="gray.400"
                              fontFamily="mono"
                              textTransform="uppercase"
                              fontSize="xs"
                              borderColor="whiteAlpha.200"
                            >
                              Handle / Address
                            </Th>
                            <Th
                              color="gray.400"
                              fontFamily="mono"
                              textTransform="uppercase"
                              fontSize="xs"
                              borderColor="whiteAlpha.200"
                            >
                              Linked
                            </Th>
                            <Th
                              color="gray.400"
                              fontFamily="mono"
                              textTransform="uppercase"
                              fontSize="xs"
                              borderColor="whiteAlpha.200"
                            >
                              Connected
                            </Th>
                            <Th
                              color="gray.400"
                              fontFamily="mono"
                              textTransform="uppercase"
                              fontSize="xs"
                              borderColor="whiteAlpha.200"
                            >
                              External ID
                            </Th>
                            <Th
                              color="gray.400"
                              fontFamily="mono"
                              textTransform="uppercase"
                              fontSize="xs"
                              borderColor="whiteAlpha.200"
                              textAlign="right"
                            >
                              Actions
                            </Th>
                          </Tr>
                        </Thead>
                        <Tbody fontFamily="mono" fontSize="xs">
                          {/* Hive Row */}
                          <Tr
                            bg={hiveIdentity ? "whiteAlpha.50" : "transparent"}
                            _hover={{ bg: "whiteAlpha.100" }}
                            borderBottom="1px solid"
                            borderColor="whiteAlpha.100"
                          >
                            <Td borderColor="whiteAlpha.100">
                              <HStack spacing={2}>
                                <FaHive color="#E31337" size={16} />
                                <Text color="red.400" fontWeight="bold">HIVE</Text>
                              </HStack>
                            </Td>
                            <Td borderColor="whiteAlpha.100">
                              <HStack spacing={2}>
                                <Circle
                                  size="8px"
                                  bg={hiveIdentity && hiveConnected ? "green.400" : hiveIdentity ? "yellow.400" : "gray.600"}
                                />
                                <Text color={hiveIdentity && hiveConnected ? "green.400" : hiveIdentity ? "yellow.400" : "gray.500"}>
                                  {hiveIdentity && hiveConnected ? "active" : hiveIdentity ? "linked" : "not linked"}
                                </Text>
                              </HStack>
                            </Td>
                            <Td borderColor="whiteAlpha.100">
                              <Text color="text">
                                {hiveIdentity?.handle || payload.hiveAccountName || payload.hiveLookupHandle || "-"}
                              </Text>
                            </Td>
                            <Td borderColor="whiteAlpha.100">
                              <Badge colorScheme={hiveIdentity ? "green" : "gray"} fontSize="2xs">
                                {hiveIdentity ? "YES" : "NO"}
                              </Badge>
                            </Td>
                            <Td borderColor="whiteAlpha.100">
                              <Badge colorScheme={hiveConnected ? "green" : "gray"} fontSize="2xs">
                                {hiveConnected ? "YES" : "NO"}
                              </Badge>
                            </Td>
                            <Td borderColor="whiteAlpha.100">
                              <Text color="gray.500">{hiveIdentity?.external_id || "-"}</Text>
                            </Td>
                            <Td borderColor="whiteAlpha.100" textAlign="right">
                              {hiveIdentity ? (
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  colorScheme="red"
                                  leftIcon={<FaUnlink />}
                                  onClick={() => handleUnlink(hiveIdentity.id, "Hive")}
                                  fontFamily="mono"
                                >
                                  unlink
                                </Button>
                              ) : (
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  colorScheme="green"
                                  leftIcon={<FaLink />}
                                  fontFamily="mono"
                                  isDisabled
                                >
                                  link
                                </Button>
                              )}
                            </Td>
                          </Tr>

                          {/* EVM Row */}
                          <Tr
                            bg={evmIdentity ? "whiteAlpha.50" : "transparent"}
                            _hover={{ bg: "whiteAlpha.100" }}
                            borderBottom="1px solid"
                            borderColor="whiteAlpha.100"
                          >
                            <Td borderColor="whiteAlpha.100">
                              <HStack spacing={2}>
                                <FaEthereum color="#627EEA" size={16} />
                                <Text color="blue.400" fontWeight="bold">ETHEREUM</Text>
                              </HStack>
                            </Td>
                            <Td borderColor="whiteAlpha.100">
                              <HStack spacing={2}>
                                <Circle
                                  size="8px"
                                  bg={evmIdentity && evmConnected ? "green.400" : evmIdentity ? "yellow.400" : "gray.600"}
                                />
                                <Text color={evmIdentity && evmConnected ? "green.400" : evmIdentity ? "yellow.400" : "gray.500"}>
                                  {evmIdentity && evmConnected ? "active" : evmIdentity ? "linked" : "not linked"}
                                </Text>
                              </HStack>
                            </Td>
                            <Td borderColor="whiteAlpha.100">
                              <Text color="text" fontSize="2xs">
                                {evmIdentity?.address || payload.resolvedEthereumAddress || "-"}
                              </Text>
                            </Td>
                            <Td borderColor="whiteAlpha.100">
                              <Badge colorScheme={evmIdentity ? "green" : "gray"} fontSize="2xs">
                                {evmIdentity ? "YES" : "NO"}
                              </Badge>
                            </Td>
                            <Td borderColor="whiteAlpha.100">
                              <Badge colorScheme={evmConnected ? "green" : "gray"} fontSize="2xs">
                                {evmConnected ? "YES" : "NO"}
                              </Badge>
                            </Td>
                            <Td borderColor="whiteAlpha.100">
                              <Text color="gray.500">{evmIdentity?.external_id || "-"}</Text>
                            </Td>
                            <Td borderColor="whiteAlpha.100" textAlign="right">
                              {evmIdentity ? (
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  colorScheme="red"
                                  leftIcon={<FaUnlink />}
                                  onClick={() => handleUnlink(evmIdentity.id, "EVM")}
                                  fontFamily="mono"
                                >
                                  unlink
                                </Button>
                              ) : (
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  colorScheme="green"
                                  leftIcon={<FaLink />}
                                  fontFamily="mono"
                                  isDisabled
                                >
                                  link
                                </Button>
                              )}
                            </Td>
                          </Tr>

                          {/* Farcaster Row */}
                          <Tr
                            bg={farcasterIdentity ? "whiteAlpha.50" : "transparent"}
                            _hover={{ bg: "whiteAlpha.100" }}
                            borderBottom="1px solid"
                            borderColor="whiteAlpha.100"
                          >
                            <Td borderColor="whiteAlpha.100">
                              <HStack spacing={2}>
                                <SiFarcaster color="#8A63D2" size={16} />
                                <Text color="purple.400" fontWeight="bold">FARCASTER</Text>
                              </HStack>
                            </Td>
                            <Td borderColor="whiteAlpha.100">
                              <HStack spacing={2}>
                                <Circle
                                  size="8px"
                                  bg={farcasterIdentity && farcasterConnected ? "green.400" : farcasterIdentity ? "yellow.400" : "gray.600"}
                                />
                                <Text color={farcasterIdentity && farcasterConnected ? "green.400" : farcasterIdentity ? "yellow.400" : "gray.500"}>
                                  {farcasterIdentity && farcasterConnected ? "active" : farcasterIdentity ? "linked" : "not linked"}
                                </Text>
                              </HStack>
                            </Td>
                            <Td borderColor="whiteAlpha.100">
                              <Text color="text">
                                {farcasterIdentity?.handle ? `@${farcasterIdentity.handle}` : "-"}
                              </Text>
                            </Td>
                            <Td borderColor="whiteAlpha.100">
                              <Badge colorScheme={farcasterIdentity ? "green" : "gray"} fontSize="2xs">
                                {farcasterIdentity ? "YES" : "NO"}
                              </Badge>
                            </Td>
                            <Td borderColor="whiteAlpha.100">
                              <Badge colorScheme={farcasterConnected ? "green" : "gray"} fontSize="2xs">
                                {farcasterConnected ? "YES" : "NO"}
                              </Badge>
                            </Td>
                            <Td borderColor="whiteAlpha.100">
                              <Text color="gray.500">
                                {farcasterIdentity?.external_id ? `FID: ${farcasterIdentity.external_id}` : "-"}
                              </Text>
                            </Td>
                            <Td borderColor="whiteAlpha.100" textAlign="right">
                              {farcasterIdentity ? (
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  colorScheme="red"
                                  leftIcon={<FaUnlink />}
                                  onClick={() => handleUnlink(farcasterIdentity.id, "Farcaster")}
                                  fontFamily="mono"
                                >
                                  unlink
                                </Button>
                              ) : (
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  colorScheme="green"
                                  leftIcon={<FaLink />}
                                  fontFamily="mono"
                                  isDisabled
                                >
                                  link
                                </Button>
                              )}
                            </Td>
                          </Tr>
                        </Tbody>
                      </Table>
                    </Box>

                    {/* Data Sources Info */}
                    <Box mt={6} p={4} bg="rgba(26, 54, 93, 0.2)" border="1px solid" borderColor="blue.700" borderLeft="4px solid" borderLeftColor="blue.400">
                      <Text fontFamily="mono" fontSize="xs" color="blue.300" fontWeight="bold" mb={2} textTransform="uppercase">
                        📊 Data Source Priority
                      </Text>
                      <VStack align="stretch" spacing={1} fontSize="xs" color="gray.300" fontFamily="mono">
                        <Text>• <Text as="span" color="blue.300">App Account:</Text> Display name, avatar, bio from userbase_users table</Text>
                        <Text>• <Text as="span" color="red.300">Hive User:</Text> Posts, voting power, followers from Hive blockchain</Text>
                        <Text>• <Text as="span" color="purple.300">Farcaster:</Text> Social profile from linked Farcaster identity metadata</Text>
                        <Text fontWeight="bold" mt={1}>• <Text as="span" color="blue.400">EVM Address Priority:</Text></Text>
                        <Text pl={3}>1. Hive metadata wallets (user's actual wallets)</Text>
                        <Text pl={3}>2. Farcaster verified wallets</Text>
                        <Text pl={3}>3. Farcaster custody address (registration only)</Text>
                        <Text pl={3}>4. Legacy Hive profile ethereum_address</Text>
                      </VStack>
                    </Box>

                    {/* Summary Cards Below Table */}
                    <Flex gap={4} mt={4} wrap="wrap">
                      <Box
                        flex="1"
                        minW="250px"
                        bg="blackAlpha.300"
                        border="1px solid"
                        borderColor="whiteAlpha.200"
                        p={4}
                      >
                        <Text fontFamily="mono" fontSize="xs" color="gray.400" mb={2} textTransform="uppercase">
                          Profile Context
                        </Text>
                        <VStack align="stretch" spacing={1}>
                          <DebugField label="Username" value={payload.username} />
                          <DebugField label="View Mode" value={payload.viewMode} />
                          <DebugField label="You Own This" value={payload.isOwner} />
                          <DebugField label="Userbase Owner" value={payload.isUserbaseOwner} />
                        </VStack>
                      </Box>

                      <Box
                        flex="1"
                        minW="250px"
                        bg="blackAlpha.300"
                        border="1px solid"
                        borderColor="whiteAlpha.200"
                        p={4}
                      >
                        <Text fontFamily="mono" fontSize="xs" color="gray.400" mb={2} textTransform="uppercase">
                          Handle Resolution
                        </Text>
                        <VStack align="stretch" spacing={1}>
                          <DebugField label="Hive Lookup" value={payload.hiveLookupHandle} />
                          <DebugField label="Hive Identity" value={payload.hiveIdentityHandle} />
                          <DebugField label="Hive Posts" value={payload.hivePostsHandle} />
                          <DebugField label="Userbase Match" value={payload.userbaseMatch} />
                        </VStack>
                      </Box>

                      <Box
                        flex="1"
                        minW="250px"
                        bg="blackAlpha.300"
                        border="1px solid"
                        borderColor="whiteAlpha.200"
                        p={4}
                      >
                        <Text fontFamily="mono" fontSize="xs" color="gray.400" mb={2} textTransform="uppercase">
                          Identity Summary
                        </Text>
                        <VStack align="stretch" spacing={1}>
                          <DebugField label="Linked Identities" value={payload.userbaseIdentities?.length || 0} />
                          <DebugField label="Has Hive Profile" value={payload.isHiveProfile} />
                          <DebugField label="Can Post to Hive" value={payload.canShowHiveViews} />
                          <DebugField label="App User ID" value={payload.currentUserbaseUserId} hideIfFalsy />
                        </VStack>
                      </Box>
                    </Flex>
                  </TabPanel>

                  {/* Context Data Tab - Consolidated old tabs */}
                  <TabPanel px={0} py={4}>

                    <VStack align="stretch" spacing={4}>
                      {/* Hive Section */}
                      <Box
                        bg="blackAlpha.300"
                        border="1px solid"
                        borderColor="red.900"
                        borderLeft="4px solid"
                        borderLeftColor="red.400"
                        p={4}
                      >
                        <HStack mb={3}>
                          <FaHive color="#E31337" size={20} />
                          <Text fontFamily="mono" fontSize="sm" color="red.400" fontWeight="bold" textTransform="uppercase">
                            Hive Identity Data
                          </Text>
                        </HStack>
                        {hiveIdentity ? (
                          <VStack align="stretch" spacing={2}>
                            <DebugField label="Type" value={hiveIdentity.type} />
                            <DebugField label="Handle" value={hiveIdentity.handle} />
                            <DebugField label="External ID" value={hiveIdentity.external_id} />
                            <DebugField label="Address" value={hiveIdentity.address} />
                            <DebugField label="Created At" value={hiveIdentity.created_at} />
                            <Divider borderColor="whiteAlpha.200" my={2} />
                            <DebugField label="Account Name" value={payload.hiveAccountName} />
                            <DebugField label="Has Metadata" value={!!payload.hiveAccountMetadata} />
                            {payload.hiveAccountMetadata && (
                              <DebugField label="Metadata" value={payload.hiveAccountMetadata} />
                            )}
                          </VStack>
                        ) : (
                          <Text color="gray.500" fontSize="sm">No Hive identity linked</Text>
                        )}
                      </Box>

                      {/* EVM Section */}
                      <Box
                        bg="blackAlpha.300"
                        border="1px solid"
                        borderColor="blue.900"
                        borderLeft="4px solid"
                        borderLeftColor="blue.400"
                        p={4}
                      >
                        <HStack mb={3}>
                          <FaEthereum color="#627EEA" size={20} />
                          <Text fontFamily="mono" fontSize="sm" color="blue.400" fontWeight="bold" textTransform="uppercase">
                            EVM Identity Data
                          </Text>
                        </HStack>
                        {evmIdentity ? (
                          <VStack align="stretch" spacing={2}>
                            <DebugField label="Type" value={evmIdentity.type} />
                            <DebugField label="Address" value={evmIdentity.address} />
                            <DebugField label="Handle" value={evmIdentity.handle} />
                            <DebugField label="External ID" value={evmIdentity.external_id} />
                            <DebugField label="Created At" value={evmIdentity.created_at} />
                            <Divider borderColor="whiteAlpha.200" my={2} />
                            <DebugField label="Resolved Address" value={payload.resolvedEthereumAddress} />
                            <DebugField label="From Profile" value={payload.profileData?.ethereum_address} />
                          </VStack>
                        ) : (
                          <Text color="gray.500" fontSize="sm">No EVM identity linked</Text>
                        )}
                      </Box>

                      {/* Farcaster Section */}
                      <Box
                        bg="blackAlpha.300"
                        border="1px solid"
                        borderColor="purple.900"
                        borderLeft="4px solid"
                        borderLeftColor="purple.400"
                        p={4}
                      >
                        <HStack mb={3}>
                          <SiFarcaster color="#8A63D2" size={20} />
                          <Text fontFamily="mono" fontSize="sm" color="purple.400" fontWeight="bold" textTransform="uppercase">
                            Farcaster Identity Data
                          </Text>
                        </HStack>
                        {farcasterIdentity ? (
                          <VStack align="stretch" spacing={2}>
                            <DebugField label="Type" value={farcasterIdentity.type} />
                            <DebugField label="Handle" value={farcasterIdentity.handle} />
                            <DebugField label="FID (External ID)" value={farcasterIdentity.external_id} />
                            <DebugField label="Address" value={farcasterIdentity.address} />
                            <DebugField label="Created At" value={farcasterIdentity.created_at} />
                            <Divider borderColor="whiteAlpha.200" my={2} />
                            <DebugField
                              label="Warpcast URL"
                              value={farcasterIdentity.handle ? `https://warpcast.com/${farcasterIdentity.handle}` : null}
                            />
                          </VStack>
                        ) : (
                          <Text color="gray.500" fontSize="sm">No Farcaster identity linked</Text>
                        )}
                      </Box>

                      {/* Userbase Section */}
                      <Box
                        bg="blackAlpha.300"
                        border="1px solid"
                        borderColor="green.900"
                        borderLeft="4px solid"
                        borderLeftColor="primary"
                        p={4}
                      >
                        <HStack mb={3}>
                          <FaStar color="#9AE419" size={16} />
                          <Text fontFamily="mono" fontSize="sm" color="primary" fontWeight="bold" textTransform="uppercase">
                            Userbase Data
                          </Text>
                        </HStack>
                        <VStack align="stretch" spacing={2}>
                          <DebugField label="User ID" value={payload.currentUserbaseUserId} />
                          <DebugField label="User Object" value={payload.userbaseUser} />
                          <Divider borderColor="whiteAlpha.200" my={2} />
                          <DebugField label="Lite Profile" value={payload.liteProfileData} />
                          <Divider borderColor="whiteAlpha.200" my={2} />
                          <Text fontSize="xs" color="gray.400" fontWeight="bold" mb={1}>All Identities:</Text>
                          {payload.userbaseIdentities?.length > 0 ? (
                            payload.userbaseIdentities.map((identity: any, index: number) => (
                              <Box key={index} p={2} bg="blackAlpha.400" borderRadius="sm" mb={1}>
                                <DebugField label="Type" value={identity.type} />
                                <DebugField label="Handle" value={identity.handle} />
                                <DebugField label="Address" value={identity.address} />
                                <DebugField label="External ID" value={identity.external_id} />
                              </Box>
                            ))
                          ) : (
                            <Text color="gray.500" fontSize="sm">No identities found</Text>
                          )}
                        </VStack>
                      </Box>
                    </VStack>
                  </TabPanel>

                  {/* Raw JSON Tab */}
                  <TabPanel px={0} py={4}>
                    <Box
                      as="pre"
                      fontSize="xs"
                      whiteSpace="pre-wrap"
                      wordBreak="break-word"
                      bg="blackAlpha.600"
                      border="2px solid"
                      borderColor="whiteAlpha.200"
                      p={6}
                      maxH="65vh"
                      overflow="auto"
                      fontFamily="mono"
                      color="green.300"
                      sx={{
                        '&::-webkit-scrollbar': {
                          width: '8px',
                          height: '8px',
                        },
                        '&::-webkit-scrollbar-track': {
                          bg: 'blackAlpha.400',
                        },
                        '&::-webkit-scrollbar-thumb': {
                          bg: 'primary',
                          borderRadius: 'none',
                        },
                      }}
                    >
                      {JSON.stringify(payload, null, 2)}
                    </Box>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            ) : (
              <Box color="dim" fontSize="sm">
                {t('empty')}
              </Box>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
