"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Box,
  VStack,
  Icon,
  Flex,
  Text,
} from "@chakra-ui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useEffectiveHiveUser from "@/hooks/useEffectiveHiveUser";
import { useAccount } from "wagmi";
import { useFarcasterSession } from "@/hooks/useFarcasterSession";
import {
  FiHome,
  FiBell,
  FiBook,
  FiMap,
  FiCreditCard,
  FiSettings,
  FiAward,
  FiTarget,
  FiPlay,
  FiZap,
  FiVideo,
  FiFilm,
  FiUsers,
  FiMail,
} from "react-icons/fi";
import { useTheme } from "@/app/themeProvider";
import { useNotifications } from "@/contexts/NotificationContext";
import SidebarLogo from "../graphics/SidebarLogo";
import AuthButton from "./AuthButton";
import { useTranslations } from "@/contexts/LocaleContext";
import { useSoundSettings } from "@/contexts/SoundSettingsContext";


interface NavItemDef {
  href?: string;
  icon: any;
  label: string;
  prefetch?: boolean;
  show?: boolean;
  badge?: number;
  onClick?: () => void;
}

interface NavGroupDef {
  label: string;
  items: NavItemDef[];
}

export default function Sidebar() {

  const { handle: hiveHandle, canUseAppFeatures } = useEffectiveHiveUser();
  const { isConnected: isEthereumConnected } = useAccount();
  const { isAuthenticated: isFarcasterConnected } = useFarcasterSession();
  const [isClientMounted, setIsClientMounted] = useState(false);
  const { themeName } = useTheme();
  const t = useTranslations("navigation");
  const { soundEnabled } = useSoundSettings();
  const hoverAudioRef = useRef<HTMLAudioElement | null>(null);
  const pathname = usePathname();

  const playHoverSound = useCallback(() => {
    if (!soundEnabled) return;
    if (!hoverAudioRef.current) {
      hoverAudioRef.current = new Audio("/hoversfx.mp3");
      hoverAudioRef.current.volume = 0.2;
    }
    hoverAudioRef.current.currentTime = 0;
    hoverAudioRef.current.play().catch(() => {});
  }, [soundEnabled]);

  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  let newNotificationCount = 0;
  try {
    const notificationContext = useNotifications();
    newNotificationCount = notificationContext.newNotificationCount;
  } catch {
    newNotificationCount = 0;
  }

  let hoverTextColor = "black";
  if (themeName === "windows95") hoverTextColor = "background";
  else if (themeName === "nounish") hoverTextColor = "secondary";
  else if (themeName === "hiveBR") hoverTextColor = "accent";
  else if (themeName === "mac") hoverTextColor = "accent";
  else if (themeName === "whiteblack") hoverTextColor = "white";

  const isAnyProtocolConnected =
    !!hiveHandle || isEthereumConnected || isFarcasterConnected;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href) ?? false;
  };

  // --- Navigation groups ---
  const navGroups: NavGroupDef[] = [
    {
      label: "PRIMARY",
      items: [
        { href: "/", icon: FiHome, label: t("home") },
        { href: "/blog", icon: FiBook, label: t("magazine") },
        {
          href: "/leaderboard",
          icon: FiAward,
          label: t("leaderboard"),
          prefetch: false,
        },
      ],
    },
    {
      label: "EXPLORE",
      items: [
        { href: "/map", icon: FiMap, label: t("skatespots"), prefetch: false },
        { href: "/tricks", icon: FiZap, label: "Tricks", prefetch: false },
        { href: "/videos", icon: FiVideo, label: "Videos", prefetch: false },
        { href: "/cinema", icon: FiFilm, label: "Cinema", prefetch: false },
        { href: "/skaters", icon: FiUsers, label: "Skaters", prefetch: false },
      ],
    },
    {
      label: "COMMUNITY",
      items: [
        {
          href: "/bounties",
          icon: FiTarget,
          label: t("bounties"),
          prefetch: false,
        },
        { href: "/games", icon: FiPlay, label: "Games", prefetch: false },
        {
          href: "/invite",
          icon: FiMail,
          label: t("invite"),
          show: canUseAppFeatures,
        },
      ],
    },
    {
      label: "SYSTEM",
      items: [
        {
          href: "/notifications",
          icon: FiBell,
          label: t("notifications"),
          prefetch: false,
          show: canUseAppFeatures,
          badge: newNotificationCount,
        },
        {
          href: "/wallet",
          icon: FiCreditCard,
          label: t("wallet"),
          prefetch: false,
          show: isAnyProtocolConnected,
        },
        { href: "/settings", icon: FiSettings, label: t("settings") },
      ],
    },
  ];

  // --- NavItem component ---
  const NavItem = ({
    href,
    icon,
    label,
    prefetch = true,
    badge,
    onClick,
  }: {
    href?: string;
    icon: any;
    label: string;
    prefetch?: boolean;
    badge?: number;
    onClick?: () => void;
  }) => {
    const active = href ? isActive(href) : false;

    const inner = (
      <Box
        display="flex"
        alignItems="center"
        px={1}
        py={0.5}
        cursor="pointer"
        role="group"
        width="100%"
        pl={4}
        textDecoration="none"
        color="inherit"
        onMouseEnter={playHoverSound}
        onClick={onClick}
        _hover={{
          textDecoration: "none",
          "& > div": { bg: "primary", color: hoverTextColor },
        }}
        sx={{
          "&:hover": { textDecoration: "none !important" },
          "&:focus": { textDecoration: "none !important", outline: "none !important" },
          "&:active": { textDecoration: "none !important" },
          "&:visited": { textDecoration: "none !important", color: "inherit !important" },
        }}
      >
        <Box
          display="flex"
          alignItems="center"
          px={0.25}
          py={0}
          my={0.5}
          transition="background 0.2s, color 0.2s"
          bg={active ? "primary" : "transparent"}
          color={active ? hoverTextColor : "inherit"}
        >
          <Box position="relative" display="flex" alignItems="center">
            <Icon as={icon} boxSize={4} mr={2} />
            {badge && badge > 0 ? (
              <Box
                position="absolute"
                top="-4px"
                right="2px"
                bg="red.500"
                borderRadius="full"
                w="8px"
                h="8px"
              />
            ) : null}
          </Box>
          {label}
        </Box>
      </Box>
    );

    if (onClick || !href) return inner;

    return (
      <Link href={href} passHref prefetch={prefetch} style={{ textDecoration: "none", color: "inherit" }}>
        {inner}
      </Link>
    );
  };

  // --- Section label ---
  const SectionLabel = ({ label }: { label: string }) => (
    <Text
      fontSize="10px"
      fontWeight={600}
      letterSpacing="0.12em"
      textTransform="uppercase"
      color="dim"
      pl={4}
      pr={2}
      pt={2}
      pb={0.5}
      userSelect="none"
    >
      {label}
    </Text>
  );

  if (!isClientMounted) {
    return null;
  }

  return (
    <Box
      as="nav"
      bg="background"
      w={{ base: "full", md: "17%" }}
      h="100vh"
      p={0}
      pt={0}
      display={{ base: "none", md: "block" }}
      sx={{
        "&::-webkit-scrollbar": { display: "none" },
        scrollbarWidth: "none",
      }}
    >
      <Flex direction="column" height="100%">
        {/* Top: Logo + nav (scrollable) */}
        <Box flex="1" minH={0} overflowY="auto" sx={{ "&::-webkit-scrollbar": { display: "none" }, scrollbarWidth: "none" }}>
          <Box
            ml={4}
            mt={2}
            mb={4}
            width="164px"
            height="164px"
          >
            <SidebarLogo />
          </Box>

          {/* Navigation groups */}
          <VStack spacing={0} align="stretch">
            {navGroups.map((group) => {
              const visibleItems = group.items.filter(
                (item) => item.show === undefined || item.show
              );
              if (visibleItems.length === 0) return null;
              return (
                <Box key={group.label}>
                  <SectionLabel label={group.label} />
                  <VStack spacing={0} align="stretch">
                    {visibleItems.map((item) => (
                      <NavItem
                        key={item.href ?? item.label}
                        href={item.href}
                        icon={item.icon}
                        label={item.label}
                        prefetch={item.prefetch}
                        badge={item.badge}
                        onClick={item.onClick}
                      />
                    ))}
                  </VStack>
                </Box>
              );
            })}
          </VStack>
        </Box>

        {/* Bottom: User profile block */}
        <Box p={0} pb={4}>
          <AuthButton />
        </Box>
      </Flex>
    </Box>
  );
}
