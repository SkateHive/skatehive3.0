"use client";

import dynamic from "next/dynamic";
import { Box, Flex, Spinner } from "@chakra-ui/react";

const EmbeddedMap = dynamic(() => import("@/components/spotmap/EmbeddedMap"), {
  ssr: false,
  loading: () => (
    <Flex
      w="100%"
      h={{ base: "65vh", md: "75vh" }}
      align="center"
      justify="center"
      bg="background"
      borderRadius="lg"
      border="1px solid"
      borderColor="whiteAlpha.200"
    >
      <Spinner size="lg" color="primary" />
    </Flex>
  ),
});

export default function NearMeMapClient() {
  return (
    <Box mt={6}>
      <EmbeddedMap useGeolocation fullHeight />
    </Box>
  );
}
