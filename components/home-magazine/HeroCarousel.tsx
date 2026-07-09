"use client";

import { useState } from "react";
import { Box, Flex, Image, Text } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { ctaHref, type HeroSlide } from "@/types/homepage-config";
import { P, MONO } from "./palette";

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const router = useRouter();
  const [i, setI] = useState(0);
  if (slides.length === 0) return null;
  const n = slides.length;
  const s = slides[Math.min(i, n - 1)];
  const go = (d: 1 | -1) => setI((c) => (c + d + n) % n);
  const href = ctaHref(s.cta);
  const onPlay = () => {
    if (!href) return;
    if (href.startsWith("http")) window.open(href, "_blank", "noopener");
    else router.push(href);
  };

  return (
    <Box id="featured" position="relative" mx="32px" mt="24px" h="640px" overflow="hidden" border={`2px solid ${P.card}`} fontFamily={MONO}>
      <Image src={s.image} alt="" position="absolute" inset={0} w="100%" h="100%" objectFit="cover" filter="grayscale(15%) contrast(1.05)" />
      <Box position="absolute" inset={0} bg="linear-gradient(180deg, rgba(10,10,10,0.1) 0%, rgba(10,10,10,0.15) 45%, rgba(10,10,10,0.95) 100%)" />

      {n > 1 && (
        <>
          <ArrowBtn side="left" onClick={() => go(-1)}>&#8249;</ArrowBtn>
          <ArrowBtn side="right" onClick={() => go(1)}>&#8250;</ArrowBtn>
        </>
      )}

      <Box position="absolute" left="44px" bottom="44px" right="44px" maxW="1100px">
        {s.tag && (
          <Box display="inline-block" bg="rgba(10,10,10,0.55)" border={`1.5px solid ${P.accent}`} color={P.accent} fontWeight={800} fontSize="13px" letterSpacing="2px" px="14px" py="6px" mb="18px" textTransform="uppercase">
            {s.tag}
          </Box>
        )}
        <Text fontWeight={800} fontSize="clamp(34px,4.6vw,56px)" lineHeight="1.03" color={P.headline} letterSpacing="-1px" textTransform="uppercase">
          {s.title}
        </Text>
        {s.subtitle && <Text fontSize="17px" color={P.bodyMuted} mt="16px" maxW="700px">{s.subtitle}</Text>}
        <Flex align="center" gap="18px" mt="22px">
          {href && (
            <Flex as="button" onClick={onPlay} w="56px" h="56px" borderRadius="50%" bg={P.accent} align="center" justify="center" color={P.onAccent} fontSize="22px" _hover={{ bg: P.accentHover }}>
              &#9654;
            </Flex>
          )}
          {s.meta && <Text fontSize="13px" color={P.ui} letterSpacing="1px">{s.meta}</Text>}
        </Flex>
      </Box>

      {n > 1 && (
        <Flex position="absolute" right="44px" bottom="44px" gap="10px">
          {slides.map((_, idx) => (
            <Box key={idx} as="button" onClick={() => setI(idx)} w={idx === i ? "32px" : "16px"} h="8px" bg={idx === i ? P.accent : "rgba(255,255,255,0.3)"} transition="width 0.2s" />
          ))}
        </Flex>
      )}
    </Box>
  );
}

function ArrowBtn({ side, onClick, children }: { side: "left" | "right"; onClick: () => void; children: React.ReactNode }) {
  return (
    <Flex
      as="button"
      onClick={onClick}
      position="absolute"
      {...(side === "left" ? { left: "20px" } : { right: "20px" })}
      top="50%"
      transform="translateY(-50%)"
      bg="rgba(10,10,10,0.6)"
      border={`2px solid ${P.accent}`}
      color={P.accent}
      w="48px"
      h="48px"
      align="center"
      justify="center"
      fontSize="22px"
      _hover={{ bg: "rgba(10,10,10,0.85)" }}
    >
      {children}
    </Flex>
  );
}
