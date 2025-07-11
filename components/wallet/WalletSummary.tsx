import {
    Box,
    VStack,
    HStack,
    Text,
    Button,
    Spinner,
    Divider,
    IconButton,
} from "@chakra-ui/react";
import { useAccount, useDisconnect } from "wagmi";
import { FaEthereum } from "react-icons/fa";
import {
    Name,
    Avatar,
    IdentityResolver,
} from "@paperclip-labs/whisk-sdk/identity";
import { usePortfolioContext } from "../../contexts/PortfolioContext";
import { formatValue } from "../../lib/utils/portfolioUtils";
import { IoLogOutSharp } from "react-icons/io5";
import { memo, useCallback, useMemo } from "react";

interface WalletSummaryProps {
    hiveUsername?: string;
    totalHiveValue: number;
    isPriceLoading: boolean;
    onConnectEthereum: () => void;
    onConnectHive: () => void;
}

const WalletSummary = memo(function WalletSummary({
    hiveUsername,
    totalHiveValue,
    isPriceLoading,
    onConnectEthereum,
    onConnectHive,
}: WalletSummaryProps) {
    const { isConnected: isEthConnected, address } = useAccount();
    const { portfolio } = usePortfolioContext();
    const { disconnect } = useDisconnect();

    // Memoize constants
    const resolverOrder = useMemo(() => [
        IdentityResolver.Nns,
        IdentityResolver.Farcaster,
        IdentityResolver.Ens,
        IdentityResolver.Base,
        IdentityResolver.Lens,
        IdentityResolver.Uni,
        IdentityResolver.World,
    ], []);

    // Memoize calculations
    const calculations = useMemo(() => {
        const ethValue = portfolio?.totalNetWorth || 0;
        const totalValue = totalHiveValue + ethValue;
        return { ethValue, totalValue };
    }, [portfolio?.totalNetWorth, totalHiveValue]);

    // Memoize connection status
    const connectionStatus = useMemo(() => ({
        hasWallets: isEthConnected || !!hiveUsername,
        needsEthereum: !isEthConnected,
        needsHive: !hiveUsername,
    }), [isEthConnected, hiveUsername]);

    // Memoized event handlers
    const handleDisconnect = useCallback(() => {
        disconnect();
    }, [disconnect]);

    const ethValue = calculations.ethValue;
    const totalValue = calculations.totalValue;

    // Case 1: No wallets connected
    if (!connectionStatus.hasWallets) {
        return (
            <Box
                p={4}
                bg="background"
                borderRadius="md"
                border="2px solid"
                borderColor="primary"
            >
                <Text fontSize="sm" color="primary" mb={3} textAlign="center">
                    Connect your wallets to get started
                </Text>
                <VStack spacing={2}>
                    <Button
                        leftIcon={<FaEthereum size={16} />}
                        onClick={onConnectEthereum}
                        w="full"
                        colorScheme="blue"
                        variant="outline"
                    >
                        Connect Ethereum
                    </Button>
                    <Button
                        onClick={onConnectHive}
                        w="full"
                        colorScheme="green"
                        variant="outline"
                    >
                        Connect Hive
                    </Button>
                </VStack>
            </Box>
        );
    }

    // Case 2: At least one wallet connected - show summary
    return (
        <Box
            p={4}
            bg="background"
            borderRadius="md"
            border="2px solid"
            borderColor="primary"
        >
            <Text fontSize="sm" color="primary" mb={2} textAlign="center">
                Total Portfolio Value
            </Text>
            {isPriceLoading ? (
                <Spinner size="sm" color="primary" mx="auto" mb={4} />
            ) : (
                <Text fontSize="2xl" fontWeight="bold" color="primary" textAlign="center" mb={4}>
                    {formatValue(totalValue)}
                </Text>
            )}

            <VStack spacing={3} align="stretch">
                {/* Hive Section */}
                {hiveUsername && (
                    <Box>
                        <HStack justify="space-between" align="center">
                            <Text fontSize="sm" color="text">
                                Hive Assets
                            </Text>
                            {isPriceLoading ? (
                                <Spinner size="xs" color="primary" />
                            ) : (
                                <Text fontSize="md" fontWeight="bold" color="primary">
                                    {formatValue(totalHiveValue)}
                                </Text>
                            )}
                        </HStack>
                        <Text fontSize="xs" color="gray.400">
                            @{hiveUsername}
                        </Text>
                    </Box>
                )}

                {/* Ethereum Section */}
                {isEthConnected && address && (
                    <Box>
                        <HStack justify="space-between" align="center">
                            <Text fontSize="sm" color="text">
                                Ethereum Assets
                            </Text>
                            <Text fontSize="md" fontWeight="bold" color="primary">
                                {formatValue(ethValue)}
                            </Text>
                        </HStack>

                        <HStack spacing={2}>
                            <Avatar
                                address={address}
                                size={16}
                                resolverOrder={resolverOrder}
                            />
                            <Name
                                address={address}
                                resolverOrder={resolverOrder}
                                style={{ fontSize: "12px", color: "gray" }}
                            />
                            <IconButton
                                icon={<IoLogOutSharp />}
                                color={"red.500"}
                                size="sm"
                                variant="ghost"
                                colorScheme="red"
                                onClick={handleDisconnect}
                                aria-label="Disconnect Ethereum"
                            />

                        </HStack>
                    </Box>
                )}

                {/* Show connect buttons for missing wallets */}
                {connectionStatus.hasWallets && (
                    <>
                        {hiveUsername && isEthConnected && <Divider />}

                        {connectionStatus.needsEthereum && (
                            <Button
                                leftIcon={<FaEthereum size={14} />}
                                onClick={onConnectEthereum}
                                size="sm"
                                colorScheme="blue"
                                variant="outline"
                            >
                                Connect Ethereum
                            </Button>
                        )}

                        {connectionStatus.needsHive && (
                            <Button
                                onClick={onConnectHive}
                                size="sm"
                                colorScheme="green"
                                variant="outline"
                            >
                                Connect Hive
                            </Button>
                        )}
                    </>
                )}
            </VStack>
        </Box>
    );
});

export default WalletSummary;
