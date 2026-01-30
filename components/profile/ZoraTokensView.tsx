"use client";
import React, { useState, memo, useCallback, useMemo } from "react";
import {
  Box,
  Grid,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Skeleton,
  Alert,
  AlertIcon,
  Flex,
  Center,
} from "@chakra-ui/react";
import { FaCoins, FaWallet } from "react-icons/fa";
import useZoraProfileTokens from "@/hooks/useZoraProfileTokens";
import ZoraTokenCard from "./ZoraTokenCard";

interface ZoraTokensViewProps {
  ethereumAddress?: string;
}

const ZoraTokensView: React.FC<ZoraTokensViewProps> = ({ ethereumAddress }) => {
  const [activeTab, setActiveTab] = useState(0);

  const { createdCoins, heldTokens, isLoading, error } = useZoraProfileTokens({
    ethereumAddress,
    enabled: Boolean(ethereumAddress),
  });

  const handleTabChange = useCallback((index: number) => {
    setActiveTab(index);
  }, []);

  const noAddressComponent = useMemo(
    () => (
      <Center py={8}>
        <Alert status="info" borderRadius="lg" maxW="md">
          <AlertIcon />
          Connect an Ethereum wallet to view Zora tokens
        </Alert>
      </Center>
    ),
    []
  );

  if (!ethereumAddress) {
    return noAddressComponent;
  }

  return (
    <Box w="100%">
      {/* Terminal-style tabs container */}
      <Box
        border="2px solid"
        borderColor="border"
        borderTop="none"
        bg="background"
      >
        <Tabs
          index={activeTab}
          onChange={handleTabChange}
          variant="unstyled"
        >
          <TabList>
            <Tab
              color={activeTab === 0 ? "primary" : "text"}
              bg={activeTab === 0 ? "muted" : "transparent"}
              borderRight="1px solid"
              borderColor="border"
              _hover={{
                bg: "muted",
                color: "primary",
              }}
              transition="all 0.2s"
              px={4}
              py={3}
              fontFamily="mono"
              fontSize="sm"
              borderRadius="none"
            >
              <Flex align="center" gap={2}>
                <FaCoins />
                Created ({createdCoins?.length || 0})
              </Flex>
            </Tab>
            <Tab
              color={activeTab === 1 ? "primary" : "text"}
              bg={activeTab === 1 ? "muted" : "transparent"}
              _hover={{
                bg: "muted",
                color: "primary",
              }}
              transition="all 0.2s"
              px={4}
              py={3}
              fontFamily="mono"
              fontSize="sm"
              borderRadius="none"
            >
              <Flex align="center" gap={2}>
                <FaWallet />
                Holdings ({heldTokens?.length || 0})
              </Flex>
            </Tab>
          </TabList>

        <TabPanels>
          <TabPanel p={6}>
            {isLoading ? (
              <Center>
                <Grid
                  templateColumns="repeat(auto-fit, minmax(280px, 1fr))"
                  gap={6}
                  maxW="1200px"
                  w="100%"
                  justifyItems="center"
                >
                  {[...Array(6)].map((_, i) => (
                    <Skeleton
                      key={i}
                      height="400px"
                      width="280px"
                      borderRadius="xl"
                    />
                  ))}
                </Grid>
              </Center>
            ) : error ? (
              <Center py={8}>
                <Alert status="error" borderRadius="lg" maxW="md">
                  <AlertIcon />
                  Failed to load created coins: {error}
                </Alert>
              </Center>
            ) : (
              <>
                {createdCoins && createdCoins.length > 0 ? (
                  <Center>
                    <Grid
                      templateColumns="repeat(auto-fit, minmax(280px, 1fr))"
                      gap={6}
                      maxW="1200px"
                      w="100%"
                      justifyItems="center"
                    >
                      {createdCoins.map((coin) => (
                        <ZoraTokenCard
                          key={coin.address}
                          coin={coin}
                          variant="created"
                        />
                      ))}
                    </Grid>
                  </Center>
                ) : (
                  <Center py={12}>
                    <Alert status="info" borderRadius="lg" maxW="md">
                      <AlertIcon />
                      No created coins found
                    </Alert>
                  </Center>
                )}
              </>
            )}
          </TabPanel>

          <TabPanel p={6}>
            {isLoading ? (
              <Center>
                <Grid
                  templateColumns="repeat(auto-fit, minmax(280px, 1fr))"
                  gap={6}
                  maxW="1200px"
                  w="100%"
                  justifyItems="center"
                >
                  {[...Array(6)].map((_, i) => (
                    <Skeleton
                      key={i}
                      height="400px"
                      width="280px"
                      borderRadius="xl"
                    />
                  ))}
                </Grid>
              </Center>
            ) : error ? (
              <Center py={8}>
                <Alert status="error" borderRadius="lg" maxW="md">
                  <AlertIcon />
                  Failed to load token holdings: {error}
                </Alert>
              </Center>
            ) : (
              <>
                {heldTokens && heldTokens.length > 0 ? (
                  <Center>
                    <Grid
                      templateColumns="repeat(auto-fit, minmax(280px, 1fr))"
                      gap={6}
                      maxW="1200px"
                      w="100%"
                      justifyItems="center"
                    >
                      {heldTokens.map((balance, index) => (
                        <ZoraTokenCard
                          key={`${balance.token?.address}-${index}`}
                          balance={balance}
                          variant="held"
                        />
                      ))}
                    </Grid>
                  </Center>
                ) : (
                  <Center py={12}>
                    <Alert status="info" borderRadius="lg" maxW="md">
                      <AlertIcon />
                      No token holdings found
                    </Alert>
                  </Center>
                )}
              </>
            )}
          </TabPanel>
        </TabPanels>
        </Tabs>
      </Box>
    </Box>
  );
};

export default memo(ZoraTokensView);
