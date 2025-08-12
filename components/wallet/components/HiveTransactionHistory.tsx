"use client";

import { Transaction, getTransactionHistory } from "@/lib/hive/client-functions";
import { KeyTypes } from "@aioha/aioha";
import { useAioha } from "@aioha/react-ui";
import { Tooltip, useToast, Button, Box, Spinner, Table, Tbody, Td, Text, Th, Thead, Tr, HStack, IconButton } from "@chakra-ui/react";
import { useEffect, useCallback, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const MAX_MEMO_LENGTH = 25;
const CALENDAR_EMOJI = "📅";
const ENDECRYPTED_EMOJI = "🔒";
const DECRYPTED_EMOJI = ""; // "🗝️";

const BATCH_SIZE = 100;

const HiveTransactionHistory = ({ searchAccount }: { searchAccount: string }) => {
    const { user, aioha } = useAioha();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [totalSentToPixbee, setTotalSentToPixbee] = useState<Record<string, number>>({});
    const [totalReceived, setTotalReceived] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [decryptedMemos, setDecryptedMemos] = useState<Record<number, string>>({});
    const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
    const toast = useToast();
    const [showHiveTransactions, setShowHiveTransactions] = useState(false);


    const handleDecrypt = useCallback(
        async (idx: number, memo: string) => {
            try {
                const decrypted = await aioha.decryptMemo(memo, KeyTypes.Memo);
                if (decrypted.success) {
                    const cleaned = decrypted.result.startsWith("#") ? decrypted.result.slice(1) : decrypted.result;
                    setDecryptedMemos((prev) => ({ ...prev, [idx]: cleaned }));
                } else {
                    toast({
                        title: "Decryption Failed",
                        description: "Unable to decrypt this memo.",
                        status: "error",
                        duration: 5000,
                        isClosable: true,
                    });
                }
            } catch (err) {
                console.error(err);
                toast({
                    title: "Error",
                    description: "Something went wrong while decrypting.",
                    status: "error",
                    duration: 5000,
                    isClosable: true,
                });
            }
        },
        [aioha, toast]
    );

    useEffect(() => {
        const fetchTransactions = async () => {
            if (!user) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const { transactions: fetchedTransactions, totalSentToPixbee } = await getTransactionHistory(user, searchAccount);
                setTransactions(fetchedTransactions);
                setTotalSentToPixbee(totalSentToPixbee);

                // Calculate total received by user for each currency
                const received = fetchedTransactions.reduce((acc, tx) => {
                    if (tx.to === user) {
                        const currency = tx.amount.split(" ")[1]; // e.g., "1.000 HIVE" -> "HIVE"
                        const amount = parseFloat(tx.amount.split(" ")[0]);
                        acc[currency] = (acc[currency] || 0) + amount;
                    }
                    return acc;
                }, {} as Record<string, number>);
                setTotalReceived(received);

                setVisibleCount(BATCH_SIZE); // Reset visible count when transactions change
            } catch (error) {
                console.error("Failed to fetch transactions:", error);
                setTransactions([]);
                setTotalSentToPixbee({});
                setTotalReceived({});
            } finally {
                setLoading(false);
            }
        };
        fetchTransactions();
    }, [user, searchAccount]);

    const replacePixbee = (str: string) => (str?.toLowerCase() === "pixbee" ? "skatebank" : str);

    const showMore = () => {
        setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, transactions.length));
    };

    return (
        <Box p={1}>
            {loading ? (
                <Spinner />
            ) : transactions.length > 0 ? (
                <>
                    <Box mb={4} w="100%">

                        <HStack
                            p={4}
                            bg="background"
                            borderRadius="md"
                            mb={4}
                            border="2px solid"
                            textAlign="center"
                            justify="center"
                            position="relative"
                            onClick={() => setShowHiveTransactions(!showHiveTransactions)}
                        >
                            {/* Absolutely centered text */}
                            <Box
                                position="absolute"
                                left="50%"
                                top="50%"
                                transform="translate(-50%, -50%)"
                                zIndex={1}
                            >
                                <Text fontSize="sm" color="primary" cursor="default">
                                    Hive Activity
                                </Text>
                            </Box>
                            {/* IconButton on the right */}
                            <Box
                                position="absolute"
                                right={4}
                                top="50%"
                                transform="translateY(-50%)"
                                zIndex={2}
                            >
                                <IconButton
                                    aria-label={showHiveTransactions ? "Hide NFTs" : "Show NFTs"}
                                    icon={showHiveTransactions ? <FaEyeSlash /> : <FaEye />}
                                    variant="ghost"
                                    colorScheme="purple"
                                    size="sm"
                                />
                            </Box>
                        </HStack>

                        {showHiveTransactions && (
                            <Box overflowX="auto" color="white" width="100%" maxWidth="1200px" mx="auto">
                                <Table size="sm">
                                    <Thead>
                                        <Tr>
                                            <Th fontSize="xs" width="20%" textAlign="center">
                                                From
                                            </Th>
                                            <Th fontSize="xs" width="20%" textAlign="center">
                                                To
                                            </Th>
                                            <Th fontSize="xs" width="20%" textAlign="center">
                                                Amount
                                            </Th>
                                            <Th fontSize="xs" width="37%" textAlign="center">
                                                Memo
                                            </Th>
                                            <Th fontSize="xs" width="3%" textAlign="center">
                                                Date
                                            </Th>
                                        </Tr>
                                    </Thead>
                                    <Tbody>
                                        {transactions.slice(0, visibleCount).map((transaction, idx) => {
                                            const rawMemo = transaction.memo ?? "";
                                            const isEncrypted = rawMemo.startsWith("#");
                                            const displayMemo = decryptedMemos[idx] ?? rawMemo;
                                            const shortMemo =
                                                displayMemo.length > MAX_MEMO_LENGTH ? `${displayMemo.substring(0, MAX_MEMO_LENGTH)}…` : displayMemo;

                                            return (
                                                <Tr key={idx}>
                                                    <Td fontSize="xs" px={2} color="primary">
                                                        {replacePixbee(transaction.from)}
                                                    </Td>
                                                    <Td fontSize="xs" px={2} color="primary">
                                                        {replacePixbee(transaction.to)}
                                                    </Td>
                                                    <Td fontSize="xs" px={2} textAlign="right" color="primary">
                                                        {transaction.amount}
                                                    </Td>
                                                    <Td fontSize="xs" px={2} color="primary">
                                                        <Tooltip label={displayMemo} hasArrow placement="top">
                                                            <Box
                                                                cursor={isEncrypted ? "pointer" : "default"}
                                                                onClick={() => {
                                                                    if (isEncrypted && !decryptedMemos[idx]) {
                                                                        handleDecrypt(idx, rawMemo);
                                                                    }
                                                                }}
                                                            >
                                                                {isEncrypted ? (decryptedMemos[idx] ? DECRYPTED_EMOJI : ENDECRYPTED_EMOJI) : ""}{shortMemo}
                                                            </Box>
                                                        </Tooltip>
                                                    </Td>
                                                    <Td fontSize="xs" px={2} textAlign="center" color="primary">
                                                        <Tooltip label={new Date(transaction.timestamp).toLocaleString()} hasArrow>
                                                            {CALENDAR_EMOJI}
                                                        </Tooltip>
                                                    </Td>
                                                </Tr>
                                            );
                                        })}
                                    </Tbody>
                                </Table>
                                {visibleCount < transactions.length && (
                                    <Box textAlign="center" mt={4}>
                                        <Button onClick={showMore} colorScheme="blue" size="sm">
                                            Display More
                                        </Button>
                                    </Box>
                                )}
                            </Box>
                        )}
                    </Box>
                </>
            ) : (
                <Text>No transactions found.</Text>
            )}
        </Box>
    );
};

export default HiveTransactionHistory;
