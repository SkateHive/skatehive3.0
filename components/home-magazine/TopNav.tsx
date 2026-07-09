"use client";

import { Box, Button, Flex, Image, Text } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { P, MONO } from "./palette";

const LINKS = [
  { label: "Featured", anchor: "featured" },
  { label: "Videos", anchor: "videos" },
  { label: "Spots", anchor: "spots" },
  { label: "Leaderboard", anchor: "rewards" },
];

export function TopNav({ onNavigate }: { onNavigate: (anchor: string) => void }) {
  const router = useRouter();
  return (
    <Flex
      as="nav"
      position="sticky"
      top={0}
      zIndex={50}
      bg={P.bg}
      borderBottom={`2px solid ${P.card}`}
      align="center"
      justify="space-between"
      gap="24px"
      px="32px"
      py="14px"
      wrap="wrap"
      fontFamily={MONO}
    >
      <Flex align="center" gap="14px" cursor="pointer" onClick={() => onNavigate("top")}>
        <Image src="/SKATE_HIVE_VECTOR_FIN.svg" alt="Skatehive" boxSize="52px" objectFit="contain" />
        <Text fontSize="11px" color={P.faint} letterSpacing="2px" textTransform="uppercase" borderLeft={`2px solid ${P.ghost}`} pl="14px" lineHeight="1.2">
          Skateboard<br />Media
        </Text>
      </Flex>

      <Flex align="center" gap="28px" fontSize="14px" fontWeight={700} letterSpacing="1px" textTransform="uppercase" display={{ base: "none", md: "flex" }}>
        {LINKS.map((l) => (
          <Text key={l.anchor} as="button" color={P.body} _hover={{ color: P.accentHover }} onClick={() => onNavigate(l.anchor)}>
            {l.label}
          </Text>
        ))}
      </Flex>

      <Button
        onClick={() => router.push("/")}
        bg={P.accent}
        color={P.onAccent}
        border={`2px solid ${P.accent}`}
        borderRadius={0}
        fontFamily={MONO}
        fontWeight={800}
        fontSize="14px"
        letterSpacing="1.5px"
        textTransform="uppercase"
        px="22px"
        py="12px"
        h="auto"
        _hover={{ bg: P.accentHover }}
      >
        Community
      </Button>
    </Flex>
  );
}
