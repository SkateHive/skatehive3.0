"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Flex, Image, Text } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { ctaHref, type HeroSlide } from "@/types/homepage-config";
import { P, MONO } from "./palette";

const AUTOPLAY_MS = 6000;

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;

  const go = useCallback((d: 1 | -1) => setI((c) => (c + d + n) % n), [n]);

  // Autoplay — advances every AUTOPLAY_MS, paused on hover.
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (n <= 1 || paused) return;
    timer.current = setInterval(() => setI((c) => (c + 1) % n), AUTOPLAY_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [n, paused]);

  if (n === 0) return null;

  const play = (href: string | null) => {
    if (!href) return;
    if (href.startsWith("http")) window.open(href, "_blank", "noopener");
    else router.push(href);
  };

  return (
    <Box
      id="featured"
      position="relative"
      h={{ base: "420px", md: "600px" }}
      overflow="hidden"
      border={`2px solid ${P.card}`}
      fontFamily={MONO}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Sliding track: all slides side by side, translated into view. */}
      <Flex h="100%" w={`${n * 100}%`} transform={`translateX(-${(i * 100) / n}%)`} transition="transform 0.6s cubic-bezier(0.4,0,0.2,1)">
        {slides.map((s) => {
          const href = ctaHref(s.cta);
          return (
            <Box key={s.id} position="relative" h="100%" flex="0 0 auto" w={`${100 / n}%`}>
              <Image src={s.image} alt="" position="absolute" inset={0} w="100%" h="100%" objectFit="cover" filter="grayscale(15%) contrast(1.05)" />
              <Box position="absolute" inset={0} bg="linear-gradient(180deg, rgba(10,10,10,0.1) 0%, rgba(10,10,10,0.15) 45%, rgba(10,10,10,0.95) 100%)" />

              {/* Tag — top-left, plain text with a green underline. Sits
                  separately from the title block so the two anchor to
                  opposite corners of the hero (editorial-magazine look). */}
              {s.tag && (
                <Box
                  position="absolute"
                  top={{ base: "22px", md: "44px" }}
                  left={{ base: "20px", md: "44px" }}
                  color={P.accent}
                  fontWeight={700}
                  fontSize={{ base: "11px", md: "13px" }}
                  letterSpacing="3px"
                  textTransform="uppercase"
                  borderBottom={`2px solid ${P.accent}`}
                  pb="8px"
                  pr="4px"
                  display="inline-block"
                  zIndex={1}
                >
                  {s.tag}
                </Box>
              )}

              {/* Title + play + author — bottom-left column. maxW keeps
                  long titles from crashing into the right-side arrow. */}
              <Box
                position="absolute"
                left={{ base: "20px", md: "44px" }}
                bottom={{ base: "24px", md: "44px" }}
                right={{ base: "20px", md: "44px" }}
                maxW="1100px"
              >
                <Text
                  fontWeight={900}
                  fontSize="clamp(32px,5.4vw,72px)"
                  lineHeight="0.98"
                  color={P.headline}
                  letterSpacing="-1.5px"
                  textTransform="uppercase"
                >
                  {s.title}
                </Text>
                {s.subtitle && (
                  <Text fontSize={{ base: "14px", md: "17px" }} color={P.bodyMuted} mt="16px" maxW="700px">
                    {s.subtitle}
                  </Text>
                )}
                <Flex align="center" gap="18px" mt="22px">
                  {href && (
                    <Flex
                      as="button"
                      onClick={() => play(href)}
                      w="56px"
                      h="56px"
                      borderRadius="50%"
                      bg={P.accent}
                      align="center"
                      justify="center"
                      color={P.onAccent}
                      fontSize="22px"
                      _hover={{ bg: P.accentHover }}
                      flexShrink={0}
                    >
                      &#9654;
                    </Flex>
                  )}
                  {s.meta && (
                    <Text fontSize="13px" color={P.ui} letterSpacing="1px">
                      {s.meta}
                    </Text>
                  )}
                </Flex>
              </Box>
            </Box>
          );
        })}
      </Flex>

      {n > 1 && (
        <>
          <ArrowBtn side="left" onClick={() => go(-1)}>&#8249;</ArrowBtn>
          <ArrowBtn side="right" onClick={() => go(1)}>&#8250;</ArrowBtn>
          <Flex position="absolute" right={{ base: "20px", md: "44px" }} bottom={{ base: "24px", md: "44px" }} gap="10px" zIndex={2}>
            {slides.map((_, idx) => (
              <Box key={idx} as="button" aria-label={`Slide ${idx + 1}`} onClick={() => setI(idx)} w={idx === i ? "32px" : "16px"} h="8px" bg={idx === i ? P.accent : "rgba(255,255,255,0.3)"} transition="width 0.2s" />
            ))}
          </Flex>
        </>
      )}
    </Box>
  );
}

function ArrowBtn({ side, onClick, children }: { side: "left" | "right"; onClick: () => void; children: React.ReactNode }) {
  return (
    <Flex
      as="button"
      onClick={onClick}
      aria-label={side === "left" ? "Anterior" : "Próximo"}
      position="absolute"
      {...(side === "left" ? { left: "20px" } : { right: "20px" })}
      top="50%"
      transform="translateY(-50%)"
      zIndex={2}
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
