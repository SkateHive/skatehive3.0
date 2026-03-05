import { Metadata } from "next";
import { APP_CONFIG } from "@/config/app.config";

const BASE_URL = APP_CONFIG.BASE_URL;

export const metadata: Metadata = {
  title: "Skate Blog — Videos, Tricks, Spots & Stories from Skaters Worldwide",
  description:
    "Watch skate videos, learn new tricks, discover street spots, and read stories from the global skateboarding community. New content daily from skaters around the world.",
  keywords: [
    "skate blog",
    "skateboarding videos",
    "skate tricks",
    "skateboard blog",
    "skate videos",
    "street skating",
    "skatepark videos",
    "skateboarding community",
    "skate content",
  ],
  alternates: {
    canonical: `${BASE_URL}/blog`,
  },
  openGraph: {
    title: "Skate Blog — Videos, Tricks & Stories | Skatehive",
    description:
      "Watch skate videos, learn tricks, discover spots, and read stories from skaters worldwide. New content daily.",
    url: `${BASE_URL}/blog`,
    siteName: "Skatehive",
    type: "website",
    images: [
      {
        url: "/ogimage.png",
        width: 1200,
        height: 630,
        alt: "Skatehive Blog - Skateboarding content from around the world",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Skate Blog — Videos, Tricks & Stories | Skatehive",
    description:
      "Watch skate videos, learn tricks, discover spots. New content daily from skaters worldwide.",
    images: ["/ogimage.png"],
  },
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
