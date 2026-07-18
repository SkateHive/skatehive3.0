import { Metadata } from "next";
import { APP_CONFIG } from "@/config/app.config";
import { HIVEPREDICT_API_BASE } from "@/lib/predictions/constants";
import MarketDetail from "@/components/predictions/MarketDetail";
import HiveAccessGate from "@/components/predictions/HiveAccessGate";

const BASE_URL = APP_CONFIG.BASE_URL;

// OG/Twitter card for shared market links (X, Discord, Farcaster, …).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const url = `${BASE_URL}/hivepredict/${encodeURIComponent(id)}`;
  let title = "Prediction Market — Skatehive";
  let description = "Parimutuel prediction markets on Hive.";

  // Same deadline as the API proxy — metadata must never stall page render.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(
      `${HIVEPREDICT_API_BASE}/markets/${encodeURIComponent(id)}`,
      { next: { revalidate: 60 }, signal: controller.signal }
    );
    if (res.ok) {
      const market = await res.json();
      if (market?.title) {
        title = `${market.title} — Skatehive Predictions`;
        description = `Pool ${market.totalPool ?? "0"} ${market.token ?? "HIVE"} · bet on Hive via Skatehive.`;
      }
    }
  } catch {
    /* fall back to generic card */
  } finally {
    clearTimeout(timeout);
  }

  const ogImageUrl = `${BASE_URL}/api/og/page?title=${encodeURIComponent(
    "Prediction Market"
  )}&subtitle=${encodeURIComponent(title)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Skatehive",
      type: "website",
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
    alternates: { canonical: url },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <HiveAccessGate>
      <MarketDetail id={id} />
    </HiveAccessGate>
  );
}
