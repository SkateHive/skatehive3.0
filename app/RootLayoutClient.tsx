"use client";
import { useState, useEffect } from "react";
import {
  Box,
  Container,
  Flex,
  useBreakpointValue,
  useDisclosure,
} from "@chakra-ui/react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useReport } from "@/contexts/ReportContext";
import Sidebar from "@/components/layout/Sidebar";
import FooterNavButtons from "@/components/layout/FooterNavButtons";
import FooterLinks from "@/components/layout/FooterLinks";
import SplashScreen from "@/components/layout/SplashScreen";
import { Providers } from "./providers";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { Analytics } from "@vercel/analytics/next";
import InitFrameSDK from "@/hooks/init-frame-sdk";
import { SkaterData } from "@/types/leaderboard";

// Deferred — not needed for first paint
const SearchOverlay = dynamic(() => import("@/components/shared/SearchOverlay"), { ssr: false });
const AirdropModal = dynamic(() => import("@/components/airdrop/AirdropModal"), { ssr: false });
const ReportModal = dynamic(() => import("@/components/report/ReportModal"), { ssr: false });
const AccountLinkingDetector = dynamic(() => import("@/components/layout/AccountLinkingDetector"), { ssr: false });
const CommunityToasts = dynamic(() => import("@/components/homepage/CommunityToasts"), { ssr: false });
const IOSAppBanner = dynamic(() => import("@/components/shared/IOSAppBanner"), { ssr: false });
const HZCEasterEgg = dynamic(() => import("@/components/shared/HZCEasterEgg"), { ssr: false });
const WindowDock = dynamic(() => import("@/components/shared/WindowDock"), { ssr: false });

export default function RootLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const {
    isOpen: isAirdropOpen,
    onOpen: onAirdropOpen,
    onClose: onAirdropClose,
  } = useDisclosure();
  const [leaderboardData, setLeaderboardData] = useState<SkaterData[]>([]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Lazy-load leaderboard data only when airdrop modal opens
  useEffect(() => {
    if (!isAirdropOpen || leaderboardData.length > 0) return;
    async function fetchLeaderboardData() {
      try {
        const res = await fetch("https://api.skatehive.app/api/v2/leaderboard", {
          next: { revalidate: 300 },
        });
        if (res.ok) {
          const data = await res.json();
          setLeaderboardData(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Error fetching leaderboard data:", error);
      }
    }
    fetchLeaderboardData();
  }, [isAirdropOpen, leaderboardData.length]);

  // Global keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        setIsSearchOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    // Set theme from localStorage before showing app
    const theme = localStorage.getItem("theme") || "skate";
    document.documentElement.setAttribute("data-theme", theme);
    document.body.classList.add("show-splash");

    // Hide splash and show app after hydration
    const splash = document.getElementById("splash-root");
    const app = document.getElementById("app-root");
    if (splash && app) {
      splash.style.display = "none";
      app.style.display = "";
      document.body.classList.remove("show-splash");
    }
  }, []);

  // Only show splash screen after hydration to avoid SSR/client mismatch
  if (!isHydrated) {
    return (
      <>
        <Analytics />
        <Providers>
          <NotificationProvider>
            <InnerLayout
              searchProps={{ isSearchOpen, setIsSearchOpen }}
              airdropProps={{
                isAirdropOpen,
                onAirdropOpen,
                onAirdropClose,
                leaderboardData,
              }}
            >
              {children}
            </InnerLayout>
          </NotificationProvider>
        </Providers>
      </>
    );
  }

  if (loading) return <SplashScreen onFinish={() => setLoading(false)} />;

  return (
    <>
      <InitFrameSDK />
      <Analytics />
      <Providers>
        <NotificationProvider>
          <InnerLayout
            searchProps={{ isSearchOpen, setIsSearchOpen }}
            airdropProps={{
              isAirdropOpen,
              onAirdropOpen,
              onAirdropClose,
              leaderboardData,
            }}
          >
            {children}
          </InnerLayout>
        </NotificationProvider>
      </Providers>
    </>
  );
}

function InnerLayout({
  children,
  searchProps,
  airdropProps,
}: {
  children: React.ReactNode;
  searchProps?: {
    isSearchOpen: boolean;
    setIsSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  };
  airdropProps?: {
    isAirdropOpen: boolean;
    onAirdropOpen: () => void;
    onAirdropClose: () => void;
    leaderboardData: SkaterData[];
  };
}) {
  const isMobile = useBreakpointValue({ base: true, md: false });
  const pathname = usePathname();
  // ReportContext lives inside <Providers>, so useReport() is safe here
  const { isOpen: isReportOpen, openReport, closeReport, reportOptions } = useReport();

  // Pages with infinite scroll should not show footer
  const hasInfiniteScroll =
    pathname === "/" ||
    pathname?.startsWith("/user/") ||
    pathname === "/magazine" ||
    pathname === "/blog" ||
    pathname?.startsWith("/blog/tag/") ||
    pathname === "/videos" ||
    pathname === "/skaters";

  const handleOpenAirdrop = () => {
    if (searchProps) searchProps.setIsSearchOpen(false);
    if (airdropProps) airdropProps.onAirdropOpen();
  };

  const handleOpenReport = () => {
    if (searchProps) searchProps.setIsSearchOpen(false);
    openReport();
  };

  return (
    <Container
      maxW={{ base: "100%", md: "container.xl" }}
      p={0}
      overflowX="hidden"
      sx={{
        // Keep outer container clean; actual scrolling happens in the main content Box.
        overflowX: "hidden",
      }}
    >
      {searchProps && (
        <SearchOverlay
          isOpen={searchProps.isSearchOpen}
          onClose={() => searchProps.setIsSearchOpen(false)}
          onOpenAirdrop={handleOpenAirdrop}
          onOpenReport={handleOpenReport}
        />
      )}

      {/* Airdrop Modal */}
      {airdropProps && (
        <AirdropModal
          isOpen={airdropProps.isAirdropOpen}
          onClose={airdropProps.onAirdropClose}
          leaderboardData={airdropProps.leaderboardData}
        />
      )}

      {/* Report Modal — driven by ReportContext; works via /report command and ErrorBoundary */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={closeReport}
        initialData={reportOptions}
      />

      {/* iOS App Store Banner - iPhone only */}
      <IOSAppBanner />

      {/* Global Community Toast Notifications - Desktop only */}
      <CommunityToasts />

      {/* Window Dock for minimized windows */}
      <WindowDock />

      {/* Account Linking Detector - auto-prompts when wallets are connected */}
      <AccountLinkingDetector />

      {/* HZC Easter Egg */}
      <HZCEasterEgg onTrigger={() => searchProps?.setIsSearchOpen(false)} />

      <Flex direction={{ base: "column", md: "row" }} minH="100vh">
        <Sidebar />
        <Box
          flex="1"
          overflowY="auto"
          overflowX="hidden"
          height="100vh"
          sx={{
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": {
              display: "none",
            },
          }}
        >
          {children}
          {!isMobile && !hasInfiniteScroll && <FooterLinks />}
        </Box>
      </Flex>
      {isMobile && <FooterNavButtons />}
    </Container>
  );
}
