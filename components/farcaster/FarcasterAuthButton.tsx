"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@chakra-ui/react";

// Dynamic import with SSR disabled to prevent indexedDB errors
// This is the ONLY correct way to use @farcaster/auth-kit in Next.js
const FarcasterAuthButtonClient = dynamic(
  () => import("./FarcasterAuthButtonClient"),
  {
    ssr: false,
    loading: () => <Spinner size="sm" />,
  }
);

export function FarcasterAuthButton() {
  return <FarcasterAuthButtonClient />;
}
