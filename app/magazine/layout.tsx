import { Metadata } from "next";
import { APP_CONFIG } from "@/config/app.config";

const BASE_URL = APP_CONFIG.BASE_URL;

export const metadata: Metadata = {
  title: "Magazine - The Infinity Skateboard Magazine",
  description:
    "Read the Skatehive magazine - a community-driven skateboard magazine featuring the best skateboarding content from around the world.",
  alternates: {
    canonical: `${BASE_URL}/magazine`,
  },
  openGraph: {
    title: "Skatehive Magazine",
    description:
      "Read the Skatehive magazine - a community-driven skateboard magazine.",
    url: `${BASE_URL}/magazine`,
    siteName: "Skatehive",
    type: "website",
    images: [
      {
        url: "/ogimage.png",
        width: 1200,
        height: 630,
        alt: "Skatehive Magazine",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Skatehive Magazine",
    description:
      "Read the Skatehive magazine - a community-driven skateboard magazine.",
    images: ["/ogimage.png"],
  },
};

export default function MagazineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
