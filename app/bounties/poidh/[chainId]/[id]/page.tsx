import { Metadata } from "next";
import { PoidhBountyDetail } from "@/components/bounties/PoidhBountyDetail";
import { APP_CONFIG } from "@/config/app.config";
import { CHAIN_LABEL } from "@/lib/poidh-constants";
import { formatEther } from "viem";

interface PageProps {
  params: Promise<{ chainId: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { chainId, id } = await params;

  try {
    const baseUrl = APP_CONFIG.BASE_URL || "https://skatehive.app";
    const res = await fetch(`${baseUrl}/api/poidh/bounties/${chainId}/${id}`, {
      next: { revalidate: 300 },
    });

    if (!res.ok) throw new Error("Failed to fetch bounty");
    const bounty = await res.json();

    const amountInEth = bounty.amount
      ? parseFloat(formatEther(BigInt(bounty.amount)))
      : 0;
    const amountStr = amountInEth < 0.001
      ? amountInEth.toFixed(6)
      : amountInEth < 1
        ? amountInEth.toFixed(4)
        : amountInEth.toString();

    const chain = CHAIN_LABEL[parseInt(chainId)] || "Base";
    const isActive = bounty.isActive ?? !bounty.claimer;
    const status = isActive ? "OPEN" : "CLOSED";
    const title = bounty.name || "POIDH Bounty";
    const claims = bounty.claims?.length?.toString() || "0";

    const ogUrl = new URL(`${baseUrl}/api/og/bounty`);
    ogUrl.searchParams.set("title", title);
    ogUrl.searchParams.set("amount", amountStr);
    ogUrl.searchParams.set("currency", "ETH");
    ogUrl.searchParams.set("source", "poidh");
    ogUrl.searchParams.set("chain", chain.toUpperCase());
    ogUrl.searchParams.set("status", status);
    ogUrl.searchParams.set("claims", claims);

    const pageTitle = `${title} — ${amountStr} ETH Bounty on ${chain}`;
    const description = bounty.description
      ? bounty.description.slice(0, 160)
      : `${amountStr} ETH bounty on ${chain}. Submit your proof and earn!`;

    return {
      title: pageTitle,
      description,
      openGraph: {
        title: `${pageTitle} | Skatehive`,
        description,
        url: `${baseUrl}/bounties/poidh/${chainId}/${id}`,
        images: [
          {
            url: ogUrl.toString(),
            width: 1200,
            height: 630,
            alt: `${title} - ${amountStr} ETH Bounty`,
          },
        ],
        siteName: "Skatehive",
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: `${pageTitle} | Skatehive`,
        description,
        images: [ogUrl.toString()],
      },
    };
  } catch {
    return {
      title: "POIDH Bounty | Skatehive",
      description: "View this bounty on Skatehive",
    };
  }
}

export default async function PoidhBountyPage({ params }: PageProps) {
  const { chainId, id } = await params;
  return <PoidhBountyDetail chainId={chainId} id={id} />;
}
