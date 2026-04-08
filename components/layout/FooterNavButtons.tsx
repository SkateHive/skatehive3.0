"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  Box,
  Text,
  HStack,
  VStack,
  IconButton,
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
} from "react-icons/fi";
import { useReport } from "@/contexts/ReportContext";

export default function FooterNavButtons() {
  const { openReport } = useReport();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAioha();
  const [modalDisplayed, setModalDisplayed] = useState(false);
  const toast = useToast();
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');

  // Farcaster integration - use methods from island
  const farcasterMethods = useFarcasterAuthMethods();
  const { signIn, signOut, connect, reconnect, isSuccess, isError } = farcasterMethods;

  const {
    isAuthenticated: isFarcasterConnected,
    profile: farcasterProfile,
    clearSession,
  } = useFarcasterSession();
  const { isInMiniapp, user: miniappUser, isReady } = useFarcasterMiniapp();
  const [isFarcasterAuthInProgress, setIsFarcasterAuthInProgress] =
    useState(false);

  // Safety timeout ref to prevent stuck loading states
  const authTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear auth timeout when component unmounts or auth completes
  const clearAuthTimeout = useCallback(() => {
    if (authTimeoutRef.current) {
      clearTimeout(authTimeoutRef.current);
      authTimeoutRef.current = null;
    }
  }, []);

  // Farcaster callbacks
  const handleFarcasterSuccess = useCallback(
    ({ fid, username }: any) => {
      clearAuthTimeout();
      setIsFarcasterAuthInProgress(false);

      setTimeout(() => {
        signOut();
      }, 100);

      setIsConnectionModalOpen(false);
      setTimeout(() => {
        toast({
          title: tAuth('connectedSuccess'),
          description: `${tAuth('connectedSuccess')} as @${username}`,
          status: 'success',
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
        title: tAuth('connectionFailed'),
        description: tAuth('connectionFailed') + '. ' + tCommon('pleaseTryAgain'),
        status: 'error',
        duration: 3000,
      });
    },
    [clearAuthTimeout, toast, tAuth, tCommon]
  );

  // Safety timeout to reset auth progress if callbacks don't fire
  const setAuthTimeoutSafety = useCallback(() => {
    clearAuthTimeout(); // Clear any existing timeout

    // Set a safety timeout for abandoned auth attempts
    authTimeoutRef.current = setTimeout(() => {
      setIsFarcasterAuthInProgress(false);
      // Optional: Show a gentle message that auth was cancelled
      toast({
        title: tAuth('authenticationFailed'),
        description: "Farcaster connection was cancelled or timed out",
        status: "info",
        duration: 2000,
      });
    }, 10000); // 10 seconds - more reasonable for abandoned auth
  }, [clearAuthTimeout, toast, tAuth]);

  // Determine combined Farcaster status
  const actualFarcasterConnection =
    isFarcasterConnected || (isInMiniapp && !!miniappUser);
  const actualFarcasterProfile = farcasterProfile || miniappUser;

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Connection modal state with proper management
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isModalTransitioning, setIsModalTransitioning] = useState(false);

  // Client-side only rendering to avoid hydration issues
  const [isClient, setIsClient] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [touchTimer, setTouchTimer] = useState<NodeJS.Timeout | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);

  // Safe modal close handler to prevent conflicts
  const safeCloseConnectionModal = useCallback(() => {
    if (isModalTransitioning) {
      return; // Prevent multiple close calls
    }

    setIsModalTransitioning(true);
    setIsConnectionModalOpen(false);
    clearAuthTimeout(); // Clear any pending auth timeout
    setIsFarcasterAuthInProgress(false); // Clear auth progress when closing

    // Only reset Auth Kit state if user manually closes modal while connected
    // Don't interfere with success callback flow
    if (isSuccess && actualFarcasterConnection && !isFarcasterAuthInProgress) {
      signOut();
    }

    // Clear transition flag after modal animation
    setTimeout(() => {
      setIsModalTransitioning(false);
    }, 300);
  }, [
    isModalTransitioning,
    isSuccess,
    actualFarcasterConnection,
    signOut,
    clearAuthTimeout,
    isFarcasterAuthInProgress,
  ]);

  // Track previous connection state to detect disconnections (still needed for reconnection logic)
  const [previousFarcasterConnection, setPreviousFarcasterConnection] =
    useState(false);

  // Handle connection state changes for disconnection detection only (removed mobile auth timeout logic)
  React.useEffect(() => {
    const currentConnection =
      isFarcasterConnected || (isInMiniapp && !!miniappUser);

    // Only track connection state changes for disconnection detection
    // Don't interfere with auth progress state - let callbacks handle that
    setPreviousFarcasterConnection(currentConnection);
  }, [isFarcasterConnected, isInMiniapp, miniappUser]);

  // Reset Auth Kit state when modal opens if user is already connected (but not during auth flow)
  React.useEffect(() => {
    if (
      isConnectionModalOpen &&
      actualFarcasterConnection &&
      (isSuccess || isError) &&
      !isFarcasterAuthInProgress // Only reset if not currently authenticating
    ) {
      // Reset the Auth Kit state to prevent automatic modal reopening
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

  // Monitor Auth Kit state to detect when modal is closed without completing auth
  React.useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let visibilityTimeoutId: NodeJS.Timeout;

    if (isFarcasterAuthInProgress && !isSuccess && !isError) {
      // Only check for modal dismissal on desktop - mobile doesn't show modals
      if (!isMobile) {
        // Set a shorter check interval to detect Auth Kit modal dismissal on desktop
        timeoutId = setTimeout(() => {
          // If we're still in auth progress but no Auth Kit modal appears to be active
          // This is a heuristic - we assume if enough time passes without success/error,
          // the user has dismissed the modal
          const authKitModalExists = document.querySelector(
            '[class*="fc-authkit-signin-modal"], [data-testid*="farcaster"], .farcaster-auth-modal'
          );

          if (!authKitModalExists && isFarcasterAuthInProgress) {
            clearAuthTimeout();
            setIsFarcasterAuthInProgress(false);
          }
        }, 2000); // Check after 2 seconds

        // Listen for escape key presses that might close the modal (desktop only)
        const handleEscapeKey = (event: KeyboardEvent) => {
          if (
            event.key === "Escape" &&
            isFarcasterAuthInProgress &&
            !isSuccess &&
            !isError
          ) {
            // Small delay to allow modal to actually close before checking
            setTimeout(() => {
              const authKitModalExists = document.querySelector(
                '[class*="fc-authkit-signin-modal"], [data-testid*="farcaster"], .farcaster-auth-modal'
              );
              if (!authKitModalExists) {
                clearAuthTimeout();
                setIsFarcasterAuthInProgress(false);
              }
            }, 100);
          }
        };

        document.addEventListener("keydown", handleEscapeKey);

        return () => {
          if (timeoutId) clearTimeout(timeoutId);
          if (visibilityTimeoutId) clearTimeout(visibilityTimeoutId);
          document.removeEventListener("keydown", handleEscapeKey);
        };
      }

      // Focus/visibility detection works for both desktop and mobile
      // This catches cases where users switch apps/tabs during auth
      const handleVisibilityChange = () => {
        if (
          !document.hidden &&
          isFarcasterAuthInProgress &&
          !isSuccess &&
          !isError
        ) {
          // User returned focus to main document - on desktop, check if modal still exists
          // On mobile, this might indicate return from external app
          visibilityTimeoutId = setTimeout(() => {
            if (!isMobile) {
              // Desktop: check for modal
              const authKitModalExists = document.querySelector(
                '[class*="fc-authkit-signin-modal"], [data-testid*="farcaster"], .farcaster-auth-modal'
              );
              if (!authKitModalExists && isFarcasterAuthInProgress) {
                clearAuthTimeout();
                setIsFarcasterAuthInProgress(false);
              }
            }
            // Mobile: don't do anything here, let callbacks handle it
          }, 500);
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("focus", handleVisibilityChange);

      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (visibilityTimeoutId) clearTimeout(visibilityTimeoutId);
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        );
        window.removeEventListener("focus", handleVisibilityChange);
      };
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (visibilityTimeoutId) clearTimeout(visibilityTimeoutId);
    };
  }, [
    isFarcasterAuthInProgress,
    isSuccess,
    isError,
    clearAuthTimeout,
    isMobile,
  ]);

  // Detect mobile browser (not miniapp)
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const checkMobile = () => {
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobileDevice =
          /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
            userAgent
          );
        const isMobileBrowser = isMobileDevice && window.innerWidth <= 768;
        setIsMobile(isMobileBrowser);
      };

      checkMobile();
      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
    }
  }, []);

  // Calculate initial position for client-side
  const getInitialPosition = useCallback(() => {
    if (typeof window !== "undefined") {
      return {
        x: window.innerWidth - 84, // 64px button + 20px padding
        y: window.innerHeight - 124, // 64px button + 60px from bottom
      };
    }
    return { x: 20, y: 60 }; // This won't be used since we only render on client
  }, []);

  const [position, setPosition] = useState(getInitialPosition);

  // Safely get notification count with fallback - MOVED BEFORE CONDITIONAL RETURN
  let newNotificationCount = 0;
  try {
    const notificationContext = useNotifications();
    newNotificationCount = notificationContext.newNotificationCount;
  } catch (error) {
    // Context not available yet, use default value
    newNotificationCount = 0;
  }

  // Handle drag start - only for mouse (desktop)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // For desktop, we can start dragging immediately
    e.preventDefault();
    setIsDragging(true);
    const rect = dragRef.current?.getBoundingClientRect();
    if (rect) {
      setDragStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  }, []);

  // Handle drag move
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const buttonSize = 64;
      const padding = 20; // Padding from screen edges

      // Calculate new position relative to viewport
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      // Keep button within viewport bounds with padding
      const clampedX = Math.max(
        padding,
        Math.min(newX, viewportWidth - buttonSize - padding)
      );
      const clampedY = Math.max(
        padding,
        Math.min(newY, viewportHeight - buttonSize - padding)
      );

      setPosition({ x: clampedX, y: clampedY });
    },
    [isDragging, dragStart]
  );

  // Handle drag end
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      // Add snap-to-edge functionality for desktop too
      const viewportWidth = window.innerWidth;
      const buttonSize = 64;
      const padding = 20;
      const currentX = position.x;

      // Snap to the nearest edge (left or right)
      const snapToLeft = currentX < viewportWidth / 2;
      const newX = snapToLeft ? padding : viewportWidth - buttonSize - padding;

      setIsSnapping(true);
      setPosition((prev) => ({ ...prev, x: newX }));

      // Reset snapping state after animation
      setTimeout(() => setIsSnapping(false), 400);
    }

    setIsDragging(false);
  }, [isDragging, position.x]);

  // Touch event handlers for mobile with hold-to-drag
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // Clear any existing timer
      if (touchTimer) {
        clearTimeout(touchTimer);
      }

      const touch = e.touches[0];
      const rect = dragRef.current?.getBoundingClientRect();
      if (rect) {
        const startPos = {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        };
        setDragStart(startPos);
      }

      // Start a timer for hold-to-drag (250ms delay - responsive)
      const timer = setTimeout(() => {
        setIsHolding(true);
        setIsDragging(true);
        // Enhanced haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate([30, 10, 30]); // Pattern: vibrate-pause-vibrate
        }
      }, 250);

      setTouchTimer(timer);
    },
    [touchTimer]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      // If we're not holding yet, check if user moved too much and cancel the timer
      if (!isHolding && touchTimer) {
        const touch = e.touches[0];
        const rect = dragRef.current?.getBoundingClientRect();
        if (rect) {
          const moveDistance = Math.sqrt(
            Math.pow(touch.clientX - (rect.left + dragStart.x), 2) +
              Math.pow(touch.clientY - (rect.top + dragStart.y), 2)
          );

          // If user moves more than 10px before the timer, cancel hold-to-drag
          if (moveDistance > 10) {
            clearTimeout(touchTimer);
            setTouchTimer(null);
            return;
          }
        }
      }

      // Only handle drag if we're actually dragging
      if (!isDragging) return;

      e.preventDefault();
      const touch = e.touches[0];
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const buttonSize = 64;
      const padding = 20; // Padding from screen edges

      const newX = touch.clientX - dragStart.x;
      const newY = touch.clientY - dragStart.y;

      const clampedX = Math.max(
        padding,
        Math.min(newX, viewportWidth - buttonSize - padding)
      );
      const clampedY = Math.max(
        padding,
        Math.min(newY, viewportHeight - buttonSize - padding)
      );

      setPosition({ x: clampedX, y: clampedY });
    },
    [isDragging, dragStart, isHolding, touchTimer]
  );

  const handleTouchEnd = useCallback(() => {
    // Clear any existing timer
    if (touchTimer) {
      clearTimeout(touchTimer);
      setTouchTimer(null);
    }

    // If we were dragging, add snap-to-edge functionality
    if (isDragging) {
      const viewportWidth = window.innerWidth;
      const buttonSize = 64;
      const padding = 20;
      const currentX = position.x;

      // Snap to the nearest edge (left or right)
      const snapToLeft = currentX < viewportWidth / 2;
      const newX = snapToLeft ? padding : viewportWidth - buttonSize - padding;

      setIsSnapping(true);
      setPosition((prev) => ({ ...prev, x: newX }));

      // Reset snapping state after animation
      setTimeout(() => setIsSnapping(false), 400);

      // Gentle haptic feedback for snap
      if (navigator.vibrate) {
        navigator.vibrate(25);
      }
    }

    setIsHolding(false);
    setIsDragging(false);
  }, [touchTimer, position.x, isDragging]);

  // Connection modal handlers
  const handleHiveLogin = () => {
    safeCloseConnectionModal();
    // Add a small delay to ensure the ConnectionModal closes first
    setTimeout(() => {
      setModalDisplayed(true);
    }, 400); // Increased delay to ensure modal transition completes
  };

  const handleFarcasterConnect = async () => {
    // Prevent rapid clicks during auth process
    if (isFarcasterAuthInProgress || isModalTransitioning) {
      return;
    }

    setIsFarcasterAuthInProgress(true);
    setAuthTimeoutSafety(); // Start safety timeout

    try {
      // Check if already connected
      if (actualFarcasterConnection) {
        const connectedProfile = actualFarcasterProfile;
        clearAuthTimeout(); // Clear safety timeout since we're exiting early
        setIsFarcasterAuthInProgress(false); // Clear the loading state
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

      // Scenario 1: Farcaster Miniapp - Auto-authenticated
      if (isInMiniapp && miniappUser) {
        clearAuthTimeout(); // Clear safety timeout since we're exiting early
        safeCloseConnectionModal();
        toast({
          title: tAuth('connectedSuccess'),
          description: `${tAuth('connectedSuccess')} as @${miniappUser.username} via Farcaster miniapp`,
          status: "success",
          duration: 3000,
        });
        return;
      }

      // Scenario 2: In miniapp but no user context
      if (isInMiniapp && !miniappUser) {
        clearAuthTimeout(); // Clear safety timeout since we're exiting early
        toast({
          title: tAuth('authenticationFailed'),
          description: "Please ensure you're signed into Farcaster",
          status: "error",
          duration: 3000,
        });
        return;
      }

      // Must call connect() first to create relay channel,
      // then signIn() after channelToken is set (handled by useEffect)
      connect();
    } catch {
      clearAuthTimeout(); // Clear safety timeout on error
      setIsFarcasterAuthInProgress(false); // Reset immediately on error
      safeCloseConnectionModal();
      toast({
        title: tAuth('connectionFailed'),
        description: tAuth('connectionFailed') + ". " + tCommon('pleaseTryAgain'),
        status: "error",
        duration: 3000,
      });
    }
    // Note: No finally block - let callbacks handle state reset for successful flows
  };

  // Once connect() sets channelToken, call signIn() to start polling
  React.useEffect(() => {
    if (isFarcasterAuthInProgress && farcasterMethods.channelToken) {
      signIn();
    }
  }, [isFarcasterAuthInProgress, farcasterMethods.channelToken, signIn]);

  // Only render on client to avoid hydration mismatch
  React.useEffect(() => {
    setIsClient(true);
    setPosition(getInitialPosition());
  }, [getInitialPosition]);

  // Update position on window resize
  React.useEffect(() => {
    if (!isClient) return;

    const handleResize = () => {
      if (!isDragging) {
        setPosition(getInitialPosition());
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isDragging, isClient, getInitialPosition]);

  // Add event listeners for mouse move and up
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Add touch event listeners
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener("touchmove", handleTouchMove, {
        passive: false,
      });
      document.addEventListener("touchend", handleTouchEnd, {
        passive: false,
      });
      return () => {
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleTouchEnd);
      };
    }
  }, [isDragging, handleTouchMove, handleTouchEnd]);

  // Cleanup timers on unmount
  React.useEffect(() => {
    return () => {
      if (touchTimer) {
        clearTimeout(touchTimer);
      }
      clearAuthTimeout(); // Also cleanup auth timeout
    };
  }, [touchTimer, clearAuthTimeout]);

  // Don't render anything on server side - MOVED TO END AFTER ALL HOOKS
  if (!isClient) {
    return null;
  }

  // Drawer navigation helper
  const navigateTo = (path: string) => {
    setIsDrawerOpen(false);
    router.push(path);
  };

  // Logout handler
  const handleLogout = async () => {
    setIsDrawerOpen(false);
    try {
      if (user) {
        const { aioha } = await import("@aioha/react-ui").then(m => ({ aioha: null }));
        // Use the aioha instance from the hook context
      }
      if (isFarcasterConnected && clearSession) {
        clearSession();
      }
      // Reload to clear all state
      window.location.href = "/";
    } catch {
      window.location.href = "/";
    }
  };

  // Grouped navigation matching sidebar structure
  const navGroups = [
    {
      label: "PRIMARY",
      items: [
        { icon: FiHome, href: "/", name: t('home') },
        { icon: FiBook, href: "/blog", name: t('magazine') },
        { icon: FiAward, href: "/leaderboard", name: t('leaderboard') },
      ],
    },
    {
      label: "EXPLORE",
      items: [
        { icon: FiMap, href: "/map", name: t('skatespots') },
        { icon: FiZap, href: "/tricks", name: "Tricks" },
        { icon: FiVideo, href: "/videos", name: "Videos" },
        { icon: FiFilm, href: "/cinema", name: "Cinema" },
        { icon: FiUsers, href: "/skaters", name: "Skaters" },
      ],
    },
    {
      label: "COMMUNITY",
      items: [
        { icon: FiTarget, href: "/bounties", name: t('bounties') },
        { icon: FiPlay, href: "/games", name: "Games" },
        { icon: FiTrendingUp, href: "/auction", name: t('auction') },
        ...(user ? [{ icon: FiMail, href: "/invite", name: t('invite') }] : []),
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
                name: t('notifications'),
                badge: newNotificationCount,
              },
            ]
          : []),
        { icon: FiCreditCard, href: "/wallet", name: t('wallet') },
        { icon: FiSettings, href: "/settings", name: t('settings') },
        {
          icon: FiUser,
          href: user ? `/user/${user}?view=snaps` : "",
          name: user ? t('profile') : tCommon('login'),
          onClick: user ? undefined : () => { setIsDrawerOpen(false); setIsConnectionModalOpen(true); },
        },
      ],
    },
  ];

  // Section label component for drawer
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
      {/* Floating draggable button */}
      <Box
        ref={dragRef}
        position="fixed"
        left={`${position.x}px`}
        top={`${position.y}px`}
        zIndex="999"
        display={{ base: "block", md: "none" }}
        userSelect="none"
        style={{
          transform: isDragging
            ? "scale(1.08) rotate(2deg)"
            : isHolding
            ? "scale(1.04)"
            : "scale(1)",
          transition: isDragging
            ? "none"
            : isSnapping
            ? "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
            : "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          filter: isDragging
            ? "drop-shadow(0 8px 16px rgba(0, 0, 0, 0.3))"
            : "none",
        }}
      >
        {/* Drag handles */}
        {[
          { pos: "top", style: { top: "-15px", left: "50%", transform: "translateX(-50%)", width: "40px", height: "15px" }, dir: "row" as const },
          { pos: "bottom", style: { bottom: "-15px", left: "50%", transform: "translateX(-50%)", width: "40px", height: "15px" }, dir: "row" as const },
          { pos: "left", style: { left: "-15px", top: "50%", transform: "translateY(-50%)", width: "15px", height: "40px" }, dir: "column" as const },
          { pos: "right", style: { right: "-15px", top: "50%", transform: "translateY(-50%)", width: "15px", height: "40px" }, dir: "column" as const },
        ].map((handle) => (
          <Box
            key={handle.pos}
            position="absolute"
            {...handle.style}
            cursor={isDragging ? "grabbing" : "grab"}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onClick={(e) => e.stopPropagation()}
            borderRadius="none"
            bg="rgba(255, 255, 255, 0.1)"
            _hover={{ bg: "rgba(255, 255, 255, 0.2)" }}
            display="flex"
            alignItems="center"
            justifyContent="center"
            flexDirection={handle.dir}
          >
            <Box display="flex" flexDirection={handle.dir} gap="2px">
              {[0, 1, 2].map((i) => (
                <Box key={i} w="3px" h="3px" bg="rgba(255, 255, 255, 0.6)" borderRadius="full" />
              ))}
            </Box>
          </Box>
        ))}

        {/* Main button - opens drawer */}
        <IconButton
          aria-label="Navigation Menu"
          onClick={() => !isDragging && setIsDrawerOpen(true)}
          icon={
            <Image
              src="/logos/SKATE_HIVE_CIRCLE.svg"
              alt="SkateHive Navigation Menu"
              transition="all 0.3s ease"
              transform={isDragging ? "rotate(-2deg)" : "rotate(0deg)"}
            />
          }
          bg="primary"
          color="background"
          borderRadius="full"
          size="xl"
          boxShadow={
            isDragging
              ? "0 0 8px 8px var(--chakra-colors-primary), 0 8px 32px rgba(0, 0, 0, 0.4)"
              : "0 0 4px 4px var(--chakra-colors-primary)"
          }
          _hover={{
            bg: "primary",
            transform: isDragging ? "scale(1)" : "scale(1.10)",
            boxShadow: isDragging
              ? "0 0 8px 8px var(--chakra-colors-primary), 0 8px 32px rgba(0, 0, 0, 0.4)"
              : "0 0 32px 16px var(--chakra-colors-primary)",
          }}
          _active={{ bg: "primary" }}
          position="relative"
          minW="64px"
          minH="64px"
          pointerEvents={isDragging ? "none" : "auto"}
          sx={{
            animation: isDragging ? "none" : "glowPump 2.2s infinite",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            "@keyframes glowPump": {
              "0%": { boxShadow: "0 0 2px 2px var(--chakra-colors-primary)" },
              "50%": { boxShadow: "0 0 4px 4px var(--chakra-colors-primary)" },
              "100%": { boxShadow: "0 0 2px 2px var(--chakra-colors-primary)" },
            },
          }}
        >
          {newNotificationCount > 0 && (
            <Box
              position="absolute"
              top="-8px"
              right="-8px"
              bg="red.500"
              color="white"
              borderRadius="full"
              fontSize="md"
              minW="28px"
              h="28px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              fontWeight="bold"
            >
              {newNotificationCount}
            </Box>
          )}
        </IconButton>
      </Box>

      {/* Navigation Drawer */}
      <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} placement="left" size="xs">
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
                      const isActive = item.href === "/"
                        ? pathname === "/"
                        : item.href && pathname?.startsWith(item.href);
                      return (
                        <Box
                          key={item.href || item.name}
                          display="flex"
                          alignItems="center"
                          pl={4}
                          py={1.5}
                          cursor="pointer"
                          color={isActive ? "background" : "text"}
                          bg={isActive ? "primary" : "transparent"}
                          _hover={{ bg: "primary", color: "background" }}
                          transition="all 0.15s ease"
                          onClick={() => {
                            if (item.onClick) {
                              item.onClick();
                            } else {
                              navigateTo(item.href);
                            }
                          }}
                        >
                          <HStack spacing={3}>
                            <Box position="relative">
                              <Icon as={item.icon} boxSize={4} />
                              {item.badge && item.badge > 0 ? (
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
                  display="flex"
                  alignItems="center"
                  pl={4}
                  py={1.5}
                  cursor="pointer"
                  _hover={{ bg: "primary", color: "background" }}
                  transition="all 0.15s ease"
                  onClick={() => { setIsDrawerOpen(false); openReport({ type: "bug" }); }}
                >
                  <HStack spacing={3}>
                    <Icon as={FiFlag} boxSize={4} />
                    <Text fontSize="sm">Report Bug</Text>
                  </HStack>
                </Box>
              </Box>

              {/* Logout option */}
              {(user || isFarcasterConnected) && (
                <Box pt={2}>
                  <DrawerSectionLabel label="" />
                  <Box
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
