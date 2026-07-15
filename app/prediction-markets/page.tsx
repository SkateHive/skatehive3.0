import { Metadata } from "next";
import { APP_CONFIG } from "@/config/app.config";
import PredictionMarketsPage from "@/components/predictions/PredictionMarketsPage";

const BASE_URL = APP_CONFIG.BASE_URL;
const ogImageUrl = `${BASE_URL}/api/og/page?title=Prediction%20Markets&subtitle=Parimutuel%20markets%20on%20Hive`;

export const metadata: Metadata = {
  title: "Prediction Markets — Skatehive",
  description:
    "Browse and bet on Hive prediction markets from Skatehive. Parimutuel markets powered by hivepredict.",
  openGraph: {
    title: "Prediction Markets — Skatehive",
    description: "Parimutuel prediction markets on Hive, powered by hivepredict.",
    url: `${BASE_URL}/prediction-markets`,
    siteName: "Skatehive",
    type: "website",
    images: [{ url: ogImageUrl, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Prediction Markets — Skatehive",
    description: "Parimutuel prediction markets on Hive.",
    images: [ogImageUrl],
  },
  alternates: { canonical: `${BASE_URL}/prediction-markets` },
};

export default function Page() {
  return <PredictionMarketsPage />;
}
