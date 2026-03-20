import { Metadata } from "next";
import { notFound } from "next/navigation";
import { APP_CONFIG } from "@/config/app.config";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";
import cinemaData from "@/public/data/cinema.json";
import CinemaVideoPage from "@/components/cinema/CinemaVideoPage";
import CinemaContent from "@/components/cinema/CinemaContent";

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
  soundtrack?: { part: string; song: string }[];
  skaters?: string[];
}

const videos = cinemaData.videos as CinemaVideo[];
const brands = cinemaData.brands as string[];

function brandSlug(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const brandSlugMap = new Map<string, string>();
for (const brand of brands) {
  brandSlugMap.set(brandSlug(brand), brand);
}

export async function generateStaticParams() {
  const videoParams = videos.map((v) => ({ slug: v.slug }));
  const brandParams = brands.map((b) => ({ slug: brandSlug(b) }));
  return [...videoParams, ...brandParams];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  // Check if slug is a brand
  const brandName = brandSlugMap.get(slug);
  if (brandName) {
    const count = videos.filter((v) => v.brand === brandName).length;
    return {
      title: `${brandName} Skate Videos — Skatehive Cinema`,
      description: `Watch ${count} classic ${brandName} skateboarding videos. Full-length films and edits from the Skatehive cinema archive.`,
      keywords: [brandName.toLowerCase(), "skateboard video", "classic skate video", "full length", "skateboarding film"],
      openGraph: {
        title: `${brandName} Skate Videos — Skatehive Cinema`,
        description: `Watch ${count} classic ${brandName} skateboarding videos.`,
        url: `${BASE_URL}/cinema/${slug}`,
        siteName: "Skatehive",
        type: "website",
      },
      alternates: { canonical: `${BASE_URL}/cinema/${slug}` },
    };
  }

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

  // Brand page: /cinema/zero → show cinema filtered to Zero
  const brandName = brandSlugMap.get(slug);
  if (brandName) {
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${brandName} Skate Videos`,
      description: `Classic ${brandName} skateboarding videos from the Skatehive cinema archive.`,
      url: `${BASE_URL}/cinema/${slug}`,
      isPartOf: { "@type": "WebSite", name: "Skatehive", url: BASE_URL },
    };
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }} />
        <CinemaContent initialBrand={brandName} />
      </>
    );
  }

  // Video page: /cinema/girl-yeah-right-2003
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
    publisher: { "@type": "Organization", name: "Skatehive", url: BASE_URL },
    ...(video.brand !== "Other" && {
      productionCompany: { "@type": "Organization", name: video.brand },
    }),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }} />
      <CinemaVideoPage video={video} relatedVideos={relatedVideos} />
    </>
  );
}
