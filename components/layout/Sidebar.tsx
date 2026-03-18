"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Box,
  VStack,
  Icon,
  Flex,
  useToken,
  Link as ChakraLink,
} from "@chakra-ui/react";
import Link from "next/link";
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
  FiMail,
  FiAward,
  FiTarget,
  FiPlay,
  FiZap,
} from "react-icons/fi";
import { useTheme } from "@/app/themeProvider";
import { useNotifications } from "@/contexts/NotificationContext";
import SidebarLogo from "../graphics/SidebarLogo";
import AuthButton from "./AuthButton";
import { useTranslations } from "@/contexts/LocaleContext";
import { useSoundSettings } from "@/contexts/SoundSettingsContext";

export default function Sidebar() {
  const { handle: hiveHandle, canUseAppFeatures } = useEffectiveHiveUser();
  const { isConnected: isEthereumConnected } = useAccount();
  const { isAuthenticated: isFarcasterConnected } = useFarcasterSession();
  const [bellAnimating, setBellAnimating] = useState(false);
  const [isClientMounted, setIsClientMounted] = useState(false);
  const { themeName } = useTheme();
  const t = useTranslations('navigation');
  const { soundEnabled } = useSoundSettings();
  const hoverAudioRef = useRef<HTMLAudioElement | null>(null);

  // Load audio lazily on first hover instead of on mount
  const playHoverSound = useCallback(() => {
    if (!soundEnabled) return;
    if (!hoverAudioRef.current) {
      hoverAudioRef.current = new Audio('/hoversfx.mp3');
      hoverAudioRef.current.volume = 0.2;
    }
    hoverAudioRef.current.currentTime = 0;
    hoverAudioRef.current.play().catch(() => {});
  }, [soundEnabled]);

  // Ensure client-side only rendering to prevent hydration mismatch
  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  // Safely get notification count with fallback
  let newNotificationCount = 0;
  try {
    const notificationContext = useNotifications();
    newNotificationCount = notificationContext.newNotificationCount;
  } catch (error) {
    // Context not available yet, use default value
    newNotificationCount = 0;
  }

  const [primaryBg] = useToken("colors", ["primary"]);
  let hoverTextColor = "black";
  if (themeName === "windows95") hoverTextColor = "background";
  else if (themeName === "nounish") hoverTextColor = "secondary";
  else if (themeName === "hiveBR") hoverTextColor = "acxcent";
  else if (themeName === "mac") hoverTextColor = "accent";

  // Check if user is connected to any of the 3 protocols
  const isAnyProtocolConnected =
    !!hiveHandle || isEthereumConnected || isFarcasterConnected;

  useEffect(() => {
    setBellAnimating(newNotificationCount > 0);
  }, [newNotificationCount]);

  const NavItem = ({
    href,
    icon,
    children,
    prefetch = true,
  }: {
    href: string;
    icon: any;
    children: React.ReactNode;
    prefetch?: boolean;
  }) => (
    <Link
      href={href}
      passHref
      prefetch={prefetch}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <Box
        display="flex"
        alignItems="center"
        px={1}
        py={0.5}
        borderRadius="none"
        transition="background 0.2s"
        cursor="pointer"
        role="group"
        width="100%"
        pl={4}
        textDecoration="none"
        color="inherit"
        onMouseEnter={playHoverSound}
        _hover={{
          textDecoration: "none",
          "& > div": {
            bg: primaryBg,
            color: hoverTextColor,
          },
        }}
        _focus={{
          textDecoration: "none",
          outline: "none",
        }}
        _active={{
          textDecoration: "none",
        }}
        _visited={{
          textDecoration: "none",
          color: "inherit",
        }}
        sx={{
          "&:hover": {
            textDecoration: "none !important",
          },
          "&:focus": {
            textDecoration: "none !important",
            outline: "none !important",
          },
          "&:active": {
            textDecoration: "none !important",
          },
          "&:visited": {
            textDecoration: "none !important",
            color: "inherit !important",
          },
        }}
      >
        <Box display="flex" alignItems="center" px={0.25} py={0} my={0.5}>
          <Icon as={icon} boxSize={4} mr={2} />
          {children}
        </Box>
      </Box>
    </Link>
  );

  if (!isClientMounted) {
    return null;
  }

  return (
    <Box
      as="nav"
      bg="background"
      p={0}
      pt={0}
      w={{ base: "full", md: "17%" }}
      h={"100vh"}
      display={{ base: "none", md: "block" }}
      sx={{
        "&::-webkit-scrollbar": {
          display: "none",
        },
        scrollbarWidth: "none",
      }}
    >
      <Flex direction="column" justify="space-between" height="100%">
        <Box>
          <Box ml={4} mt={2} mb={4} width="164px" height="164px">
            <SidebarLogo />
          </Box>
          <VStack spacing={0} align="stretch" mt={2}>
            <NavItem href="/" icon={FiHome}>
              {t('home')}
            </NavItem>
            <NavItem href="/blog" icon={FiBook}>
              {t('magazine')}
            </NavItem>
            <NavItem href="/leaderboard" icon={FiAward} prefetch={false}>
              {t('leaderboard')}
            </NavItem>
            <NavItem href="/map" icon={FiMap} prefetch={false}>
              {t('skatespots')}
            </NavItem>
            <NavItem href="/bounties" icon={FiTarget} prefetch={false}>
              {t('bounties')}
            </NavItem>
            <NavItem href="/games" icon={FiPlay} prefetch={false}>
              Games
            </NavItem>
            <NavItem href="/tricks" icon={FiZap} prefetch={false}>
              Tricks
            </NavItem>
            {canUseAppFeatures && (
              <NavItem href="/notifications" icon={FiBell} prefetch={false}>
                {t('notifications')}
              </NavItem>
            )}
            {isAnyProtocolConnected && (
              <NavItem href="/wallet" icon={FiCreditCard} prefetch={false}>
                {t('wallet')}
              </NavItem>
            )}
            <NavItem href="/settings" icon={FiSettings}>
              {t('settings')}
            </NavItem>
            {canUseAppFeatures && (
              <NavItem href="/invite" icon={FiMail}>
                {t('invite')}
              </NavItem>
            )}
          </VStack>
        </Box>
        <Box>
          <AuthButton />
        </Box>
      </Flex>
    </Box>
  );
}
