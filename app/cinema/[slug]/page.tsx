import { Metadata } from "next";
import { notFound } from "next/navigation";
import { APP_CONFIG } from "@/config/app.config";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";
import cinemaData from "@/public/data/cinema.json";
import CinemaVideoPage from "@/components/cinema/CinemaVideoPage";

const BASE_URL = APP_CONFIG.BASE_URL;

interface CinemaVideo {
  slug: string;
  title: string;
  brand: string;
  year: number | null;
  embedUrl: string;
  thumbnail: string;
  description: string;
  channel: string;
  link: string;
}

const videos = cinemaData.videos as CinemaVideo[];

export async function generateStaticParams() {
  return videos.map((v) => ({ slug: v.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const video = videos.find((v) => v.slug === slug);
  if (!video) return { title: "Video Not Found" };

  const title = `${video.title} — Skatehive Cinema`;
  const description = video.description || `Watch ${video.title} from ${video.brand}. Classic skateboarding video from the Skatehive cinema archive.`;

  return {
    title,
    description,
    keywords: [
      video.brand.toLowerCase(),
      "skateboard video",
      "classic skate video",
      video.year ? `${video.year} skate video` : "",
      "full length",
      "skateboarding film",
    ].filter(Boolean),
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/cinema/${slug}`,
      images: [{ url: video.thumbnail, width: 1280, height: 720, alt: video.title }],
      siteName: "Skatehive",
      type: "video.other",
    },
    twitter: {
      card: "summary_large_image",
      title: video.title,
      description,
      images: [video.thumbnail],
    },
    alternates: { canonical: `${BASE_URL}/cinema/${slug}` },
  };
}

export default async function CinemaSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const video = videos.find((v) => v.slug === slug);
  if (!video) notFound();

  const relatedVideos = videos.filter((v) => v.brand === video.brand && v.slug !== video.slug).slice(0, 8);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.title,
    description: video.description || `${video.title} — classic skateboarding video.`,
    thumbnailUrl: video.thumbnail,
    uploadDate: video.year ? `${video.year}-01-01` : undefined,
    embedUrl: video.embedUrl,
    url: `${BASE_URL}/cinema/${slug}`,
    publisher: {
      "@type": "Organization",
      name: "Skatehive",
      url: BASE_URL,
    },
    ...(video.brand !== "Other" && {
      productionCompany: {
        "@type": "Organization",
        name: video.brand,
      },
    }),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }} />
      <CinemaVideoPage video={video} relatedVideos={relatedVideos} />
    </>
  );
}
