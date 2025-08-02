"use client";

import { CSSReset } from "@chakra-ui/react";
import { Aioha } from "@aioha/aioha";
import { AiohaProvider } from "@aioha/react-ui";
import { ThemeProvider } from "./themeProvider";
import { WagmiProvider, http } from "wagmi";
import { base, mainnet } from "wagmi/chains";
import {
  RainbowKitProvider,
  getDefaultConfig,
} from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UserProvider } from "@/contexts/UserContext";
import { VoteWeightProvider } from "@/contexts/VoteWeightContext";
import { AuthKitProvider } from "@farcaster/auth-kit";
import "@farcaster/auth-kit/styles.css";

const aioha = new Aioha();

if (typeof window !== "undefined") {
  aioha.registerKeychain();
  aioha.registerLedger();
  aioha.registerPeakVault();
  aioha.registerHiveAuth({
    name: process.env.NEXT_PUBLIC_COMMUNITY_NAME || "skatehive",
    description: "",
  });
  aioha.loadAuth();
}

const queryClient = new QueryClient();

export const wagmiConfig = getDefaultConfig({
  appName: "Skatehive",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "",
  chains: [base, mainnet],
  transports: {
    [base.id]: http(),
    [mainnet.id]: http(),
  },
  ssr: true,
});

const farcasterAuthConfig = {
  rpcUrl: "https://mainnet.optimism.io",
  domain: process.env.NEXT_PUBLIC_DOMAIN || "skatehive.app",
  // siweUri is optional - Auth Kit handles SIWE verification internally
  // Only needed if you want custom server-side session management
  relay: "https://relay.farcaster.xyz", // Ensure relay is specified
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <WagmiProvider config={wagmiConfig}>
            <RainbowKitProvider chains={[base, mainnet]}>
              <AuthKitProvider config={farcasterAuthConfig}>
                <AiohaProvider aioha={aioha}>
                  <VoteWeightProvider>
                    <CSSReset />
                    {children}
                  </VoteWeightProvider>
                </AiohaProvider>
              </AuthKitProvider>
            </RainbowKitProvider>
          </WagmiProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </UserProvider>
  );
}
