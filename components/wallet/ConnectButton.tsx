"use client";

import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import { Box } from "@chakra-ui/react";
import { useAccount } from "wagmi";

export default function ConnectButton() {
  const { isConnected } = useAccount();

  if (isConnected) {
    return <></>;
  }

  return (
    <Box w="full">
      <RainbowConnectButton chainStatus="icon" />
    </Box>
  );
}
