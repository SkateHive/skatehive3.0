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
} from "@chakra-ui/react";
import { useMemo } from "react";
import { useTranslations } from "@/lib/i18n/hooks";

interface ProfileDebugControlProps {
  payload?: Record<string, any> | null;
}

// Helper to render a field row
function DebugField({ label, value }: { label: string; value: any }) {
  const displayValue = value === null || value === undefined 
    ? <Text as="span" color="gray.500" fontStyle="italic">null</Text>
    : typeof value === "boolean"
    ? <Badge colorScheme={value ? "green" : "red"}>{value ? "true" : "false"}</Badge>
    : typeof value === "object"
    ? <Code fontSize="xs" whiteSpace="pre-wrap" display="block" p={2} bg="blackAlpha.300" borderRadius="sm">{JSON.stringify(value, null, 2)}</Code>
    : <Text as="span" fontFamily="mono" fontSize="sm">{String(value)}</Text>;

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

      <Modal isOpen={isOpen} onClose={onClose} size="2xl" isCentered scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent bg="background" color="text" maxH="80vh">
          <ModalHeader borderBottom="1px solid" borderColor="border">
            <HStack>
              <InfoIcon />
              <Text>{t('title')}</Text>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {payload ? (
              <Tabs variant="soft-rounded" colorScheme="green" size="sm">
                <TabList flexWrap="wrap" gap={1} pb={4}>
                  <Tab _selected={{ bg: 'primary', color: 'background' }}>{t('tabs.overview')}</Tab>
                  <Tab _selected={{ bg: 'yellow.500', color: 'black' }}>
                    {t('tabs.hive')} {hiveIdentity && <Badge ml={1} colorScheme="green" fontSize="2xs">✓</Badge>}
                  </Tab>
                  <Tab _selected={{ bg: 'blue.500', color: 'white' }}>
                    {t('tabs.evm')} {evmIdentity && <Badge ml={1} colorScheme="green" fontSize="2xs">✓</Badge>}
                  </Tab>
                  <Tab _selected={{ bg: 'purple.500', color: 'white' }}>
                    {t('tabs.farcaster')} {farcasterIdentity && <Badge ml={1} colorScheme="green" fontSize="2xs">✓</Badge>}
                  </Tab>
                  <Tab _selected={{ bg: 'gray.600', color: 'white' }}>{t('tabs.userbase')}</Tab>
                  <Tab _selected={{ bg: 'gray.600', color: 'white' }}>{t('tabs.rawJson')}</Tab>
                </TabList>

                <TabPanels>
                  {/* Overview Tab */}
                  <TabPanel px={0}>
                    <VStack align="stretch" spacing={2}>
                      <DebugSection title={t('sections.profileContext')}>
                        <DebugField label="Username" value={payload.username} />
                        <DebugField label="View Mode" value={payload.viewMode} />
                        <DebugField label="Is Hive Profile" value={payload.isHiveProfile} />
                        <DebugField label="Is Owner" value={payload.isOwner} />
                        <DebugField label="Is Userbase Owner" value={payload.isUserbaseOwner} />
                        <DebugField label="Can Show Hive Views" value={payload.canShowHiveViews} />
                      </DebugSection>

                      <DebugSection title={t('sections.handleResolution')}>
                        <DebugField label="Hive Lookup Handle" value={payload.hiveLookupHandle} />
                        <DebugField label="Hive Identity Handle" value={payload.hiveIdentityHandle} />
                        <DebugField label="Hive Posts Handle" value={payload.hivePostsHandle} />
                        <DebugField label="Userbase Match" value={payload.userbaseMatch} />
                      </DebugSection>

                      <DebugSection title={t('sections.linkedIdentitiesSummary')}>
                        <DebugField label="Hive Linked" value={!!hiveIdentity} />
                        <DebugField label="EVM Linked" value={!!evmIdentity} />
                        <DebugField label="Farcaster Linked" value={!!farcasterIdentity} />
                        <DebugField label="Total Identities" value={payload.userbaseIdentities?.length || 0} />
                      </DebugSection>
                    </VStack>
                  </TabPanel>

                  {/* Hive Tab */}
                  <TabPanel px={0}>
                    <VStack align="stretch" spacing={2}>
                      {hiveIdentity ? (
                        <>
                          <DebugSection title={t('sections.linkedHiveIdentity')}>
                            <DebugField label="Type" value={hiveIdentity.type} />
                            <DebugField label="Handle" value={hiveIdentity.handle} />
                            <DebugField label="External ID" value={hiveIdentity.external_id} />
                            <DebugField label="Address" value={hiveIdentity.address} />
                            <DebugField label="Created At" value={hiveIdentity.created_at} />
                          </DebugSection>
                        </>
                      ) : (
                        <Box p={4} bg="blackAlpha.300" borderRadius="md" textAlign="center">
                          <Text color="gray.500">{t('emptyStates.noHiveIdentity')}</Text>
                        </Box>
                      )}

                      <DebugSection title={t('sections.hiveAccountData')}>
                        <DebugField label="Account Name" value={payload.hiveAccountName} />
                        <DebugField label="Has Metadata" value={!!payload.hiveAccountMetadata} />
                      </DebugSection>

                      {payload.hiveAccountMetadata && (
                        <DebugSection title={t('sections.hiveAccountMetadata')}>
                          <DebugField label="Profile" value={payload.hiveAccountMetadata.profile} />
                        </DebugSection>
                      )}
                    </VStack>
                  </TabPanel>

                  {/* EVM Tab */}
                  <TabPanel px={0}>
                    <VStack align="stretch" spacing={2}>
                      {evmIdentity ? (
                        <>
                          <DebugSection title={t('sections.linkedEvmIdentity')}>
                            <DebugField label="Type" value={evmIdentity.type} />
                            <DebugField label="Address" value={evmIdentity.address} />
                            <DebugField label="Handle" value={evmIdentity.handle} />
                            <DebugField label="External ID" value={evmIdentity.external_id} />
                            <DebugField label="Created At" value={evmIdentity.created_at} />
                          </DebugSection>
                        </>
                      ) : (
                        <Box p={4} bg="blackAlpha.300" borderRadius="md" textAlign="center">
                          <Text color="gray.500">{t('emptyStates.noEvmIdentity')}</Text>
                        </Box>
                      )}

                      <DebugSection title={t('sections.resolvedEthereum')}>
                        <DebugField label="Resolved Address" value={payload.resolvedEthereumAddress} />
                        <DebugField label="From Profile" value={payload.profileData?.ethereum_address} />
                      </DebugSection>
                    </VStack>
                  </TabPanel>

                  {/* Farcaster Tab */}
                  <TabPanel px={0}>
                    <VStack align="stretch" spacing={2}>
                      {farcasterIdentity ? (
                        <>
                          <DebugSection title={t('sections.linkedFarcasterIdentity')}>
                            <DebugField label="Type" value={farcasterIdentity.type} />
                            <DebugField label="Handle" value={farcasterIdentity.handle} />
                            <DebugField label="FID (External ID)" value={farcasterIdentity.external_id} />
                            <DebugField label="Address" value={farcasterIdentity.address} />
                            <DebugField label="Created At" value={farcasterIdentity.created_at} />
                          </DebugSection>

                          <DebugSection title={t('sections.warpcastLink')}>
                            <DebugField 
                              label="Profile URL" 
                              value={farcasterIdentity.handle ? `https://warpcast.com/${farcasterIdentity.handle}` : null} 
                            />
                          </DebugSection>
                        </>
                      ) : (
                        <Box p={4} bg="blackAlpha.300" borderRadius="md" textAlign="center">
                          <Text color="gray.500">{t('emptyStates.noFarcasterIdentity')}</Text>
                        </Box>
                      )}
                    </VStack>
                  </TabPanel>

                  {/* Userbase Tab */}
                  <TabPanel px={0}>
                    <VStack align="stretch" spacing={2}>
                      <DebugSection title={t('sections.userbaseUser')}>
                        <DebugField label="User ID" value={payload.currentUserbaseUserId} />
                        <DebugField label="User Object" value={payload.userbaseUser} />
                      </DebugSection>

                      <DebugSection title={t('sections.allIdentities')}>
                        {payload.userbaseIdentities?.length > 0 ? (
                          payload.userbaseIdentities.map((identity: any, index: number) => (
                            <Box key={index} p={2} bg="blackAlpha.200" borderRadius="sm" mb={2}>
                              <DebugField label="Type" value={identity.type} />
                              <DebugField label="Handle" value={identity.handle} />
                              <DebugField label="Address" value={identity.address} />
                              <DebugField label="External ID" value={identity.external_id} />
                            </Box>
                          ))
                        ) : (
                          <Text color="gray.500" fontSize="sm">{t('emptyStates.noIdentities')}</Text>
                        )}
                      </DebugSection>

                      <DebugSection title={t('sections.liteProfileData')}>
                        <DebugField label="Profile" value={payload.liteProfileData} />
                      </DebugSection>
                    </VStack>
                  </TabPanel>

                  {/* Raw JSON Tab */}
                  <TabPanel px={0}>
                    <Box
                      as="pre"
                      fontSize="xs"
                      whiteSpace="pre-wrap"
                      wordBreak="break-word"
                      bg="blackAlpha.400"
                      border="1px solid"
                      borderColor="border"
                      borderRadius="md"
                      p={4}
                      maxH="50vh"
                      overflow="auto"
                      fontFamily="mono"
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
