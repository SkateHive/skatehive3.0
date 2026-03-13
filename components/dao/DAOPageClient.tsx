"use client";

import {
  Container,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Heading,
  VStack,
  Box,
} from "@chakra-ui/react";
import ProposalsList from "./governance/ProposalsList";
import AuctionHistory from "./auction/AuctionHistory";
import DAOAssets from "./DAOAssets";
import { DAO_ADDRESSES } from "@/lib/utils/constants";

/**
 * DAO Page Client Component
 * Main DAO page with tabs for Proposals, Auctions, and Treasury
 */
export default function DAOPageClient() {
  return (
    <Container maxW="7xl" py={8}>
      <VStack spacing={6} align="stretch">
        <Box>
          <Heading size="xl" mb={2}>
            🏛️ Skatehive DAO
          </Heading>
        </Box>

        <Tabs variant="enclosed" colorScheme="blue">
          <TabList>
            <Tab
              _selected={{
                color: 'blue.400',
                borderColor: 'blue.400',
                borderBottom: 'none',
              }}
            >
              Proposals
            </Tab>
            <Tab
              _selected={{
                color: 'blue.400',
                borderColor: 'blue.400',
                borderBottom: 'none',
              }}
            >
              Auctions
            </Tab>
            <Tab
              _selected={{
                color: 'blue.400',
                borderColor: 'blue.400',
                borderBottom: 'none',
              }}
            >
              Treasury
            </Tab>
          </TabList>

          <TabPanels>
            {/* Proposals Tab */}
            <TabPanel>
              <ProposalsList daoAddress={DAO_ADDRESSES.token} />
            </TabPanel>

            {/* Auctions Tab */}
            <TabPanel>
              <AuctionHistory />
            </TabPanel>

            {/* Treasury Tab */}
            <TabPanel>
              <DAOAssets />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    </Container>
  );
}
