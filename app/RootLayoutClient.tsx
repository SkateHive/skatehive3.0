"use client";
import { useState, useEffect } from "react";
import {
  Box,
  Container,
  Flex,
  useBreakpointValue,
  useDisclosure,
} from "@chakra-ui/react";
import Sidebar from "@/components/layout/Sidebar";
import FooterNavButtons from "@/components/layout/FooterNavButtons";
import SplashScreen from "@/components/layout/SplashScreen";
import SearchOverlay from "@/components/shared/SearchOverlay";
import AirdropModal from "@/components/airdrop/AirdropModal";
import { Providers } from "./providers";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { Analytics } from "@vercel/analytics/next";
import InitFrameSDK from "@/hooks/init-frame-sdk";

// Type for skater data
interface SkaterData {
  id: number;
  hive_author: string;
  hive_balance: number;
  hp_balance: number;
  hbd_balance: number;
  hbd_savings_balance: number;
  has_voted_in_witness: boolean;
  eth_address: string;
  gnars_balance: number;
  gnars_votes: number;
  skatehive_nft_balance: number;
  max_voting_power_usd: number;
  last_updated: string;
  last_post: string;
  post_count: number;
  points: number;
  giveth_donations_usd: number;
  giveth_donations_amount: number;
}

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

  // Fetch leaderboard data for airdrop modal
  useEffect(() => {
    async function fetchLeaderboardData() {
      try {
        const res = await fetch("https://api.skatehive.app/api/skatehive", {
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
  }, []);

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

  const handleOpenAirdrop = () => {
    // Close search modal first
    if (searchProps) {
      searchProps.setIsSearchOpen(false);
    }
    // Open airdrop modal
    if (airdropProps) {
      airdropProps.onAirdropOpen();
    }
  };

  return (
    <Container
      maxW={{ base: "100%", md: "container.xl" }}
      p={0}
      overflowX="hidden"
      sx={{
        "&::-webkit-scrollbar": { display: "none" },
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      {searchProps && (
        <SearchOverlay
          isOpen={searchProps.isSearchOpen}
          onClose={() => searchProps.setIsSearchOpen(false)}
          onOpenAirdrop={handleOpenAirdrop}
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

      <Flex direction={{ base: "column", md: "row" }} minH="100vh">
        <Sidebar />
        <Box
          flex="1"
          overflowY="auto"
          overflowX="hidden"
          height="100vh"
          sx={{
            "&::-webkit-scrollbar": {
              display: "none",
              width: "0",
              height: "0",
            },
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {children}
        </Box>
      </Flex>
      {isMobile && <FooterNavButtons />}
    </Container>
  );
}
