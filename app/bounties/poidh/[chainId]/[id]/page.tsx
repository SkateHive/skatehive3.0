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

    // Amount may be in wei (large integer) or already in ETH (decimal string)
    let amountInEth = 0;
    if (bounty.amount) {
      const raw = bounty.amount.toString();
      if (raw.includes('.') || parseFloat(raw) < 1e10) {
        // Already in ETH (decimal string or small number)
        amountInEth = parseFloat(raw);
      } else {
        // In wei — convert
        try {
          amountInEth = parseFloat(formatEther(BigInt(raw)));
        } catch {
          amountInEth = parseFloat(raw) || 0;
        }
      }
    }
    const amountStr = amountInEth < 0.001
      ? amountInEth.toFixed(6)
      : amountInEth < 1
        ? amountInEth.toFixed(4)
        : amountInEth.toFixed(2);

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

    const bountyPageUrl = `${baseUrl}/bounties/poidh/${chainId}/${id}`;
    const ogImageUrl = ogUrl.toString();
    const buttonTitle = isActive ? "Claim Bounty" : "View Bounty";

    return {
      title: pageTitle,
      description,
      openGraph: {
        title: `${pageTitle} | Skatehive`,
        description,
        url: bountyPageUrl,
        images: [
          {
            url: ogImageUrl,
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
        images: [ogImageUrl],
      },
      other: {
        // Farcaster Frame v2 (mini-app)
        "fc:frame": JSON.stringify({
          version: "next",
          imageUrl: ogImageUrl,
          button: {
            title: buttonTitle,
            action: {
              type: "launch_frame",
              name: "Skatehive",
              url: bountyPageUrl,
            },
          },
          postUrl: bountyPageUrl,
        }),
        "fc:frame:image": ogImageUrl,
        "fc:frame:post_url": bountyPageUrl,
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
