'use client';

import { useState } from 'react';
import {
  Box,
  Container,
  HStack,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Text,
  Badge,
  Button,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from '@chakra-ui/react';
import Image from 'next/image';
import { useTranslations } from '@/lib/i18n/hooks';
import useIsMobile from '@/hooks/useIsMobile';
import SkateModal from '@/components/shared/SkateModal';
import BountyComposer from '@/components/bounties/BountyComposer';
import BountyList from '@/components/bounties/BountyList';
import { PoidhBountyList } from '@/components/bounties/PoidhBountyList';
import type { Discussion } from '@hiveio/dhive';

export default function BountiesHubClient() {
  const t = useTranslations('bounties');
  const isMobile = useIsMobile();

  const [tabIndex, setTabIndex] = useState(0);

  // Hive composer state (same as old BountiesClient)
  const [newBounty, setNewBounty] = useState<Partial<Discussion> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showRules, setShowRules] = useState(false);

  const isHiveTab = tabIndex === 0;

  return (
    <Container maxW="container.xl" py={{ base: 6, md: 8 }}>
      {/* Shared header (hybrid, based on original Hive bounties header) */}
      <HStack
        justify="space-between"
        align={{ base: 'stretch', md: 'center' }}
        mb={4}
        gap={{ base: 3, md: 6 }}
        flexDir={{ base: 'column', md: 'row' }}
      >
        <HStack gap={{ base: 3, md: 4 }} align="center">
          <Image
            src="/images/ripper.png"
            alt="Ripper"
            height={72}
            width={72}
            style={{ height: 'auto', width: 'auto' }}
            className="ripper-logo"
          />

          <Box>
            <Text
              className="spoghettiwestern-title"
              fontWeight="extrabold"
              color="primary"
              letterSpacing="wider"
              textAlign="left"
              mb={0}
              style={{
                textTransform: 'uppercase',
                fontSize: 'clamp(1.4rem, 3.2vw, 2.4rem)',
              }}
            >
              {t('title')}
            </Text>

            <HStack gap={2} mt={1} flexWrap="wrap">
              <Badge variant="subtle" colorScheme="green">
                POIDH
              </Badge>
              <Badge variant="subtle" colorScheme="purple">
                Hive
              </Badge>
              <Text color="textSecondary" fontSize="sm">
                Consolidated skate bounties
              </Text>
            </HStack>
          </Box>
        </HStack>

        {isHiveTab ? (
          <Button
            size="lg"
            onClick={() => setIsModalOpen(true)}
            fontWeight="bold"
            px={{ base: 4, md: 8 }}
            py={{ base: 4, md: 6 }}
            boxShadow="md"
            bg="primary"
            color="background"
            _hover={{ bg: 'accent', color: 'primary' }}
          >
            {t('createButton')}
          </Button>
        ) : (
          <Button
            as="a"
            href="https://poidh.xyz"
            target="_blank"
            size="lg"
            fontWeight="bold"
            px={{ base: 4, md: 8 }}
            py={{ base: 4, md: 6 }}
            boxShadow="md"
            bg="green.400"
            color="black"
            _hover={{ bg: 'green.300' }}
          >
            Create on POIDH
          </Button>
        )}
      </HStack>

      {/* Shared tabs */}
      <Tabs variant="unstyled" index={tabIndex} onChange={setTabIndex}>
        <TabList
          bg="surface"
          borderWidth={1}
          borderColor="border"
          borderRadius="full"
          p={1}
          w="fit-content"
          mb={6}
        >
          <Tab
            px={5}
            py={2}
            borderRadius="full"
            fontWeight="bold"
            color="textSecondary"
            _selected={{ bg: 'primary', color: 'background', boxShadow: 'md' }}
            _hover={{ color: 'text' }}
          >
            Hive <Badge ml={2} variant="subtle">L1</Badge>
          </Tab>

          <Tab
            px={5}
            py={2}
            borderRadius="full"
            fontWeight="bold"
            color="textSecondary"
            _selected={{ bg: 'green.400', color: 'black', boxShadow: 'md' }}
            _hover={{ color: 'text' }}
          >
            POIDH <Badge ml={2} colorScheme="green">Skate</Badge>
          </Tab>
        </TabList>

        <TabPanels>
          {/* Hive */}
          <TabPanel px={0}>
            <HStack mb={4} justify="space-between" flexDir={{ base: 'column', md: 'row' }} align={{ base: 'stretch', md: 'center' }} gap={3}>
              <Text color="primary" fontSize={{ base: 'md', md: 'lg' }}>
                {t('subtitle')}
              </Text>
              <Button
                size="sm"
                colorScheme="primary"
                variant="outline"
                onClick={() => setShowRules((prev) => !prev)}
              >
                {t('rulesTitle')}
              </Button>
            </HStack>

            {showRules && (
              <Accordion allowToggle defaultIndex={[0]} mt={2} mb={6}>
                <AccordionItem border="none">
                  <AccordionButton px={0} _hover={{ bg: 'muted' }}>
                    <Box as="span" flex="1" textAlign="left" color="accent" fontSize="md">
                      {t('rulesIntro')}
                    </Box>
                    <AccordionIcon />
                  </AccordionButton>
                  <AccordionPanel pb={2} color="text" fontSize="sm">
                    <ul style={{ paddingLeft: 20, margin: 0 }}>
                      <li>{t('rule1')}</li>
                      <li>{t('rule2')}</li>
                      <li>{t('rule3')}</li>
                      <li>{t('rule4')}</li>
                    </ul>
                  </AccordionPanel>
                </AccordionItem>
              </Accordion>
            )}

            <BountyList newBounty={newBounty as any} refreshTrigger={refreshTrigger} />

            <SkateModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              title="create-bounty"
              size={isMobile ? 'full' : '2xl'}
            >
              <BountyComposer
                onNewBounty={(bounty) => {
                  setNewBounty(bounty);
                  setIsModalOpen(false);
                  setRefreshTrigger((prev) => prev + 1);
                }}
                onClose={() => setIsModalOpen(false)}
              />
            </SkateModal>
          </TabPanel>

          {/* POIDH */}
          <TabPanel px={0}>
            <PoidhBountyList embedded />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Container>
  );
}
