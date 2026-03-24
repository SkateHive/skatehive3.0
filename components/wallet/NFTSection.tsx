import {
  Box,
  Text,
  HStack,
  VStack,
  Spinner,
  Alert,
  AlertIcon,
  Image,
  Flex,
  Switch,
  FormControl,
  FormLabel,
  Badge,
  SimpleGrid,
  Collapse,
  IconButton,
  Code,
} from "@chakra-ui/react";
import { useState, useMemo, useEffect } from "react";
import { FaBug, FaExternalLinkAlt } from "react-icons/fa";

const IS_DEV = process.env.NODE_ENV === "development";
import { useAccount } from "wagmi";
import { usePortfolioContext } from "../../contexts/PortfolioContext";
import { DAO_ADDRESSES, ETH_ADDRESSES } from "@/config/app.config";

/** Map raw network strings (e.g. "BASE_MAINNET", "base", "ETHEREUM") → Zapper path segment */
function toZapperNetwork(raw: string): string {
  const n = raw.toLowerCase();
  if (n.includes("base")) return "base";
  if (n.includes("arbitrum")) return "arbitrum";
  if (n.includes("optimism")) return "optimism";
  if (n.includes("polygon")) return "polygon";
  return "ethereum";
}

function NFTCard({ nft, index, formatEthValue }: { nft: any; index: number; formatEthValue: (v: string) => string }) {
  const [debugOpen, setDebugOpen] = useState(false);

  const imageUrl =
    nft.token?.medias?.[0]?.url ||
    nft.token?.medias?.[0]?.originalUrl ||
    "/logos/skatehive-logo-rounded.png";
  const collectionName = nft.token?.collection?.name || "Unknown";
  const tokenName = nft.token?.name || `#${index}`;
  const floorPrice = nft.token?.collection?.floorPriceEth || "0";
  const estimatedValue = nft.token?.estimatedValueEth || "0";
  const rarityRank = nft.rarityRank;
  const collectionAddress = nft.token?.collection?.address;
  const network = nft.token?.collection?.network || "ethereum";

  return (
    <Box
      bg="panel"
      border="1px solid"
      borderColor={debugOpen ? "yellow.400" : "border"}
      overflow="hidden"
      _hover={{ borderColor: debugOpen ? "yellow.400" : "primary", transform: "translateY(-2px)" }}
      transition="all 0.15s ease"
    >
      {/* NFT Image — clickable to OpenSea */}
      <Box
        position="relative"
        cursor="pointer"
        onClick={() => {
          if (collectionAddress) {
            const url =
              network === "base"
                ? `https://opensea.io/assets/base/${collectionAddress}`
                : `https://opensea.io/assets/ethereum/${collectionAddress}`;
            window.open(url, "_blank");
          }
        }}
      >
        <Image
          src={imageUrl}
          alt={tokenName}
          w="100%"
          aspectRatio="1"
          objectFit="cover"
          fallback={
            <Flex w="100%" h="200px" bg="muted" align="center" justify="center">
              <Text fontSize="xs" color="dim">No Image</Text>
            </Flex>
          }
        />
        {rarityRank && (
          <Badge
            position="absolute"
            top={1}
            right={1}
            colorScheme="purple"
            fontSize="xs"
            variant="solid"
          >
            #{rarityRank}
          </Badge>
        )}
      </Box>

      {/* Info */}
      <Box p={2}>
        <HStack justify="space-between" align="start">
          <VStack spacing={0} align="start" flex={1} minW={0}>
            <Text fontSize="xs" color="dim" noOfLines={1}>{collectionName}</Text>
            <Text fontSize="xs" fontWeight="bold" color="text" noOfLines={1}>{tokenName}</Text>
          </VStack>
          <HStack spacing={0} flexShrink={0}>
            <IconButton
              aria-label="View on Zapper"
              icon={
                <Image
                  src="https://zapper.xyz/favicon.ico"
                  w="12px"
                  h="12px"
                  fallback={<FaExternalLinkAlt size={10} />}
                />
              }
              size="xs"
              variant="ghost"
              colorScheme="purple"
              onClick={(e) => {
                e.stopPropagation();
                if (collectionAddress) {
                  window.open(`https://zapper.xyz/nft/${toZapperNetwork(network)}/${collectionAddress}/${nft.tokenId}`, "_blank");
                }
              }}
            />
            {IS_DEV && (
              <IconButton
                aria-label="Debug NFT data"
                icon={<FaBug />}
                size="xs"
                variant="ghost"
                colorScheme="yellow"
                onClick={(e) => { e.stopPropagation(); setDebugOpen((v) => !v); }}
              />
            )}
          </HStack>
        </HStack>

        <HStack justify="space-between" mt={1.5}>
          <VStack spacing={0} align="start">
            <Text fontSize="9px" color="dim" textTransform="uppercase">Floor</Text>
            <Text fontSize="xs" color="text">{formatEthValue(floorPrice)}</Text>
          </VStack>
          <VStack spacing={0} align="end">
            <Text fontSize="9px" color="dim" textTransform="uppercase">Value</Text>
            <Text fontSize="xs" color="success">{formatEthValue(estimatedValue)}</Text>
          </VStack>
        </HStack>

        {/* Debug panel — dev only */}
        {IS_DEV && (
          <Collapse in={debugOpen} animateOpacity>
            <Box
              mt={2}
              p={2}
              bg="black"
              border="1px solid"
              borderColor="yellow.400"
              borderRadius="sm"
              maxH="240px"
              overflowY="auto"
            >
              <Code
                display="block"
                whiteSpace="pre"
                fontSize="9px"
                color="yellow.300"
                bg="transparent"
              >
                {JSON.stringify(nft, null, 2)}
              </Code>
            </Box>
          </Collapse>
        )}
      </Box>
    </Box>
  );
}

