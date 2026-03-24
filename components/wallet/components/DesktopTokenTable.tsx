import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Text,
  HStack,
  VStack,
  Badge,
  IconButton,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Box,
} from "@chakra-ui/react";
import { Fragment } from "react";
import { FaChevronDown, FaChevronUp, FaPaperPlane } from "react-icons/fa";
import {
  ConsolidatedToken,
  formatBalance,
  formatValue,
  formatPrice,
  formatPriceChange,
  getEnhancedTokenData,
} from "../../../lib/utils/portfolioUtils";
import { blockchainDictionary, TokenDetail } from "../../../types/portfolio";
import TokenLogo from "./TokenLogo";
import TokenChainBreakdown from "./TokenChainBreakdown";

interface DesktopTokenTableProps {
  consolidatedTokens: ConsolidatedToken[];
  expandedTokens: Set<string>;
  onToggleExpansion: (symbol: string) => void;
  onSendToken: (token: TokenDetail, logoUrl?: string) => void;
}

export default function DesktopTokenTable({
  consolidatedTokens,
  expandedTokens,
  onToggleExpansion,
  onSendToken,
}: DesktopTokenTableProps) {
  if (consolidatedTokens.length === 0) {
    return (
      <TableContainer>
        <Table variant="simple" size="sm">
          <Tbody>
            <Tr>
              <Td colSpan={4} textAlign="center" py={8}>
                <Text color="dim" fontSize="sm">
                  No tokens to display. Try turning off &quot;Hide Dust&quot; to
                  see smaller balances.
                </Text>
              </Td>
            </Tr>
          </Tbody>
        </Table>
      </TableContainer>
    );
  }

  return (
    <TableContainer>
      <Table variant="simple" size="sm">
        <Tbody>
          {consolidatedTokens.map((consolidatedToken) => {
            const primaryToken = consolidatedToken.primaryChain;
            const { priceChange } = getEnhancedTokenData(primaryToken);
            const isExpanded = expandedTokens.has(consolidatedToken.symbol);

            return (
              <Fragment key={consolidatedToken.symbol}>
                <Tr
                  _hover={{ bg: "subtle" }}
                  borderBottom="1px solid"
                  borderColor="border"
                >
                  {/* Asset Column */}
                  <Td py={3}>
                    <HStack spacing={3}>
                      <TokenLogo
                        token={primaryToken}
                        size="32px"
                        showNetworkBadge={true}
                        networkBadgeSize="12px"
                      />

                      <VStack spacing={0} align="start">
                        <HStack spacing={2} align="center">
                          <Text fontWeight="medium" color="text" fontSize="sm">
                            {consolidatedToken.symbol}
                          </Text>
                          {consolidatedToken.chains.length > 1 && (
                            <Badge
                              colorScheme="blue"
                              fontSize="xs"
                              variant="solid"
                            >
                              {consolidatedToken.chains.length}
                            </Badge>
                          )}
                          {consolidatedToken.chains.length > 1 && (
                            <IconButton
                              aria-label="Expand token details"
                              icon={
                                isExpanded ? <FaChevronUp /> : <FaChevronDown />
                              }
                              size="xs"
                              variant="ghost"
                              colorScheme="blue"
                              onClick={() =>
                                onToggleExpansion(consolidatedToken.symbol)
                              }
                            />
                          )}
                        </HStack>
                        <HStack>
                          {consolidatedToken.chains.length > 1 ? (
                            <Menu>
                              <MenuButton
                                as={Button}
                                size="xs"
                                colorScheme="blue"
                                variant="ghost"
                                fontSize="xs"
                              >
                                <FaPaperPlane />
                              </MenuButton>
                              <MenuList
                                bg="background"
                                border="1px solid"
                                borderColor="border"
                              >
                                {consolidatedToken.chains.map(
                                  (chainToken, index) => {
                                    const chainInfo =
                                      blockchainDictionary[chainToken.network];
                                    return (
                                      <MenuItem
                                        key={`${chainToken.network}-${index}`}
                                        onClick={() => onSendToken(chainToken)}
                                        bg="background"
                                        _hover={{ bg: "muted" }}
                                      >
                                        <HStack spacing={2} w="100%">
                                          <TokenLogo
                                            token={chainToken}
                                            size="16px"
                                            showNetworkBadge={false}
                                          />
                                          <VStack
                                            spacing={0}
                                            align="start"
                                            flex={1}
                                          >
                                            <Text
                                              fontSize="sm"
                                              fontWeight="medium"
                                              color="text"
                                            >
                                              {chainInfo?.alias ||
                                                chainToken.network}
                                            </Text>
                                            <Text
                                              fontSize="xs"
                                              color="dim"
                                            >
                                              {formatBalance(
                                                chainToken.token.balance
                                              )}{" "}
                                              •{" "}
                                              {formatValue(
                                                chainToken.token.balanceUSD
                                              )}
                                            </Text>
                                          </VStack>
                                        </HStack>
                                      </MenuItem>
                                    );
                                  }
                                )}
                              </MenuList>
                            </Menu>
                          ) : (
                            <Button
                              size="xs"
                              colorScheme="blue"
                              variant="ghost"
                              fontSize="xs"
                              onClick={() => onSendToken(primaryToken)}
                            >
                              <FaPaperPlane />
                            </Button>
                          )}
                          <Text fontSize="xs" color="dim">
                            {formatBalance(
                              consolidatedToken.chains.reduce(
                                (sum, chain) => sum + chain.token.balance,
                                0
                              )
                            )}{" "}
                            {consolidatedToken.symbol}
                          </Text>
                        </HStack>
                      </VStack>
                    </HStack>
                  </Td>

                  {/* Price Change Column */}
                  <Td py={3}>
                    {priceChange !== null && (
                      <Text
                        fontSize="xs"
                        color={priceChange >= 0 ? "success" : "error"}
                      >
                        {priceChange >= 0 ? "+" : ""}
                        {formatPriceChange(priceChange)}%
                      </Text>
                    )}
                  </Td>

                  {/* Value Column */}
                  <Td py={3} isNumeric>
                    <VStack spacing={0} align="end">
                      <Text fontSize="sm" color="text" fontWeight="medium">
                        {formatValue(consolidatedToken.totalBalanceUSD)}
                      </Text>
                    </VStack>
                  </Td>
                </Tr>

                {isExpanded && (
                  <Tr key={`${consolidatedToken.symbol}-expanded`}>
                    <Td colSpan={3} py={0} borderBottom="none">
                      <Box py={2}>
                        <TokenChainBreakdown
                          consolidatedToken={consolidatedToken}
                        />
                      </Box>
                    </Td>
                  </Tr>
                )}
              </Fragment>
            );
          })}
        </Tbody>
      </Table>
    </TableContainer>
  );
}
