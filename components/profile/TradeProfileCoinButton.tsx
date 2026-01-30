import React from "react";
import { Button, useDisclosure } from "@chakra-ui/react";
import { FaExchangeAlt } from "react-icons/fa";
import dynamic from "next/dynamic";

// Dynamically import the trading modal to prevent SSR issues
const ZoraTradingModal = dynamic(() => import("../zora/ZoraTradingModal"), {
  ssr: false,
});

interface TradeProfileCoinButtonProps {
  coinAddress?: string;
  coinData?: {
    name?: string;
    symbol?: string;
    image?: string;
    marketCap?: string;
    uniqueHolders?: number;
  };
  isDisabled?: boolean;
}

export default function TradeProfileCoinButton({
  coinAddress,
  coinData,
  isDisabled = false,
}: TradeProfileCoinButtonProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Don't render the button if no coin address is available
  if (!coinAddress || !coinData) {
    return null;
  }

  return (
    <>
      <Button
        leftIcon={<FaExchangeAlt />}
        colorScheme="primary"
        size="sm"
        onClick={onOpen}
        isDisabled={isDisabled}
        fontWeight="medium"
        _hover={{
          transform: "translateY(-1px)",
          boxShadow: "lg",
        }}
        transition="all 0.2s ease"
      >
        Trade ${coinData.symbol}
      </Button>

      {/* Trading Modal */}
      {isOpen && (
        <ZoraTradingModal
          isOpen={isOpen}
          onClose={onClose}
          coinAddress={coinAddress}
          coinData={coinData}
        />
      )}
    </>
  );
}
