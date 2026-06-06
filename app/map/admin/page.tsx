import type { Metadata } from "next";
import SpotmapAdminClient from "./SpotmapAdminClient";

// Admin-only — keep it out of Google's index even if the URL leaks.
export const metadata: Metadata = {
  title: "Spot Map Sync — Admin | Skatehive",
  robots: { index: false, follow: false },
};

export default function SpotmapAdminPage() {
  return <SpotmapAdminClient />;
}
