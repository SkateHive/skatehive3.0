"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { CSSReset } from "@chakra-ui/react";
import { Aioha } from "@aioha/aioha";
import { AiohaProvider } from "@aioha/react-ui";
import { ThemeProvider } from "./themeProvider";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider, http, fallback } from "wagmi";
import { base, mainnet, arbitrum } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UserProvider } from "@/contexts/UserContext";
import { UserbaseAuthProvider } from "@/contexts/UserbaseAuthContext";
import { LinkedIdentityProvider } from "@/contexts/LinkedIdentityContext";
import { VoteWeightProvider } from "@/contexts/VoteWeightContext";
import { WindowProvider } from "@/contexts/WindowContext";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { ReportProvider } from "@/contexts/ReportContext";
import { PostingKeyDialogProvider } from "@/contexts/PostingKeyDialogContext";
// import { ClientOnlyAuthKit } from "@/components/providers/ClientOnlyAuthKit"; // Removed: not needed, auth-kit works without global provider
import { dynamicRainbowTheme } from "@/lib/themes/rainbowkitTheme";
import { useState, useEffect } from "react";
import { APP_CONFIG } from "@/config/app.config";
import { ClickSoundProvider } from "./clickSoundProvider";
import { SoundSettingsProvider } from "@/contexts/SoundSettingsContext";
import UserbaseWalletBootstrapper from "@/components/userbase/UserbaseWalletBootstrapper";
import { FarcasterFrameInit } from "@/components/providers/FarcasterFrameInit";

const aioha = new Aioha();

if (typeof window !== "undefined") {
  aioha.registerKeychain();
  aioha.registerLedger();
  aioha.registerPeakVault();
  aioha.registerHiveAuth({
    name: APP_CONFIG.NAME.toLowerCase(),
    description: "",
  });
  aioha.loadAuth();
}

// Create wagmiConfig once at module level to prevent re-initialization
let wagmiConfigInstance: ReturnType<typeof getDefaultConfig> | null = null;

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_KEY || "";

function getWagmiConfig() {
  if (!wagmiConfigInstance) {
    wagmiConfigInstance = getDefaultConfig({
      appName: APP_CONFIG.NAME,
      projectId: APP_CONFIG.WALLETCONNECT_PROJECT_ID,
      chains: [base, mainnet, arbitrum],
      // viem's default public RPCs are rate-limited/unreliable from browsers
      // (mainnet default eth.merkle.io answered Cloudflare 1015 on 2026-08-22,
      // which showed mainnet balances as 0 and blocked swaps/stakes). Use
      // Alchemy when a key is present, with public fallbacks.
      transports: {
        [base.id]: fallback([
          ...(ALCHEMY_KEY ? [http(`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`)] : []),
          http("https://mainnet.base.org"),
          http(),
        ]),
        [mainnet.id]: fallback([
          ...(ALCHEMY_KEY ? [http(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`)] : []),
          http("https://ethereum-rpc.publicnode.com"),
          http(),
        ]),
        [arbitrum.id]: fallback([
          ...(ALCHEMY_KEY ? [http(`https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`)] : []),
          http("https://arb1.arbitrum.io/rpc"),
          http(),
        ]),
      },
      ssr: true,
    });
  }
  return wagmiConfigInstance;
}

// Export for external use
export const wagmiConfig = getWagmiConfig();

export function Providers({ children }: { children: React.ReactNode }) {
  // Create QueryClient inside the component to avoid SSR issues
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
            retry: (failureCount, error: any) => {
              // Don't retry on 4xx errors except 429 (rate limit)
              if (
                error?.status >= 400 &&
                error?.status < 500 &&
                error?.status !== 429
              ) {
                return false;
              }
              return failureCount < 3;
            },
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <SoundSettingsProvider>
      <ClickSoundProvider>
        <LocaleProvider>
          <UserbaseAuthProvider>
            <ThemeProvider>
              <QueryClientProvider client={queryClient}>
                <WagmiProvider config={wagmiConfig}>
                  {/* No `initialChain`: RainbowKit would pass chainId=Base to every
                      connect, and wagmi's WalletConnect connector then sends
                      wallet_switchEthereumChain and AWAITS the change — a Safe session
                      is chain-bound, so that hung/broke connections from mainnet and
                      forced everyone to Base. Without it RainbowKit keeps the wallet's
                      own chain when supported, else falls back to chains[0] (Base). */}
                  <RainbowKitProvider
                    coolMode
                    theme={dynamicRainbowTheme}
                  >
                    <AiohaProvider aioha={aioha}>
                      <LinkedIdentityProvider>
                        <UserProvider>
                          <VoteWeightProvider>
                            <WindowProvider>
                              <CSSReset />
                              <FarcasterFrameInit />
                              <UserbaseWalletBootstrapper />
                              <ReportProvider>
                                <PostingKeyDialogProvider>
                                  {children}
                                </PostingKeyDialogProvider>
                              </ReportProvider>
                            </WindowProvider>
                          </VoteWeightProvider>
                        </UserProvider>
                      </LinkedIdentityProvider>
                    </AiohaProvider>
                  </RainbowKitProvider>
                </WagmiProvider>
              </QueryClientProvider>
            </ThemeProvider>
          </UserbaseAuthProvider>
        </LocaleProvider>
      </ClickSoundProvider>
    </SoundSettingsProvider>
  );
}
