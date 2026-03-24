import { Box, Text, HStack, VStack, Badge, IconButton } from "@chakra-ui/react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import {
  ConsolidatedToken,
  formatBalance,
  formatValue,
  formatPriceChange,
  getEnhancedTokenData,
  getCorrectedTotalUSD,
} from "../../../lib/utils/portfolioUtils";
import { blockchainDictionary } from "../../../types/portfolio";
import TokenLogo from "./TokenLogo";
import TokenChainBreakdown from "./TokenChainBreakdown";

interface MobileTokenRowProps {
  consolidatedToken: ConsolidatedToken;
  isExpanded: boolean;
  onToggleExpansion: () => void;
  onClick: () => void;
}

export default function MobileTokenRow({
  consolidatedToken,
  isExpanded,
  onToggleExpansion,
  onClick,
}: MobileTokenRowProps) {
  const primaryToken = consolidatedToken.primaryChain;
  const networkInfo = blockchainDictionary[primaryToken.network];
  const { priceChange } = getEnhancedTokenData(primaryToken);

  return (
    <>
      <Box
        onClick={onClick}
        cursor="pointer"
        py={3}
        px={4}
        borderBottom="1px solid"
        borderColor="border"
        _hover={{ bg: "subtle" }}
        transition="all 0.2s ease"
      >
        <HStack justify="space-between" align="center" spacing={3}>
          <HStack spacing={3} flex={1}>
            <TokenLogo
              token={primaryToken}
              size="40px"
              showNetworkBadge={true}
              networkBadgeSize="14px"
            />

            <VStack spacing={0} align="start" flex={1}>
              <HStack spacing={2} align="center">
                <Text
                  fontWeight="600"
                  color="text"
                  fontSize="md"
                  letterSpacing="-0.01em"
                >
                  {consolidatedToken.symbol}
                </Text>
                {consolidatedToken.chains.length > 1 && (
                  <Badge
                    colorScheme="blue"
                    fontSize="xs"
                    fontWeight="500"
                    px={1.5}
                    py={0.5}
                    borderRadius="none"
                  >
                    {consolidatedToken.chains.length}
                  </Badge>
                )}
                {consolidatedToken.chains.length > 1 && (
                  <IconButton
                    aria-label="Expand token details"
                    icon={isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                    size="xs"
                    variant="ghost"
                    color="dim"
                    _hover={{ bg: "subtle", color: "text" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleExpansion();
                    }}
                  />
                )}
              </HStack>
              <Text fontSize="sm" color="dim">
                {formatBalance(
                  consolidatedToken.chains.reduce(
                    (sum, chain) => sum + chain.token.balance,
                    0
                  )
                )}
                {consolidatedToken.name !== consolidatedToken.symbol && (
                  <Text as="span" ml={1} fontSize="xs" opacity={0.6}>{consolidatedToken.name}</Text>
                )}
              </Text>
            </VStack>
          </HStack>

          <VStack spacing={0} align="end">
            <Text
              fontSize="md"
              color="text"
              fontWeight="600"
              letterSpacing="-0.01em"
            >
              {formatValue(getCorrectedTotalUSD(consolidatedToken))}
            </Text>
            {priceChange !== null && priceChange !== undefined && (
              <Text
                fontSize="sm"
                color={priceChange >= 0 ? "success" : "error"}
                fontWeight="500"
              >
                {priceChange >= 0 ? "+" : ""}
                {formatPriceChange(priceChange)}%
              </Text>
            )}
          </VStack>
        </HStack>
      </Box>

      {isExpanded && (
        <Box
          bg="subtle"
          borderBottom="1px solid"
          borderColor="border"
          px={4}
          py={3}
        >
          <TokenChainBreakdown consolidatedToken={consolidatedToken} />
        </Box>
      )}
    </>
  );
}
