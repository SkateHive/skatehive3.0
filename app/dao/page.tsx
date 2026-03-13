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
};

export default function DAOPage() {
  return <DAOPageClient />;
}
