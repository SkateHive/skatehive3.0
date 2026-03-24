import { Box, VStack, Text, Center } from "@chakra-ui/react";
import { ConsolidatedToken } from "../../../lib/utils/portfolioUtils";
import MobileTokenRow from "./MobileTokenRow";

interface MobileTokenTableProps {
  consolidatedTokens: ConsolidatedToken[];
  expandedTokens: Set<string>;
  onToggleExpansion: (symbol: string) => void;
  onTokenSelect: (token: ConsolidatedToken) => void;
}

export default function MobileTokenTable({
  consolidatedTokens,
  expandedTokens,
  onToggleExpansion,
  onTokenSelect,
}: MobileTokenTableProps) {
  if (consolidatedTokens.length === 0) {
    return (
      <Box
        bg="subtle"
        border="1px solid"
        borderColor="border"
        p={6}
      >
        <Center>
          <Text color="dim" fontSize="sm">
            No tokens to display. Try turning off &quot;Hide Dust&quot; to see
            smaller balances.
          </Text>
        </Center>
      </Box>
    );
  }

  return (
    <Box
      bg="subtle"
      border="1px solid"
      borderColor="border"
      overflow="hidden"
    >
      {consolidatedTokens.map((consolidatedToken) => {
        const isExpanded = expandedTokens.has(consolidatedToken.symbol);

        return (
          <MobileTokenRow
            key={`${consolidatedToken.symbol}-${consolidatedToken.primaryChain.network}`}
            consolidatedToken={consolidatedToken}
            isExpanded={isExpanded}
            onToggleExpansion={() =>
              onToggleExpansion(consolidatedToken.symbol)
            }
            onClick={() => onTokenSelect(consolidatedToken)}
          />
        );
      })}
    </Box>
  );
}
