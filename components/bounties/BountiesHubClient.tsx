'use client';

import { Box, Container, Heading, HStack, Tabs, TabList, TabPanels, Tab, TabPanel, Text, Badge } from '@chakra-ui/react';
import BountiesClient from '@/components/bounties/bountiesClient';
import { PoidhBountyList } from '@/components/bounties/PoidhBountyList';

export default function BountiesHubClient() {
  return (
    <Container maxW="container.xl" py={{ base: 6, md: 8 }}>
      <HStack justify="space-between" align="start" mb={6}>
        <Box>
          <Heading size="xl" mb={1}>Bounties</Heading>
          <Text color="textSecondary">
            Hive bounties + POIDH skate bounties in one place
          </Text>
        </Box>
      </HStack>

      <Tabs variant="unstyled">
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
            Hive
            <Badge ml={2} variant="subtle">L1</Badge>
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
            POIDH
            <Badge ml={2} colorScheme="green">Skate</Badge>
          </Tab>
        </TabList>

        <TabPanels>
          <TabPanel px={0}>
            <BountiesClient />
          </TabPanel>
          <TabPanel px={0}>
            <PoidhBountyList />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Container>
  );
}
