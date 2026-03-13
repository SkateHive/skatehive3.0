import { Metadata } from "next";
import { Box } from "@chakra-ui/react";
import PoidhBountyList from "@/components/bounties/PoidhBountyList";
import { APP_CONFIG } from "@/config/app.config";

export const metadata: Metadata = {
  title: "POIDH Skate Bounties — Base & Arbitrum | Skatehive",
  description:
    "Browse skate-related POIDH bounties from Base and Arbitrum in one clean page.",
  alternates: {
    canonical: `${APP_CONFIG.BASE_URL}/bounties/poidh`,
  },
};

export default function PoidhBountiesPage() {
  return (
    <Box
      maxW="1200px"
      mx="auto"
      py={{ base: 4, md: 8 }}
      px={{ base: 4, md: 6 }}
      className="hide-scrollbar"
      style={{ overflowY: "auto", height: "100vh" }}
    >
      <PoidhBountyList />
    </Box>
  );
}
