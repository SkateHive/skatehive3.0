"use client";

import { useState } from "react";
import { Box, HStack, Button, Text, VStack, Icon } from "@chakra-ui/react";
import { FaEthereum } from "react-icons/fa";
import { SiHive } from "react-icons/si";
import ERC20SwapSection from "@/components/wallet/ERC20SwapSection";

type SwapMode = "ethereum" | "hive";

export default function SwapPageClient() {
  const [mode, setMode] = useState<SwapMode>("ethereum");

  return (
    <Box
      minH="100vh"
      bg="background"
      pt={{ base: 4, md: 8 }}
      px={{ base: 2, md: 4 }}
    >
      <VStack spacing={{ base: 4, md: 6 }} maxW="480px" mx="auto">
        {/* Mode Toggle */}
        <HStack
          w="100%"
          border="2px solid"
          borderColor="primary"
          p={0}
          spacing={0}
        >
          <Button
            flex={1}
            borderRadius="none"
            h="48px"
            bg={mode === "ethereum" ? "primary" : "transparent"}
            color={mode === "ethereum" ? "background" : "text"}
            fontFamily="mono"
            fontWeight="black"
            fontSize="sm"
            textTransform="uppercase"
            letterSpacing="widest"
            onClick={() => setMode("ethereum")}
            _hover={{
              bg: mode === "ethereum" ? "primary" : "whiteAlpha.100",
            }}
            leftIcon={<Icon as={FaEthereum} />}
          >
            Ethereum
          </Button>
          <Button
            flex={1}
            borderRadius="none"
            h="48px"
            bg={mode === "hive" ? "primary" : "transparent"}
            color={mode === "hive" ? "background" : "text"}
            fontFamily="mono"
            fontWeight="black"
            fontSize="sm"
            textTransform="uppercase"
            letterSpacing="widest"
            onClick={() => setMode("hive")}
            _hover={{
              bg: mode === "hive" ? "primary" : "whiteAlpha.100",
            }}
            leftIcon={<Icon as={SiHive} />}
          >
            Hive
          </Button>
        </HStack>

        {/* Swap Content */}
        {mode === "ethereum" ? (
          <Box w="100%">
            <ERC20SwapSection showFeeOption />
          </Box>
        ) : (
          <Box
            w="100%"
            border="2px solid"
            borderColor="primary"
            p={6}
            textAlign="center"
          >
            <VStack spacing={3}>
              <Icon as={SiHive} boxSize={10} color="primary" />
              <Text
                fontFamily="mono"
                fontWeight="black"
                fontSize="lg"
                color="primary"
                textTransform="uppercase"
                letterSpacing="widest"
              >
                Hive Swap
              </Text>
              <Text fontSize="sm" color="dim" fontFamily="mono">
                HIVE ↔ HBD conversions coming soon.
              </Text>
              <Text fontSize="xs" color="dim" fontFamily="mono">
                Vai pra onde will build that part
              </Text>
            </VStack>
          </Box>
        )}

        {/* Treasury Fee Info */}
        <Box
          w="100%"
          border="1px solid"
          borderColor="border"
          p={4}
        >
          <VStack spacing={2} align="start">
            <Text
              fontFamily="mono"
              fontWeight="black"
              fontSize="xs"
              color="primary"
              textTransform="uppercase"
              letterSpacing="widest"
            >
              Swap & Support Skateboarding
            </Text>
            <Text fontSize="xs" color="dim" fontFamily="mono" lineHeight="tall">
              Every swap includes a small optional fee that goes to the Skatehive
              shared treasury — funding skateparks, obstacles, rider sponsorships
              and public goods for skaters worldwide. Same best prices from 150+
              DEXes, but your trade helps grow the scene.
            </Text>
          </VStack>
        </Box>
      </VStack>
    </Box>
  );
}
