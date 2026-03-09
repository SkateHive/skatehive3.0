"use client";

import { useState } from "react";
import {
  Box,
  Text,
  Button,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Badge,
} from "@chakra-ui/react";
import BountyComposer from "./BountyComposer";
import BountyList from "./BountyList";
import PoidhBountyList from "./PoidhBountyList";
import SkateModal from "@/components/shared/SkateModal";
import { Discussion } from "@hiveio/dhive";
import Image from "next/image";
import useIsMobile from "@/hooks/useIsMobile";
import { useTranslations } from '@/lib/i18n/hooks';

export default function BountiesClient() {
  const t = useTranslations('bounties');
  const [newBounty, setNewBounty] = useState<Partial<Discussion> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showRules, setShowRules] = useState(false);
  const isMobile = useIsMobile();

  return (
    <Box
      maxW="900px"
      mx="auto"
      py={{ base: 4, md: 8 }}
      px={{ base: 2, md: 4 }}
      className="hide-scrollbar"
      style={{ overflowY: "auto", height: "100vh" }}
    >
      <Box
        display={{ base: "block", md: "flex" }}
        alignItems="center"
        mb={4}
        gap={{ base: 4, md: 8 }}
        justifyContent={{ base: "flex-start", md: "space-between" }}
      >
        <Box
          display="flex"
          alignItems="center"
          gap={{ base: 1, md: 4 }}
          flex="1"
          mb={{ base: 4, md: 0 }}
        >
          <Image
            src="/images/ripper.png"
            alt="Ripper"
            height={120}
            width={120}
            style={{ height: "auto", width: "auto" }}
            className="ripper-logo"
          />
          <Text
            className="spoghettiwestern-title"
            fontWeight="extrabold"
            color="primary"
            letterSpacing="wider"
            textAlign="left"
            mb={0}
            style={{
              textTransform: "uppercase",
              fontSize: "clamp(1.5rem, 4vw, 3rem)",
              marginLeft: "2rem",
            }}
          >
            {t('title')}
          </Text>
        </Box>
        <Box
          flex={{ base: "unset", md: "0 0 auto" }}
          display="flex"
          justifyContent={{ base: "flex-start", md: "flex-end" }}
          width={{ base: "100%", md: "auto" }}
        >
          <Button
            size="lg"
            onClick={() => setIsModalOpen(true)}
            fontWeight="bold"
            px={{ base: 4, md: 8 }}
            py={{ base: 4, md: 6 }}
            boxShadow="md"
            ml={{ base: 0, md: 8 }}
            width={{ base: "100%", md: "auto" }}
            mt={{ base: 2, md: 0 }}
            bg="primary"
            color="background"
            _hover={{
              bg: "accent",
              color: "primary",
            }}
          >
            {t('createButton')}
          </Button>
        </Box>
      </Box>
      <Box mb={4}>
        <Box display="flex" alignItems="center" gap={2}>
          <Text
            color="primary"
            fontSize={{ base: "md", md: "lg" }}
            textAlign="left"
            mb={0}
          >
            {t('subtitle')}
          </Text>
          <Button
            size="sm"
            colorScheme="primary"
            variant="outline"
            onClick={() => setShowRules((prev) => !prev)}
            ml={2}
          >
            {t('rulesTitle')}
          </Button>
        </Box>
        {showRules && (
          <Accordion allowToggle defaultIndex={[0]} mt={2}>
            <AccordionItem border="none">
              <AccordionButton px={0} _hover={{ bg: "muted" }}>
                <Box
                  as="span"
                  flex="1"
                  textAlign="left"
                  color="accent"
                  fontSize="md"
                >
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
      </Box>

      {/* Bounty Source Tabs */}
      <Tabs variant="soft-rounded" colorScheme="primary" mb={6}>
        <TabList mb={4} flexWrap="wrap">
          <Tab>
            Hive Bounties
            <Badge ml={2} colorScheme="green" fontSize="xs">
              On-chain
            </Badge>
          </Tab>
          <Tab>
            POIDH Bounties
            <Badge ml={2} colorScheme="purple" fontSize="xs">
              Multi-chain
            </Badge>
          </Tab>
          <Tab>
            All Bounties
            <Badge ml={2} colorScheme="blue" fontSize="xs">
              Combined
            </Badge>
          </Tab>
        </TabList>

        <TabPanels>
          {/* Hive Bounties */}
          <TabPanel px={0}>
            <BountyList
              newBounty={newBounty as any}
              refreshTrigger={refreshTrigger}
            />
          </TabPanel>

          {/* POIDH Bounties */}
          <TabPanel px={0}>
            <PoidhBountyList initialFilter={["active"]} />
          </TabPanel>

          {/* All Bounties */}
          <TabPanel px={0}>
            <Box mb={6}>
              <Text fontSize="lg" fontWeight="bold" color="primary" mb={4}>
                Hive Bounties
              </Text>
              <BountyList
                newBounty={newBounty as any}
                refreshTrigger={refreshTrigger}
              />
            </Box>
            <Box mt={8}>
              <Text fontSize="lg" fontWeight="bold" color="primary" mb={4}>
                POIDH Bounties (Arbitrum, Base, Degen)
              </Text>
              <PoidhBountyList initialFilter={["active"]} />
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
      <SkateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="create-bounty"
        size={isMobile ? "full" : "2xl"}
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
    </Box>
  );
}
