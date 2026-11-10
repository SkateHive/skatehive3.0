import { Metadata } from "next";
import { APP_CONFIG } from "@/config/app.config";
import DownloadPageClient from "@/components/download/DownloadPageClient";

export const metadata: Metadata = {
  title: "Download the Skatehive app | iOS & Android",
  description:
    "Get the Skatehive app: post clips, find skate spots and play skate or dice. App Store for iPhone, APK for Android.",
  alternates: { canonical: `${APP_CONFIG.BASE_URL}/download` },
  openGraph: {
    title: "Download the Skatehive app",
    description: "Skatehive in your pocket. App Store for iPhone, APK for Android.",
    url: `${APP_CONFIG.BASE_URL}/download`,
  },
};

export default function DownloadPage() {
  return <DownloadPageClient />;
}
