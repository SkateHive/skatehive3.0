import {
    Box,
    Text,
    HStack,
    VStack,
    Image,
    Badge,
} from "@chakra-ui/react";
import { ConsolidatedToken } from "../../../lib/utils/portfolioUtils";
import { blockchainDictionary, TokenDetail } from "../../../types/portfolio";
import { formatBalance, formatValue } from "../../../lib/utils/portfolioUtils";
import { useWalletSource } from "../utils/walletSource";

interface TokenChainBreakdownProps {
    consolidatedToken: ConsolidatedToken;
}

interface ChainTokenItemProps {
    chainToken: TokenDetail;
    totalBalanceUSD: number;
}

function ChainTokenItem({ chainToken, totalBalanceUSD }: ChainTokenItemProps) {
    const networkInfo = blockchainDictionary[chainToken.network];
    const walletSource = useWalletSource(chainToken);
    const percentage = (chainToken.token.balanceUSD / totalBalanceUSD) * 100;

    return (
        <Box>
            <HStack justify="space-between" align="center" mb={2}>
                <HStack spacing={2}>
                    {networkInfo?.logo && (
                        <Image
                            src={networkInfo.logo}
                            alt={networkInfo?.alias || chainToken.network}
                            w="20px"
                            h="20px"
                            borderRadius="full"
                            objectFit="cover"
                            flexShrink={0}
                        />
                    )}
                    <VStack spacing={0} align="start">
                        <Text fontSize="sm" fontWeight="medium" color="white">
                            {walletSource.networkLabel}
                        </Text>
                        <Text fontSize="xs" color="gray.400">
                            {walletSource.walletLabel}
                        </Text>
                    </VStack>
                    <Badge
                        colorScheme={walletSource.type === 'ethereum' ? 'blue' : walletSource.type === 'farcaster' ? 'purple' : 'gray'}
                        fontSize="xs"
                    >
                        {percentage.toFixed(1)}%
                    </Badge>
                </HStack>

                <VStack spacing={0} align="end">
                    <Text fontSize="sm" color="white">
                        {formatBalance(chainToken.token.balance)} {chainToken.token.symbol}
                    </Text>
                    <Text fontSize="xs" color="gray.400">
                        {formatValue(chainToken.token.balanceUSD)}
                    </Text>
                </VStack>
            </HStack>

            {/* Progress bar showing percentage */}
            <Box w="100%" bg="gray.700" h="4px" borderRadius="full">
                <Box
                    w={`${percentage}%`}
                    bg={walletSource.type === 'ethereum' ? 'blue.400' : walletSource.type === 'farcaster' ? 'purple.400' : 'gray.400'}
                    h="100%"
                    borderRadius="full"
                />
            </Box>

            {/* Contract address for transparency */}
            <Text fontSize="xs" color="gray.500" mt={1}>
                {chainToken.token.address.slice(0, 6)}...{chainToken.token.address.slice(-4)}
            </Text>
        </Box>
    );
}

export default function TokenChainBreakdown({ consolidatedToken }: TokenChainBreakdownProps) {
    return (
        <Box
            p={4}
            bg="gray.900"
            borderRadius="md"
            border="1px solid"
            borderColor="gray.600"
            mt={2}
        >
            <Text fontSize="sm" fontWeight="medium" color="gray.300" mb={3}>
                Distribution across {consolidatedToken.chains.length} blockchain{consolidatedToken.chains.length > 1 ? 's' : ''}:
            </Text>

            <VStack spacing={3} align="stretch">
                {consolidatedToken.chains.map((chainToken, index) => (
                    <ChainTokenItem
                        key={`${chainToken.network}-${index}`}
                        chainToken={chainToken}
                        totalBalanceUSD={consolidatedToken.totalBalanceUSD}
                    />
                ))}
            </VStack>
        </Box>
    );
}
