import { Metadata } from "next";
import { APP_CONFIG } from "@/config/app.config";

const BASE_URL = APP_CONFIG.BASE_URL;

export const metadata: Metadata = {
  title: "Blog - Skateboarding Content",
  description:
    "Browse the latest skateboarding content from the Skatehive community. Tricks, spots, tutorials, and more from skaters worldwide.",
  alternates: {
    canonical: `${BASE_URL}/blog`,
  },
  openGraph: {
    title: "Skatehive Blog - Skateboarding Content",
    description:
      "Browse the latest skateboarding content from the Skatehive community.",
    url: `${BASE_URL}/blog`,
    siteName: "Skatehive",
    type: "website",
    images: [
      {
        url: "/ogimage.png",
        width: 1200,
        height: 630,
        alt: "Skatehive Blog",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Skatehive Blog",
    description:
      "Browse the latest skateboarding content from the Skatehive community.",
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
