"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { CSSReset } from "@chakra-ui/react";
import { Aioha } from "@aioha/aioha";
import { AiohaProvider } from "@aioha/react-ui";
import { ThemeProvider } from "./themeProvider";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider, http } from "wagmi";
import { base, mainnet } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UserProvider } from "@/contexts/UserContext";
import { UserbaseAuthProvider } from "@/contexts/UserbaseAuthContext";
import { LinkedIdentityProvider } from "@/contexts/LinkedIdentityContext";
import { VoteWeightProvider } from "@/contexts/VoteWeightContext";
import { WindowProvider } from "@/contexts/WindowContext";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { AuthKitProvider } from "@farcaster/auth-kit";
import "@farcaster/auth-kit/styles.css";
import { dynamicRainbowTheme } from "@/lib/themes/rainbowkitTheme";
import { useState, useEffect } from "react";
import { APP_CONFIG } from "@/config/app.config";
import { ClickSoundProvider } from "./clickSoundProvider";
import { SoundSettingsProvider } from "@/contexts/SoundSettingsContext";
import UserbaseWalletBootstrapper from "@/components/userbase/UserbaseWalletBootstrapper";

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

function getWagmiConfig() {
  if (!wagmiConfigInstance) {
    wagmiConfigInstance = getDefaultConfig({
      appName: APP_CONFIG.NAME,
      projectId: APP_CONFIG.WALLETCONNECT_PROJECT_ID,
      chains: [base, mainnet],
      transports: {
        [base.id]: http(),
        [mainnet.id]: http(),
      },
      ssr: true,
    });
  }
  return wagmiConfigInstance;
}

// Export for external use
export const wagmiConfig = getWagmiConfig();

export function Providers({ children }: { children: React.ReactNode }) {
  // Stable Farcaster config - use server-safe defaults, update on client mount
  const [farcasterAuthConfig, setFarcasterAuthConfig] = useState<{
    rpcUrl: string;
    domain: string;
    siweUri: string;
    relay: string;
  }>(() => ({
    rpcUrl: "https://mainnet.optimism.io",
    domain: APP_CONFIG.DOMAIN,
    siweUri: `https://${APP_CONFIG.DOMAIN}`,
    relay: "https://relay.farcaster.xyz",
  }));

  // Update with client-specific values after mount to avoid hydration mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setFarcasterAuthConfig(prev => ({
        ...prev,
        domain: window.location.host,
        siweUri: window.location.href,
      }));
    }
  }, []);

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
            <UserProvider>
              <ThemeProvider>
                <QueryClientProvider client={queryClient}>
                  <WagmiProvider config={wagmiConfig}>
                    <RainbowKitProvider
                      coolMode
                      initialChain={base}
                      theme={dynamicRainbowTheme}
                    >
                      <OnchainKitProvider
                        chain={base}
                        apiKey={APP_CONFIG.ONCHAINKIT_API_KEY}
                      >
                        <AuthKitProvider config={farcasterAuthConfig}>
                          <AiohaProvider aioha={aioha}>
                            <LinkedIdentityProvider>
                              <VoteWeightProvider>
                                <WindowProvider>
                                  <CSSReset />
                                  <UserbaseWalletBootstrapper />
                                  {children}
                                </WindowProvider>
                              </VoteWeightProvider>
                            </LinkedIdentityProvider>
                          </AiohaProvider>
                        </AuthKitProvider>
                      </OnchainKitProvider>
                    </RainbowKitProvider>
                  </WagmiProvider>
                </QueryClientProvider>
              </ThemeProvider>
            </UserProvider>
          </UserbaseAuthProvider>
        </LocaleProvider>
      </ClickSoundProvider>
    </SoundSettingsProvider>
  );
}
