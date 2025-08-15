import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Center,
  Heading,
  Input,
  Select,
  Spinner,
  Text,
  useToast,
  VStack,
  HStack,
  Tooltip,
  OrderedList,
  ListItem,
  IconButton,
} from "@chakra-ui/react";
import { FaGlobe } from 'react-icons/fa';
import PIXTransactionHistory from "./PIXTransactionHistory";
import { Asset } from "@aioha/aioha";
import { useAioha } from "@aioha/react-ui";
import useHiveAccount from "@/hooks/useHiveAccount";
import PixTransferGuide from "./PIXTransferGuide";
import PIXFAQ from "./PIXFAQ";

export interface PixDashboardData {
  pixbeePixKey: string;
  HivePriceBRL: number;
  BRLPriceHive: number;
  HivePriceUSD: number;
  HBDPriceBRL: number;
  BRLPriceHBD: number;
  minRefundHive: number;
  minRefundHbd: number;
  minRefundPix: number;
  depositMinLimit: number;
  balancePix: number;
  balanceHbd: number;
  balanceHive: number;
  balanceTotal: number;
  OurExchangePer: number;
  OurExchangeFee: number;
  OurRefundPer: number;
}

// 🐝 PIX Form Component
type PIXFormProps = {
  pixDashboardData: PixDashboardData | null;
  language: 'en' | 'pt';
};

