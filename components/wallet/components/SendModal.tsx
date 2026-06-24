import {
  VStack,
  HStack,
  Text,
  Input,
  Button,
  FormControl,
  FormLabel,
  InputGroup,
  InputRightAddon,
  Divider,
  Box,
  Alert,
  AlertIcon,
  AlertDescription,
  useToast,
} from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { FaPaperPlane } from "react-icons/fa";
import { TokenDetail, blockchainDictionary } from "../../../types/portfolio";
import { formatBalance, formatValue } from "../../../lib/utils/portfolioUtils";
import TokenLogo from "./TokenLogo";
import useIsMobile from "@/hooks/useIsMobile";
import SkateModal from "@/components/shared/SkateModal";
import { useTranslations } from "@/contexts/LocaleContext";

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: TokenDetail | null;
}

export default function SendModal({ isOpen, onClose, token }: SendModalProps) {
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  const isMobile = useIsMobile();
  const t = useTranslations();

  // Reset form when modal closes or token changes
  useEffect(() => {
    if (!isOpen) {
      setRecipientAddress("");
      setAmount("");
      setIsLoading(false);
    }
  }, [isOpen, token]);

  if (!token) return null;

  const networkInfo = blockchainDictionary[token.network];
  const maxAmount = token.token.balance;
  const estimatedValue = parseFloat(amount || "0") * (token.token.price || 0);

  const handleMaxClick = () => {
    setAmount(maxAmount.toString());
  };

  const handleSend = async () => {
    if (!recipientAddress || !amount) {
      toast({
        title: t('wallet.missingInfo'),
        description: t('wallet.enterRecipientAmount'),
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (parseFloat(amount) > maxAmount) {
      toast({
        title: t('wallet.insufficientBalance'),
        description: t('wallet.amountExceedsBalance'),
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsLoading(true);

    try {
      // TODO: Implement actual sending logic here
      // This would connect to wallet and execute the transaction

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast({
        title: t('wallet.transactionInitiated'),
        description: t('wallet.sendingTokens')
          .replace('{amount}', amount)
          .replace('{symbol}', token.token.symbol)
          .replace('{address}', `${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`),
        status: "success",
        duration: 5000,
        isClosable: true,
      });

      onClose();
    } catch (error) {
      toast({
        title: t('wallet.transactionFailed'),
        description: t('wallet.transactionFailedRetry'),
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SkateModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`send-${token.token.symbol.toLowerCase()}`}
      size={isMobile ? "full" : "md"}
      footer={
        <HStack spacing={3} w="full">
          <Button
            variant="outline"
            borderColor="border"
            flex={1}
            onClick={onClose}
          >
            {t('wallet.send.cancel')}
          </Button>
          <Button
            colorScheme="blue"
            leftIcon={<FaPaperPlane />}
            flex={1}
            isLoading={isLoading}
            loadingText={t('wallet.send.sending')}
            onClick={handleSend}
            isDisabled={
              !recipientAddress || !amount || parseFloat(amount || "0") <= 0
            }
          >
            {t('wallet.send.send')}
          </Button>
        </HStack>
      }
    >
      <Box p={4}>
        <VStack spacing={4} align="stretch">
            {/* Available Balance */}
            <Box
              p={4}
              bg="gray.800"
              borderRadius="none"
              border="1px solid"
              borderColor="gray.700"
            >
              <VStack spacing={1} align="start">
                <Text fontSize="sm" color="gray.400">
                  {t('wallet.availableBalance')}
                </Text>
                <HStack justify="space-between" w="100%">
                  <Text fontSize="lg" fontWeight="bold" color="white">
                    {formatBalance(maxAmount)} {token.token.symbol}
                  </Text>
                  <Text fontSize="sm" color="gray.400">
                    {formatValue(token.token.balanceUSD)}
                  </Text>
                </HStack>
              </VStack>
            </Box>

            {/* Recipient Address */}
            <FormControl>
              <FormLabel color="white" fontSize="sm">
                {t('wallet.recipientAddress')}
              </FormLabel>
              <Input
                placeholder="0x..."
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                bg="gray.800"
                border="1px solid"
                borderColor="gray.600"
                color="white"
                fontSize={isMobile ? "16px" : "md"}
                _placeholder={{ color: "gray.500" }}
                _focus={{
                  borderColor: "blue.400",
                  boxShadow: "0 0 0 1px #63B3ED",
                }}
              />
            </FormControl>

            {/* Amount */}
            <FormControl>
              <FormLabel color="white" fontSize="sm">
                {t('wallet.amount')}
              </FormLabel>
              <InputGroup>
                <Input
                  placeholder="0.0"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  bg="gray.800"
                  border="1px solid"
                  borderColor="gray.600"
                  fontSize={isMobile ? "16px" : "md"}
                  color="white"
                  _placeholder={{ color: "gray.500" }}
                  _focus={{
                    borderColor: "blue.400",
                    boxShadow: "0 0 0 1px #63B3ED",
                  }}
                />
                <InputRightAddon bg="gray.700" borderColor="gray.600">
                  <HStack spacing={2}>
                    <Text fontSize="sm" color="white">
                      {token.token.symbol}
                    </Text>
                    <Button size="xs" variant="ghost" onClick={handleMaxClick}>
                      {t('wallet.max')}
                    </Button>
                  </HStack>
                </InputRightAddon>
              </InputGroup>
              {amount && (
                <Text fontSize="xs" color="gray.400" mt={1}>
                  ≈ {formatValue(estimatedValue)}
                </Text>
              )}
            </FormControl>

            {/* Warning for high amounts */}
            {parseFloat(amount || "0") > maxAmount * 0.8 && amount && (
              <Alert status="warning" bg="orange.900" borderColor="orange.700">
                <AlertIcon />
                <AlertDescription fontSize="sm">
                  {t('wallet.largeBalanceWarning')}
                </AlertDescription>
              </Alert>
            )}

            <Divider borderColor="border" />
          </VStack>
      </Box>
    </SkateModal>
  );
}
