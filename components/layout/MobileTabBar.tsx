"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  Box,
  Text,
  HStack,
  VStack,
  Flex,
  Image,
  useToast,
  Icon,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerBody,
  DrawerCloseButton,
} from "@chakra-ui/react";
import { useRouter, usePathname } from "next/navigation";
import { useAioha } from "@aioha/react-ui";
import HiveLoginModal from "./HiveLoginModal";
import { useNotifications } from "@/contexts/NotificationContext";
import { useFarcasterSession } from "@/hooks/useFarcasterSession";
import { useFarcasterMiniapp } from "@/hooks/useFarcasterMiniapp";
import { FarcasterAuthIsland, useFarcasterAuthMethods } from "@/components/farcaster/FarcasterAuthIsland";
import { useTranslations } from "@/lib/i18n/hooks";
import ConnectionModal from "./ConnectionModal";
import {
  FiHome,
  FiBell,
  FiUser,
  FiBook,
  FiMap,
  FiCreditCard,
  FiSettings,
  FiAward,
  FiTarget,
  FiTrendingUp,
  FiPlay,
  FiZap,
  FiVideo,
  FiFilm,
  FiUsers,
  FiMail,
  FiLogOut,
  FiFlag,
  FiPlus,
  FiMenu,
} from "react-icons/fi";
import { useReport } from "@/contexts/ReportContext";