export default function NFTSection() {
  const { isConnected, address } = useAccount();
  const { portfolio, isLoading, error } = usePortfolioContext();
  const [hideFloorless, setHideFloorless] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [daoNFTs, setDaoNFTs] = useState<any[]>([]);

  useEffect(() => { setIsMounted(true); }, []);

  // Fetch Skatehive DAO NFTs from Nouns Builder subgraph
  useEffect(() => {
    if (!address) return;
    fetch(`/api/dao/tokens/${address}`)
      .then((r) => r.json())
      .then((data) => { if (data.nfts) setDaoNFTs(data.nfts); })
      .catch(console.error);
  }, [address]);

  const filteredNFTs = useMemo(() => {
    const portfolioNFTs = portfolio?.nfts ?? [];

    // Merge: keep portfolio NFTs that are Gnars, plus all DAO NFTs from subgraph.
    // Deduplicate by tokenId + contract address.
    const seen = new Set<string>();

    const gnars = portfolioNFTs.filter((nft: any) => {
      const collectionName = nft.token?.collection?.name?.toLowerCase() || "";
      const collectionAddress = nft.token?.collection?.address?.toLowerCase() || "";
      const network = nft.token?.collection?.network?.toLowerCase() || "";
      return (
        collectionName.includes("gnars") ||
        collectionName.includes("gnar") ||
        (collectionAddress === ETH_ADDRESSES.GNARS_NFT.toLowerCase() && network === "base")
      );
    });

    const all = [...gnars, ...daoNFTs].filter((nft: any) => {
      const key = `${nft.token?.collection?.address}-${nft.tokenId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let nfts = all;
    if (hideFloorless) {
      nfts = nfts.filter((nft: any) => parseFloat(nft.token?.collection?.floorPriceEth || "0") > 0);
    }

    return nfts.sort((a: any, b: any) =>
      parseFloat(b.token?.estimatedValueEth || "0") - parseFloat(a.token?.estimatedValueEth || "0")
    );
  }, [portfolio?.nfts, daoNFTs, hideFloorless]);

  const formatEthValue = (ethString: string) => {
    const value = parseFloat(ethString);
    if (value === 0) return "—";
    if (value < 0.001) return "< 0.001 ETH";
    return `${value.toFixed(3)} ETH`;
  };

  if (!isMounted || !isConnected || !address) return null;

  return (
    <Box w="100%">
      {/* Controls */}
      <HStack justify="space-between" mb={4} flexWrap="wrap">
        <Text fontSize="sm" color="dim">
          {filteredNFTs.length} NFTs
        </Text>
        <FormControl display="flex" alignItems="center" w="auto">
          <FormLabel htmlFor="hide-floorless" mb="0" fontSize="sm" whiteSpace="nowrap" color="text">
            Hide Floorless
          </FormLabel>
          <Switch
            id="hide-floorless"
            isChecked={hideFloorless}
            onChange={(e) => setHideFloorless(e.target.checked)}
            colorScheme="purple"
          />
        </FormControl>
      </HStack>

      {isLoading && (
        <Flex justify="center" py={8}>
          <Spinner color="primary" />
        </Flex>
      )}

      {error && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          {error}
        </Alert>
      )}

      {filteredNFTs.length === 0 && !isLoading && (
        <Box py={12} textAlign="center">
          <Text color="dim">No Gnars or Skatehive DAO NFTs found</Text>
        </Box>
      )}

      {/* Card Grid */}
      <SimpleGrid columns={{ base: 1, sm: 2, md: 2, lg: 3 }} spacing={4}>
        {filteredNFTs.map((nft: any, index: number) => (
          <NFTCard key={`${nft.token?.collection?.address}-${index}`} nft={nft} index={index} formatEthValue={formatEthValue} />
        ))}
      </SimpleGrid>
    </Box>
  );
}
