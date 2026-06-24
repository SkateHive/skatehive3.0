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
  cast?: string[];
  type?: string;
  dataSource?: string;
  svsSlug?: string;
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

// ISR: pages render on-demand and are cached for a day. Brand index
// pages are still prerendered at build (small set, frequent entry
// points); video pages defer to first-visit because there are 600+ and
// most see little traffic. Saves ~15s on every build.
export const revalidate = 86400; // 1 day
export const dynamicParams = true;

export async function generateStaticParams() {
  return brands.map((b) => ({ slug: brandSlug(b) }));
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
      other: {
      "fc:frame": JSON.stringify({
        version: "next",
        imageUrl: `${BASE_URL}/ogimage.png`,
        button: {
          title: `${brandName} Videos`,
          action: { type: "launch_frame", name: "Skatehive", url: `${BASE_URL}/cinema/${slug}` },
        },
        postUrl: `${BASE_URL}/cinema/${slug}`,
      }),
      "fc:frame:image": `${BASE_URL}/ogimage.png`,
      "fc:frame:post_url": `${BASE_URL}/cinema/${slug}`,
    },
    alternates: { canonical: `${BASE_URL}/cinema/${slug}` },
    };
  }

  const video = videos.find((v) => v.slug === slug);
  if (!video) return { title: "Video Not Found" };

  const title = `${video.title} — Skatehive Cinema`;
  const rawDescription = video.description || `Watch ${video.title} from ${video.brand}. Classic skateboarding video from the Skatehive cinema archive.`;
  const description = rawDescription.length > 160 ? rawDescription.substring(0, 157) + "..." : rawDescription;
  const normalizedTitle = video.title.toLowerCase();
  const isGrindMovie = slug === "grind-the-movie-2003" || normalizedTitle.includes("grind");

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
      isGrindMovie ? "grind movie" : "",
      isGrindMovie ? "grind 2003" : "",
      isGrindMovie ? "grind skate movie" : "",
      isGrindMovie ? "cult skateboarding movie" : "",
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
    other: {
      "fc:frame": JSON.stringify({
        version: "next",
        imageUrl: video.thumbnail,
        button: {
          title: "Watch Film",
          action: { type: "launch_frame", name: "Skatehive", url: `${BASE_URL}/cinema/${slug}` },
        },
        postUrl: `${BASE_URL}/cinema/${slug}`,
      }),
      "fc:frame:image": video.thumbnail,
      "fc:frame:post_url": `${BASE_URL}/cinema/${slug}`,
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
    "@type": video.type === "film" ? "Movie" : "VideoObject",
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
    ...(video.cast?.length && {
      actor: video.cast.map((name) => ({ "@type": "Person", name })),
    }),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }} />
      <CinemaVideoPage video={video} relatedVideos={relatedVideos} />
    </>
  );
}
