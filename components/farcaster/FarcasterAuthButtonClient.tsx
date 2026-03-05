"use client";

import { SignInButton, AuthKitProvider } from "@farcaster/auth-kit";
import "@farcaster/auth-kit/styles.css";
import { APP_CONFIG } from "@/config/app.config";

const config = {
  relay: "https://relay.farcaster.xyz",
  rpcUrl: "https://mainnet.optimism.io",
  siweUri: APP_CONFIG.SITE_URL,
  domain: APP_CONFIG.DOMAIN || "skatehive.app",
};

export default function FarcasterAuthButtonClient() {
  return (
    <AuthKitProvider config={config}>
      <SignInButton />
    </AuthKitProvider>
  );
}
