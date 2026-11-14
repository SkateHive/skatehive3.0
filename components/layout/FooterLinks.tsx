import {
  Box,
  Flex,
  HStack,
  Heading,
  Icon,
  Image,
  Link,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type { IconType } from "react-icons";
import { FaDiscord, FaGithub, FaInstagram, FaYoutube } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { SiFarcaster } from "react-icons/si";
import { useTranslations } from "@/contexts/LocaleContext";

type FooterLink = { label: string; href: string };

const GITHUB_URL = "https://github.com/SkateHive/skatehive3.0";

const SOCIALS: { name: string; href: string; icon: IconType }[] = [
  { name: "X", href: "https://x.com/Skate_Hive", icon: FaXTwitter },
  { name: "Farcaster", href: "https://farcaster.xyz/skatehive", icon: SiFarcaster },
  { name: "Instagram", href: "https://instagram.com/skatehive", icon: FaInstagram },
  { name: "YouTube", href: "https://youtube.com/@skatehive", icon: FaYoutube },
  { name: "Discord", href: "https://discord.gg/gJxxSxswUv", icon: FaDiscord },
  { name: "GitHub", href: GITHUB_URL, icon: FaGithub },
];

const MIN_SPACER_PX = 48;

// Measures the scroll container the footer lives in and returns how tall the
// spacer above the footer must be for content + footer to fill the viewport.
// Done in JS so page content keeps its normal block layout.
function useFooterSpacer(pathname: string | null) {
  const spacerRef = useRef<HTMLDivElement>(null);
  const [spacerHeight, setSpacerHeight] = useState(MIN_SPACER_PX);

  useEffect(() => {
    const spacer = spacerRef.current;
    const container = spacer?.parentElement;
    if (!spacer || !container) return;

    const update = () => {
      // scrollHeight never drops below clientHeight, so measure where the
      // footer actually ends instead.
      const footer = spacer.nextElementSibling;
      if (!footer) return;
      const footerBottom =
        footer.getBoundingClientRect().bottom -
        container.getBoundingClientRect().top +
        container.scrollTop;
      const contentHeight = footerBottom - spacer.offsetHeight;
      setSpacerHeight(Math.max(MIN_SPACER_PX, container.clientHeight - contentHeight));
    };

    const observer = new ResizeObserver(update);
    observer.observe(container);
    Array.from(container.children).forEach((child) => {
      if (child !== spacer) observer.observe(child);
    });
    update();
    return () => observer.disconnect();
  }, [pathname]);

  return { spacerRef, spacerHeight };
}

function FooterColumn({
  title,
  links,
  isActive,
}: {
  title: string;
  links: FooterLink[];
  isActive: (href: string) => boolean;
}) {
  return (
    <VStack align="flex-start" spacing={2}>
      <Heading size="xs" mb={1} color="primary" textTransform="uppercase" letterSpacing="wider">
        {title}
      </Heading>
      {links.map((link) => {
        const active = isActive(link.href);
        return (
          <Link
            key={link.href}
            as={NextLink}
            href={link.href}
            fontSize="sm"
            color={active ? "accent" : "text"}
            fontWeight={active ? "bold" : "normal"}
            aria-current={active ? "page" : undefined}
            _hover={{ color: "accent", textDecoration: "none" }}
            transition="color 0.2s"
          >
            {active && <span aria-hidden>› </span>}
            {link.label}
          </Link>
        );
      })}
    </VStack>
  );
}

export default function FooterLinks() {
  const t = useTranslations("footer");
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
  const { spacerRef, spacerHeight } = useFooterSpacer(pathname);

  const exploreLinks = [
    { label: t("skateshops"), href: "/skateshops" },
    { label: t("blog"), href: "/blog" },
    { label: t("auction"), href: "/auction" },
    { label: t("swap"), href: "/swap" },
  ];

  const communityLinks = [
    { label: t("invite"), href: "/invite" },
    { label: t("dao"), href: "/dao" },
    { label: t("witness"), href: "/witness" },
    { label: t("support"), href: "/support" },
  ];

  return (
    <>
      {/* Fills the leftover height on short pages (e.g. /invite) so the footer
          sits at the bottom of the viewport instead of mid-screen. */}
      <Box ref={spacerRef} h={`${spacerHeight}px`} aria-hidden />
      <Box
        as="footer"
        bg="background"
        borderTop="1px solid"
        borderColor="border"
        pt={8}
        pb={6}
        px={6}
      >
        <SimpleGrid
          columns={{ base: 1, md: 4 }}
          spacingX={8}
          spacingY={6}
          maxW="container.xl"
          mx="auto"
        >
          {/* Brand: spans two columns so the link columns stay compact */}
          <VStack align="flex-start" spacing={3} gridColumn={{ md: "span 2" }}>
            <HStack spacing={3}>
              <Image src="/logos/SKATE_HIVE_CIRCLE.svg" alt="" boxSize="32px" />
              <Heading size="sm" color="primary" textTransform="uppercase" letterSpacing="wider">
                Skatehive
              </Heading>
            </HStack>
            <Text fontSize="sm" color="text" opacity={0.8} maxW="sm">
              {t("tagline")}
            </Text>
            <HStack spacing={4} pt={1}>
              {SOCIALS.map((social) => (
                <Link
                  key={social.name}
                  href={social.href}
                  isExternal
                  aria-label={`${t("followUs")} ${social.name}`}
                  title={social.name}
                  color="text"
                  _hover={{ color: "accent" }}
                  transition="color 0.2s"
                >
                  <Icon as={social.icon} boxSize={5} />
                </Link>
              ))}
            </HStack>
          </VStack>

          <FooterColumn title={t("explore")} links={exploreLinks} isActive={isActive} />
          <FooterColumn title={t("community")} links={communityLinks} isActive={isActive} />
        </SimpleGrid>

        <Flex
          maxW="container.xl"
          mx="auto"
          mt={8}
          pt={4}
          borderTop="1px solid"
          borderColor="border"
          justify="space-between"
          align="center"
          wrap="wrap"
          gap={3}
          fontSize="xs"
          color="text"
        >
          <Text fontSize="xs" opacity={0.6}>{t("builtWith")}</Text>
          <HStack spacing={5}>
            <Link
              as={NextLink}
              href="/privacypolicy"
              opacity={0.6}
              _hover={{ opacity: 1, color: "accent", textDecoration: "none" }}
            >
              {t("privacy")}
            </Link>
            <Link
              href={GITHUB_URL}
              isExternal
              opacity={0.6}
              _hover={{ opacity: 1, color: "accent", textDecoration: "none" }}
            >
              {t("contribute")}
            </Link>
          </HStack>
        </Flex>
      </Box>
    </>
  );
}