function PIXForm({ pixDashboardData, language }: PIXFormProps) {
  const { user, aioha } = useAioha();
  const { hiveAccount, isLoading, error } = useHiveAccount(user || "");
  const [currency, setCurrency] = useState("HBD");
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [previewData, setPreviewData] = useState<{
    resAmount: string;
    resMemo: string;
    isValid: boolean;
    translatedNote?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  // Declare userAvailableHive before useEffect
  const userAvailableHive = hiveAccount?.balance
    ? Number(String(hiveAccount.balance).split(" ")[0])
    : 0;

  // Declare userAvailableHbd before useEffect
  const userAvailableHbd = hiveAccount?.hbd_balance
    ? Number(String(hiveAccount.hbd_balance).split(" ")[0])
    : 0;

  // Use appropriate balance based on currency
  useEffect(() => {
    const balance = currency === "HBD" ? userAvailableHbd : userAvailableHive;
    if (balance > 0) {
      setAmount(String(balance.toFixed(3)));
    }
  }, [userAvailableHbd, userAvailableHive, currency]);

  // Early return after hooks
  if (!pixDashboardData) {
    return <Text color="red.400">{language === 'en' ? 'Loading dashboard data...' : 'Carregando dados do painel...'}</Text>;
  }

  const content = {
    en: {
      title: `💸 ${currency} to PIX`,
      balanceLabel: currency === "HBD" ? 'Your HBD Balance' : 'Your HIVE Balance',
      minDeposit: 'Minimal Deposit',
      amountPlaceholder: 'Amount',
      maxButton: 'MAX',
      pixKeyPlaceholder: 'PIX key',
      previewButton: '👀 Preview',
      previewTitle: 'Preview:',
      sendButton: '💸 Sign & Send',
      invalidAmount: 'Invalid amount',
      pixKeyRequired: 'PIX key is required',
      previewFailed: 'Preview failed',
      transferSuccessful: 'PIX Transfer Successful',
      sentMessage: `Sent ${amount} ${currency} to pixbee`,
      transferFailed: 'Transfer Failed',
      transferError: 'Transfer Error',
      invalidPixKey: 'Invalid PIX key. ',
      invalidPixAmount: 'PIX amount not available. ',
      invalidPixLow: 'Amount is less than the minimum deposit.',
    },
    pt: {
      title: `💸 ${currency} para PIX`,
      balanceLabel: currency === "HBD" ? 'Seu Saldo HBD' : 'Seu Saldo HIVE',
      minDeposit: 'Depósito Mínimo',
      amountPlaceholder: 'Quantidade',
      maxButton: 'MAX',
      pixKeyPlaceholder: 'Chave PIX',
      previewButton: '👀 Revisar',
      previewTitle: 'Revisar:',
      sendButton: '💸 Assinar & Enviar',
      invalidAmount: 'Quantidade inválida',
      pixKeyRequired: 'Chave PIX é obrigatória',
      previewFailed: 'Falha na visualização',
      transferSuccessful: 'Transferência PIX Bem-sucedida',
      sentMessage: `Enviado ${amount} ${currency} para pixbee`,
      transferFailed: 'Falha na Transferência',
      transferError: 'Erro na Transferência',
      invalidPixKey: '',
      invalidPixAmount: '',
      invalidPixLow: '',
      // minAmount: '⚠️ Valor inferior ao depósito mínimo.',
    },
  };

  const langContent = content[language];

  const checkMemoValidity = (memo: string): { isValid: boolean; translatedNote?: string } => {
    const lowerMemo = memo.toLowerCase();
    let isValid: boolean = true;
    let translatedNote: string = ""

    // Determine key type by looking for keywords (case insensitive)
    let keyType = "";
    if (lowerMemo.includes("evp")) keyType = "EVP";
    else if (lowerMemo.includes("email")) keyType = "email";
    else if (lowerMemo.includes("cpf")) keyType = "CPF";
    else if (lowerMemo.includes("phone")) keyType = "Phone";

    if (lowerMemo.includes("inválida")) {
      isValid = false;
      translatedNote = langContent.invalidPixKey;
    }

    if (lowerMemo.includes("nao")) {
      isValid = false;
      translatedNote = translatedNote + langContent.invalidPixAmount;
    }

    if (lowerMemo.includes("menor")) {
      isValid = false;
      translatedNote = translatedNote + langContent.invalidPixLow;
    }

    // If valid and keyType detected, add positive message
    if (isValid && keyType) {
      translatedNote = `Valid PIX Key type '${keyType}'. Amount available.`;
    }

    return { isValid, translatedNote };
  };

  const handlePreview = async () => {
    if (!amount || Number(amount) <= 0) {
      toast({ title: langContent.invalidAmount, status: "error", duration: 3000 });
      return;
    }
    if (!pixKey) {
      toast({ title: langContent.pixKeyRequired, status: "error", duration: 3000 });
      return;
    }

    setLoading(true);
    try {
      const endpoint = currency === "HBD"
        ? "https://aphid-glowing-fish.ngrok-free.app/simulatehbd2pix"
        : "https://aphid-glowing-fish.ngrok-free.app/simulatehive2pix";

      const response = await fetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ Memo: pixKey, Amount: amount }),
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
      });

      const data = await response.json();
      const { resAmount, resMemo } = data;

      const { isValid, translatedNote } = checkMemoValidity(resMemo);

      setPreviewData({
        resAmount,
        resMemo,
        isValid,
        translatedNote,
      });
    } catch (error) {
      toast({ title: langContent.previewFailed, description: String(error), status: "error" });
      setPreviewData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!previewData?.isValid) return;

    try {
      const amountNumber = Number(amount);
      if (isNaN(amountNumber) || amountNumber <= 0) {
        toast({
          title: langContent.invalidAmount,
          status: "error",
          duration: 3000,
        });
        return;
      }

      const memo = `#${pixKey}`; // Encrypt the PIX key
      const asset = currency === "HBD" ? Asset.HBD : Asset.HIVE;
      const xferResult = await aioha.transfer("pixbee", amountNumber, asset, memo);

      if (xferResult?.success) {
        toast({
          title: langContent.transferSuccessful,
          description: langContent.sentMessage,
          status: "success",
          duration: 4000,
        });

        setAmount("");
        setPixKey("");
        setPreviewData(null);
      } else {
        toast({
          title: langContent.transferFailed,
          description: xferResult?.message || "Unknown error",
          status: "error",
          duration: 4000,
        });
      }
    } catch (error) {
      console.error("Transfer error", error);
      toast({
        title: langContent.transferError,
        description: String(error),
        status: "error",
        duration: 4000,
      });
    }
  };

  return (
    <Box
      p={4}
      bg="background"
      borderRadius="lg"
      border="1px solid"
      borderColor="muted"
    >
      <VStack spacing={3} align="stretch">
        <Heading size="sm" mb={2} color="primary" fontFamily="Joystix">
          {langContent.title}
        </Heading>
        <Box fontSize="xs" color="primary">
          {currency === "HBD" ? (
            <>
              {langContent.balanceLabel}: {userAvailableHbd.toFixed(3)} HBD<br />
              {langContent.minDeposit}: {pixDashboardData.depositMinLimit} PIX
            </>
          ) : (
            <>
              {langContent.balanceLabel}: {userAvailableHive.toFixed(3)} HIVE<br />
              {langContent.minDeposit}: {pixDashboardData.depositMinLimit} PIX
            </>
          )}
        </Box>

        <Select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          size="sm"
          fontFamily="Joystix"
          fontWeight="bold"
          borderColor="muted"
        >
          <option value="HBD">HBD</option>
          <option value="HIVE">HIVE</option>
        </Select>

        <HStack>
          <Input
            placeholder={langContent.amountPlaceholder}
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            size="sm"
            fontFamily="Joystix"
            borderColor="muted"
            flex="1"
          />
          <Button
            size="sm"
            fontFamily="Joystix"
            fontWeight="bold"
            onClick={() => setAmount(String(currency === "HBD" ? userAvailableHbd : userAvailableHive))}
            isDisabled={currency === "HBD" ? userAvailableHbd === 0 : userAvailableHive === 0}
          >
            {langContent.maxButton}
          </Button>
        </HStack>

        <Input
          placeholder={langContent.pixKeyPlaceholder}
          value={pixKey}
          onChange={(e) => setPixKey(e.target.value)}
          size="sm"
          fontFamily="Joystix"
          borderColor="muted"
        />

        <Button
          size="sm"
          colorScheme="green"
          onClick={handlePreview}
          isLoading={loading}
          fontFamily="Joystix"
          fontWeight="bold"
        >
          {langContent.previewButton}
        </Button>

        {previewData && (
          <Box
            mt={3}
            p={3}
            border="1px solid"
            borderColor="muted"
            borderRadius="md"
            backgroundImage="url('/images/brl.webp')"
            backgroundSize="cover"
            backgroundPosition="left"
            backgroundRepeat="no-repeat"
            position="relative"
            minHeight="250px"
            _before={{
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              zIndex: 1,
            }}
          >
            <Box position="relative" zIndex={2}>
              <Text fontSize="md">
                <strong>{langContent.previewTitle}</strong>
              </Text>
              <br />
              <Text fontSize="sm">
                💸 <strong>{previewData.resAmount}</strong>
              </Text>

              {language == "pt" && (
                <Text fontSize="sm">
                  {previewData.isValid ? "📝" : "❌"} <strong>{previewData.resMemo}</strong>
                </Text>
              )}

              {language == "en" && (
                < Text fontSize="sm" >
                  {previewData.isValid ? "📝" : "❌"} <strong>{previewData.translatedNote}</strong>
                </Text>
              )}

              <Button
                mt={2}
                size="sm"
                colorScheme="blue"
                onClick={handleSend}
                fontFamily="Joystix"
                fontWeight="bold"
                isDisabled={!previewData.isValid}
              >
                {langContent.sendButton}
              </Button>
            </Box>
          </Box>
        )
        }
      </VStack >
    </Box >
  );
}

