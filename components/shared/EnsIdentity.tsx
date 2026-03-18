"use client";

import { useEnsName, useEnsAvatar } from "wagmi";
import { mainnet } from "wagmi/chains";
import { normalize } from "viem/ens";
import { Box, Image } from "@chakra-ui/react";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Lightweight replacement for @coinbase/onchainkit Name component.
 * Resolves ENS name for an Ethereum address using wagmi.
 */
export function EnsName({
  address,
  style,
  className,
}: {
  address: `0x${string}`;
  style?: React.CSSProperties;
  className?: string;
}) {
  const { data: ensName } = useEnsName({
    address,
    chainId: mainnet.id,
  });

  return (
    <span style={style} className={className}>
      {ensName || shortenAddress(address)}
    </span>
  );
}

/**
 * Lightweight replacement for @coinbase/onchainkit Avatar component.
 * Resolves ENS avatar for an Ethereum address using wagmi.
 */
export function EnsAvatar({
  address,
  className,
  size = 32,
}: {
  address: `0x${string}`;
  className?: string;
  size?: number;
}) {
  const { data: ensName } = useEnsName({
    address,
    chainId: mainnet.id,
  });

  const { data: avatarUrl } = useEnsAvatar({
    name: ensName ? normalize(ensName) : undefined,
    chainId: mainnet.id,
    query: { enabled: !!ensName },
  });

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={ensName || shortenAddress(address)}
        w={`${size}px`}
        h={`${size}px`}
        borderRadius="full"
        objectFit="cover"
        className={className}
      />
    );
  }

  // Fallback: gradient avatar from address
  const hue = parseInt(address.slice(2, 8), 16) % 360;
  return (
    <Box
      w={`${size}px`}
      h={`${size}px`}
      borderRadius="full"
      bg={`hsl(${hue}, 60%, 40%)`}
      className={className}
    />
  );
}
