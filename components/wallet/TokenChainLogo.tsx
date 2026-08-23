"use client";

/**
 * Token logo with a small chain badge in the bottom-right corner, so users can
 * always tell which blockchain a token lives on (Base / Ethereum / Arbitrum).
 *
 * Shared by the swap panel, the bridge panel and the token selector modal so the
 * badge looks identical everywhere.
 */
import { Box, Image, Text } from "@chakra-ui/react";
import { SWAP_CHAINS, type SwapToken } from "@/lib/evm/swapTokens";

/** Badge size scales with the token logo so it stays proportional at any size. */
function badgeSize(size: string): string {
  const px = parseInt(size, 10);
  if (Number.isNaN(px)) return "14px";
  return `${Math.max(10, Math.round(px * 0.44))}px`;
}

export default function TokenChainLogo({
  token,
  size = "28px",
  showChain = true,
}: {
  token: Pick<SwapToken, "chainId" | "symbol" | "logo">;
  size?: string;
  /** Hide the chain badge (e.g. single-chain contexts). Defaults to shown. */
  showChain?: boolean;
}) {
  const chain = SWAP_CHAINS.find((c) => c.id === token.chainId);
  const bSize = badgeSize(size);

  return (
    <Box position="relative" flexShrink={0} w={size} h={size}>
      {token.logo ? (
        <Image
          src={token.logo}
          w={size}
          h={size}
          objectFit="contain"
          borderRadius="full"
          alt=""
          fallback={
            <Box w={size} h={size} borderRadius="full" bg="border" display="flex" alignItems="center" justifyContent="center">
              <Text fontSize="xs" fontWeight="bold" color="text">{token.symbol[0]}</Text>
            </Box>
          }
        />
      ) : (
        <Box w={size} h={size} borderRadius="full" bg="border" display="flex" alignItems="center" justifyContent="center">
          <Text fontSize="xs" fontWeight="bold" color="text">{token.symbol[0]}</Text>
        </Box>
      )}
      {showChain && chain && (
        <Image
          src={chain.logo}
          alt={chain.name}
          title={chain.name}
          position="absolute"
          bottom="-2px"
          right="-2px"
          w={bSize}
          h={bSize}
          borderRadius="full"
          border="2px solid"
          borderColor="background"
          bg="background"
          fallback={<span />}
        />
      )}
    </Box>
  );
}
