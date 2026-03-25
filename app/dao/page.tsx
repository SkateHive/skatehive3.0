import { Metadata } from "next";
import DAOPageClient from "@/components/dao/DAOPageClient";

export const metadata: Metadata = {
  title: "DAO - Skatehive Governance",
  description:
    "Explore Skatehive DAO governance, proposals, auctions, and treasury.",
  openGraph: {
    title: "DAO - Skatehive Governance",
    description:
      "Explore Skatehive DAO governance, proposals, auctions, and treasury.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DAO - Skatehive Governance",
    description:
      "Explore Skatehive DAO governance, proposals, auctions, and treasury.",
  },
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: "https://skatehive.app/ogimage.png",
      button: {
        title: "View DAO",
        action: { type: "launch_frame", name: "Skatehive", url: "https://skatehive.app/dao" },
      },
      postUrl: "https://skatehive.app/dao",
    }),
    "fc:frame:image": "https://skatehive.app/ogimage.png",
    "fc:frame:post_url": "https://skatehive.app/dao",
  },
};

export default function DAOPage() {
  return <DAOPageClient />;
}