// 📊 Balance Bar Graph
function BalanceBarGraph({ data }: { data: PixDashboardData }) {
  const hiveBRL = data.balanceHive * data.HivePriceBRL;
  const hbdBRL = data.balanceHbd * ((data.HBDPriceBRL + data.BRLPriceHBD) / 2);
  const pixBRL = data.balancePix;

  const total = hiveBRL + hbdBRL + pixBRL;

  const hivePerc = (hiveBRL / total) * 100;
  const hbdPerc = (hbdBRL / total) * 100;
  const pixPerc = (pixBRL / total) * 100;

  return (
    <Box>
      <Text fontWeight="bold" mb={1}>
        💰 Skatebank Balance
        {/* (BRL {total.toFixed(2)}) */}
      </Text>
      <HStack
        h="24px"
        w="100%"
        borderRadius="md"
        overflow="hidden"
        border="1px solid"
        borderColor="muted"
        spacing={0}
      >
        <Tooltip label={`PIX: R$ ${pixBRL.toFixed(2)} (${pixPerc.toFixed(1)}%)`} hasArrow>
          <Box w={`${pixPerc}%`} bg="blue.400" h="full" />
        </Tooltip>
        <Tooltip label={`HBD: R$ ${hbdBRL.toFixed(2)} (${hbdPerc.toFixed(1)}%)`} hasArrow>
          <Box w={`${hbdPerc}%`} bg="green.400" h="full" />
        </Tooltip>
        <Tooltip label={`HIVE: R$ ${hiveBRL.toFixed(2)} (${hivePerc.toFixed(1)}%)`} hasArrow>
          <Box w={`${hivePerc}%`} bg="red.400" h="full" />
        </Tooltip>
      </HStack>

      <HStack spacing={4} mt={2} fontSize="xs" color="text">
        <HStack>
          <Box w={3} h={3} bg="blue.400" borderRadius="sm" />
          <Text>{pixBRL.toFixed(2)} PIX</Text>
        </HStack>
        <HStack>
          <Box w={3} h={3} bg="green.400" borderRadius="sm" />
          <Text>{data.balanceHbd.toFixed(3)} HBD</Text>
        </HStack>
        <HStack>
          <Box w={3} h={3} bg="red.400" borderRadius="sm" />
          <Text>{data.balanceHive.toFixed(3)} HIVE</Text>
        </HStack>
      </HStack>
    </Box>
  );
}