// Fixed bottom tab bar for mobile. Mirrors the native app's 5-slot bar
// (Home · Videos · Create · Leaderboard · Menu). Secondary routes and the
// login flow live in the "Menu" drawer so nothing is lost versus the old
// floating navigation button.
export default function MobileTabBar() {
  const { openReport } = useReport();
  const router = useRouter();
  const pathname = usePathname();
  const { user, aioha } = useAioha();
  const [modalDisplayed, setModalDisplayed] = useState(false);
  const toast = useToast();
  const t = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const tAuth = useTranslations("auth");
  const tSettings = useTranslations("settings");

  // Farcaster integration - use methods from island
  const farcasterMethods = useFarcasterAuthMethods();
  const { signIn, signOut, connect, isSuccess, isError } = farcasterMethods;

  const {
    isAuthenticated: isFarcasterConnected,
    profile: farcasterProfile,
    clearSession,
  } = useFarcasterSession();
  const { isInMiniapp, user: miniappUser } = useFarcasterMiniapp();
  const [isFarcasterAuthInProgress, setIsFarcasterAuthInProgress] =
    useState(false);

  // Safety timeout ref to prevent stuck loading states
  const authTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearAuthTimeout = useCallback(() => {
    if (authTimeoutRef.current) {
      clearTimeout(authTimeoutRef.current);
      authTimeoutRef.current = null;
    }
  }, []);

  const handleFarcasterSuccess = useCallback(
    ({ username }: any) => {
      clearAuthTimeout();
      setIsFarcasterAuthInProgress(false);

      setTimeout(() => {
        signOut();
      }, 100);

      setIsConnectionModalOpen(false);
      setTimeout(() => {
        toast({
          title: tAuth("connectedSuccess"),
          description: `${tAuth("connectedSuccess")} as @${username}`,
          status: "success",
          duration: 3000,
        });
      }, 500);
    },
    [clearAuthTimeout, signOut, toast, tAuth]
  );

  const handleFarcasterError = useCallback(
    (_error: any) => {
      clearAuthTimeout();
      setIsFarcasterAuthInProgress(false);
      setIsConnectionModalOpen(false);
      toast({
        title: tAuth("connectionFailed"),
        description: tAuth("connectionFailed") + ". " + tCommon("pleaseTryAgain"),
        status: "error",
        duration: 3000,
      });
    },
    [clearAuthTimeout, toast, tAuth, tCommon]
  );

  const setAuthTimeoutSafety = useCallback(() => {
    clearAuthTimeout();
    authTimeoutRef.current = setTimeout(() => {
      setIsFarcasterAuthInProgress(false);
      toast({
        title: tAuth("authenticationFailed"),
        description: "Farcaster connection was cancelled or timed out",
        status: "info",
        duration: 2000,
      });
    }, 10000);
  }, [clearAuthTimeout, toast, tAuth]);

  const actualFarcasterConnection =
    isFarcasterConnected || (isInMiniapp && !!miniappUser);
  const actualFarcasterProfile = farcasterProfile || miniappUser;

  // Drawer + connection modal state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isModalTransitioning, setIsModalTransitioning] = useState(false);

  const safeCloseConnectionModal = useCallback(() => {
    if (isModalTransitioning) return;

    setIsModalTransitioning(true);
    setIsConnectionModalOpen(false);
    clearAuthTimeout();
    setIsFarcasterAuthInProgress(false);

    if (isSuccess && actualFarcasterConnection && !isFarcasterAuthInProgress) {
      signOut();
    }

    setTimeout(() => setIsModalTransitioning(false), 300);
  }, [
    isModalTransitioning,
    isSuccess,
    actualFarcasterConnection,
    signOut,
    clearAuthTimeout,
    isFarcasterAuthInProgress,
  ]);

  // Reset Auth Kit state when modal opens if user is already connected
  React.useEffect(() => {
    if (
      isConnectionModalOpen &&
      actualFarcasterConnection &&
      (isSuccess || isError) &&
      !isFarcasterAuthInProgress
    ) {
      if (isSuccess) {
        setTimeout(() => {
          signOut();
        }, 100);
      }
    }
  }, [
    isConnectionModalOpen,
    actualFarcasterConnection,
    isSuccess,
    isError,
    signOut,
    isFarcasterAuthInProgress,
  ]);

  // Client-side only rendering to avoid hydration issues
  const [isClient, setIsClient] = useState(false);

  // Safely get notification count with fallback
  let newNotificationCount = 0;
  try {
    const notificationContext = useNotifications();
    newNotificationCount = notificationContext.newNotificationCount;
  } catch {
    newNotificationCount = 0;
  }

  const handleHiveLogin = () => {
    safeCloseConnectionModal();
    setTimeout(() => {
      setModalDisplayed(true);
    }, 400);
  };

  const handleFarcasterConnect = async () => {
    if (isFarcasterAuthInProgress || isModalTransitioning) return;

    setIsFarcasterAuthInProgress(true);
    setAuthTimeoutSafety();

    try {
      if (actualFarcasterConnection) {
        const connectedProfile = actualFarcasterProfile;
        clearAuthTimeout();
        setIsFarcasterAuthInProgress(false);
        safeCloseConnectionModal();
        toast({
          title: "Already Connected",
          description: `Already connected as @${
            connectedProfile?.username || "unknown"
          }`,
          status: "info",
          duration: 3000,
        });
        return;
      }

      if (isInMiniapp && miniappUser) {
        clearAuthTimeout();
        safeCloseConnectionModal();
        toast({
          title: tAuth("connectedSuccess"),
          description: `${tAuth("connectedSuccess")} as @${miniappUser.username} via Farcaster miniapp`,
          status: "success",
          duration: 3000,
        });
        return;
      }

      if (isInMiniapp && !miniappUser) {
        clearAuthTimeout();
        setIsFarcasterAuthInProgress(false);
        toast({
          title: tAuth("authenticationFailed"),
          description: "Please ensure you're signed into Farcaster",
          status: "error",
          duration: 3000,
        });
        return;
      }

      connect();
    } catch {
      clearAuthTimeout();
      setIsFarcasterAuthInProgress(false);
      safeCloseConnectionModal();
      toast({
        title: tAuth("connectionFailed"),
        description: tAuth("connectionFailed") + ". " + tCommon("pleaseTryAgain"),
        status: "error",
        duration: 3000,
      });
    }
  };

  // Once connect() sets channelToken, call signIn() to start polling
  React.useEffect(() => {
    if (isFarcasterAuthInProgress && farcasterMethods.channelToken) {
      signIn();
    }
  }, [isFarcasterAuthInProgress, farcasterMethods.channelToken, signIn]);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    return () => {
      clearAuthTimeout();
    };
  }, [clearAuthTimeout]);

  if (!isClient) {
    return null;
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : !!pathname?.startsWith(href);

  const navigateTo = (path: string) => {
    setIsDrawerOpen(false);
    router.push(path);
  };

  const handleLogout = async () => {
    setIsDrawerOpen(false);
    try {
      if (user) {
        await aioha.logout();
      }
      if (isFarcasterConnected && clearSession) {
        clearSession();
      }
      window.location.href = "/";
    } catch {
      window.location.href = "/";
    }
  };

  // Quick-access tabs shown in the fixed bar
  const tabs = [
    { icon: FiHome, href: "/", name: t("home") },
    { icon: FiTarget, href: "/bounties", name: t("bounties") },
    { icon: FiPlus, href: "/compose", name: t("create"), center: true },
    { icon: FiMap, href: "/map", name: t("map") },
    { icon: FiMenu, name: t("menu"), menu: true, badge: newNotificationCount },
  ] as const;

  // Full navigation lives in the Menu drawer (grouped like the sidebar)
  const navGroups = [
    {
      label: "PRIMARY",
      items: [
        { icon: FiHome, href: "/", name: t("home") },
        { icon: FiBook, href: "/blog", name: t("magazine") },
        { icon: FiAward, href: "/leaderboard", name: t("leaderboard") },
      ],
    },
    {
      label: "EXPLORE",
      items: [
        { icon: FiMap, href: "/map", name: t("skatespots") },
        { icon: FiZap, href: "/tricks", name: "Tricks" },
        { icon: FiVideo, href: "/videos", name: "Videos" },
        { icon: FiFilm, href: "/cinema", name: "Cinema" },
        { icon: FiUsers, href: "/skaters", name: "Skaters" },
      ],
    },
    {
      label: "COMMUNITY",
      items: [
        { icon: FiTarget, href: "/bounties", name: t("bounties") },
        { icon: FiPlay, href: "/games", name: "Games" },
        { icon: FiTrendingUp, href: "/auction", name: t("auction") },
        ...(user ? [{ icon: FiMail, href: "/invite", name: t("invite") }] : []),
      ],
    },
    {
      label: "SYSTEM",
      items: [
        ...(user
          ? [
              {
                icon: FiBell,
                href: "/notifications",
                name: t("notifications"),
                badge: newNotificationCount,
              },
            ]
          : []),
        { icon: FiCreditCard, href: "/wallet", name: t("wallet") },
        { icon: FiSettings, href: "/settings", name: t("settings") },
        {
          icon: FiUser,
          href: user ? `/user/${user}?view=snaps` : "",
          name: user ? t("profile") : tCommon("login"),
          onClick: user
            ? undefined
            : () => {
                setIsDrawerOpen(false);
                setIsConnectionModalOpen(true);
              },
        },
      ],
    },
  ];

  const DrawerSectionLabel = ({ label }: { label: string }) => (
    <Text
      fontSize="10px"
      fontWeight={600}
      letterSpacing="0.12em"
      textTransform="uppercase"
      color="dim"
      pl={4}
      pt={3}
      pb={1}
      userSelect="none"
    >
      {label}
    </Text>
  );

  return (
    <>
      {/* Fixed bottom tab bar */}
      <Flex
        as="nav"
        position="fixed"
        bottom={0}
        left={0}
        right={0}
        zIndex={999}
        display={{ base: "flex", md: "none" }}
        bg="background"
        borderTop="1px solid"
        borderColor="border"
        h="calc(60px + env(safe-area-inset-bottom))"
        align="center"
        justify="space-around"
        sx={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {tabs.map((tab) => {
          const active = "href" in tab && tab.href ? isActive(tab.href) : false;

          const handlePress = () => {
            if ("menu" in tab && tab.menu) {
              setIsDrawerOpen(true);
            } else if ("href" in tab && tab.href) {
              router.push(tab.href);
            }
          };

          if ("center" in tab && tab.center) {
            return (
              <Box
                key={tab.name}
                as="button"
                aria-label={tab.name}
                onClick={handlePress}
                display="flex"
                alignItems="center"
                justifyContent="center"
                w="52px"
                h="52px"
                mb="18px"
                borderRadius="full"
                bg={active ? "primary" : "background"}
                border="3px solid"
                borderColor="primary"
                boxShadow="0 0 8px var(--chakra-colors-primary)"
                _active={{ transform: "scale(0.94)" }}
                transition="transform 0.15s ease"
              >
                <Icon
                  as={tab.icon}
                  boxSize={6}
                  color={active ? "background" : "primary"}
                />
              </Box>
            );
          }

          return (
            <Box
              key={tab.name}
              as="button"
              aria-label={tab.name}
              onClick={handlePress}
              position="relative"
              flex="1"
              h="full"
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              gap="2px"
              color={active ? "primary" : "text"}
              _active={{ opacity: 0.7 }}
            >
              <Box position="relative">
                <Icon as={tab.icon} boxSize={5} />
                {"badge" in tab && tab.badge && tab.badge > 0 ? (
                  <Box
                    position="absolute"
                    top="-4px"
                    right="-6px"
                    bg="red.500"
                    borderRadius="full"
                    w="8px"
                    h="8px"
                  />
                ) : null}
              </Box>
              <Text fontSize="9px" fontWeight={active ? 700 : 500}>
                {tab.name}
              </Text>
            </Box>
          );
        })}
      </Flex>

      {/* Navigation Drawer (full nav + login) */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        placement="left"
        size="xs"
      >
        <DrawerOverlay bg="blackAlpha.700" />
        <DrawerContent bg="background" borderRight="1px solid" borderColor="primary">
          <DrawerCloseButton color="primary" />

          {/* Logo */}
          <Box pl={4} pt={4} pb={2}>
            <Image
              src="/logos/SKATE_HIVE_CIRCLE.svg"
              alt="SkateHive"
              w="48px"
              h="48px"
              cursor="pointer"
              onClick={() => navigateTo("/")}
            />
          </Box>

          <DrawerBody px={0} overflowY="auto">
            <VStack spacing={0} align="stretch">
              {navGroups.map((group) => (
                <Box key={group.label}>
                  <DrawerSectionLabel label={group.label} />
                  <VStack spacing={0} align="stretch">
                    {group.items.map((item) => {
                      const active =
                        item.href === "/"
                          ? pathname === "/"
                          : item.href && pathname?.startsWith(item.href);
                      return (
                        <Box
                          key={item.href || item.name}
                          as="button"
                          type="button"
                          w="full"
                          textAlign="left"
                          display="flex"
                          alignItems="center"
                          pl={4}
                          py={1.5}
                          cursor="pointer"
                          color={active ? "background" : "text"}
                          bg={active ? "primary" : "transparent"}
                          _hover={{ bg: "primary", color: "background" }}
                          transition="all 0.15s ease"
                          onClick={() => {
                            if ("onClick" in item && item.onClick) {
                              item.onClick();
                            } else if (item.href) {
                              navigateTo(item.href);
                            }
                          }}
                        >
                          <HStack spacing={3}>
                            <Box position="relative">
                              <Icon as={item.icon} boxSize={4} />
                              {"badge" in item && item.badge && item.badge > 0 ? (
                                <Box
                                  position="absolute"
                                  top="-4px"
                                  right="-6px"
                                  bg="red.500"
                                  borderRadius="full"
                                  w="8px"
                                  h="8px"
                                />
                              ) : null}
                            </Box>
                            <Text fontSize="sm">{item.name}</Text>
                          </HStack>
                        </Box>
                      );
                    })}
                  </VStack>
                </Box>
              ))}

              {/* Report Bug */}
              <Box pt={2}>
                <Box
                  as="button"
                  type="button"
                  w="full"
                  textAlign="left"
                  display="flex"
                  alignItems="center"
                  pl={4}
                  py={1.5}
                  cursor="pointer"
                  _hover={{ bg: "primary", color: "background" }}
                  transition="all 0.15s ease"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    openReport({ type: "bug" });
                  }}
                >
                  <HStack spacing={3}>
                    <Icon as={FiFlag} boxSize={4} />
                    <Text fontSize="sm">{tSettings("reportBugTab")}</Text>
                  </HStack>
                </Box>
              </Box>

              {/* Logout option */}
              {(user || isFarcasterConnected) && (
                <Box pt={2}>
                  <DrawerSectionLabel label="" />
                  <Box
                    as="button"
                    type="button"
                    w="full"
                    textAlign="left"
                    display="flex"
                    alignItems="center"
                    pl={4}
                    py={1.5}
                    cursor="pointer"
                    color="error"
                    _hover={{ bg: "primary", color: "background" }}
                    transition="all 0.15s ease"
                    onClick={handleLogout}
                  >
                    <HStack spacing={3}>
                      <Icon as={FiLogOut} boxSize={4} />
                      <Text fontSize="sm">Logout</Text>
                    </HStack>
                  </Box>
                </Box>
              )}
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <HiveLoginModal
        isOpen={modalDisplayed}
        onClose={() => setModalDisplayed(false)}
        onSuccess={() => setIsConnectionModalOpen(false)}
      />
      <ConnectionModal
        isOpen={isConnectionModalOpen}
        onClose={safeCloseConnectionModal}
        onHiveLogin={handleHiveLogin}
        onFarcasterConnect={handleFarcasterConnect}
        isFarcasterAuthInProgress={isFarcasterAuthInProgress}
        actualFarcasterConnection={actualFarcasterConnection}
        actualFarcasterProfile={actualFarcasterProfile}
      />
      <FarcasterAuthIsland
        onSuccess={handleFarcasterSuccess}
        onError={handleFarcasterError}
      />
    </>
  );
}