// 🧠 Main Component
export default function PIXTabContent() {
  const [pixDashboardData, setDashboardData] = useState<PixDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<'en' | 'pt'>('pt');
  const toast = useToast();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'pt' : 'en');
  };

  const content = {
    en: {
      heading: '💸 Pix',
      description: 'Fast, secure, and convenient way to send HBD via PIX! Use Skatebank service powered by Pixbee to Buy and Sell instantly using PIX.',
      offline: 'Skatebank is offline now. Try later',
    },
    pt: {
      heading: '💸 Pix',
      description: 'Maneira rápida, segura e conveniente de enviar HBD via PIX! Use o serviço Skatebank powered by Pixbee para comprar e vender usando PIX.',
      offline: 'Skatebank está offline agora. Tente mais tarde',
    },
  };

  const langContent = content[language];

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(
          (process.env.NEXT_PUBLIC_PIXBEE_ENDPOINT || "https://aphid-glowing-fish.ngrok-free.app") + "/skatebank",
          glowinOptions
        );

        if (!res.ok) {
          throw new Error("Skatebank offline");
        }

        const json = await res.json();

        // Convert to numbers if some are strings
        const parsedData = {
          ...json,
          balanceHive: Number(json.balanceHive),
          balanceHbd: Number(json.balanceHbd),
          balancePix: Number(json.balancePix),
          balanceTotal: Number(json.balanceTotal),
          OurExchangePer: Number(json.OurExchangePer),
          OurRefundPer: Number(json.OurRefundPer),
        };

        setDashboardData(parsedData);
      } catch (error) {
        console.error("Failed to load PIX data", error);
        // toast({ title: "Failed to load PIX data", status: "error", duration: 3000 });
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [toast]);

  return (
    <Box position="relative">
      <VStack spacing={4} align="stretch">
        {loading ? (
          <Center>
            <Spinner />
          </Center>
        ) : pixDashboardData ? (
          <>
            <Box>
              <Heading
                size="md"
                mb={4}
                color="primary"
                fontFamily="Joystix"
              >
                {langContent.heading}
                <IconButton
                  aria-label="Toggle language"
                  icon={<FaGlobe />}
                  size="sm"
                  position="absolute"
                  top={0}
                  right={2}
                  onClick={toggleLanguage}
                  color="black"
                  zIndex={10}
                />
              </Heading>
              <Text fontSize="sm" color="text" mb={1}>
                {langContent.description}
              </Text>
            </Box>

            <BalanceBarGraph data={pixDashboardData} />

            {/* HBD to PIX Form */}
            <PIXForm pixDashboardData={pixDashboardData} language={language} />

            {/* PIX to HBD Transfer Guide */}
            <PixTransferGuide pixDashboardData={pixDashboardData} language={language} />

            {/* Transaction History */}
            <PIXTransactionHistory searchAccount={"pixbee"} pixDashboardData={pixDashboardData} language={language} />

            {/* PIX FAQ */}
            <PIXFAQ language={language} />
          </>
        ) : (
          <Text color="red.400">{langContent.offline}</Text>
        )}
      </VStack>
    </Box>
  );
}

const glowinOptions = {
  method: "GET",
  headers: {
    "ngrok-skip-browser-warning": "69420",
    "Content-Type": "application/json",
  },
};
