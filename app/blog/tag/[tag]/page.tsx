import { Metadata } from "next";
import { APP_CONFIG, HIVE_CONFIG } from "@/config/app.config";
import HiveClient from "@/lib/hive/hiveclient";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";
import TagPageClient from "./TagPageClient";

const BASE_URL = APP_CONFIG.BASE_URL;

type Props = {
  params: Promise<{ tag: string }>;
};

type RankedPost = {
  author?: string;
  permlink?: string;
  title?: string;
  created?: string;
};

async function fetchPostsByTag(tag: string): Promise<RankedPost[]> {
  try {
    const posts: RankedPost[] = await HiveClient.call(
      "bridge",
      "get_ranked_posts",
      {
        sort: "created",
        tag,
        limit: 20,
        observer: "",
      },
    );
    return posts || [];
  } catch {
    return [];
  }
}

function formatTagTitle(tag: string): string {
  return tag
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { tag } = await props.params;
  const decodedTag = decodeURIComponent(tag);
  const title = formatTagTitle(decodedTag);
  const tagUrl = `${BASE_URL}/blog/tag/${decodedTag}`;

  return {
    title: `${title} - Skateboarding Posts`,
    description: `Browse skateboarding posts tagged with "${decodedTag}" on Skatehive. Discover tricks, spots, and content from the skateboarding community.`,
    alternates: {
      canonical: tagUrl,
    },
    openGraph: {
      title: `${title} - Skatehive`,
      description: `Skateboarding posts tagged "${decodedTag}" on Skatehive.`,
      url: tagUrl,
      siteName: "Skatehive",
      type: "website",
      images: [
        {
          url: "/ogimage.png",
          width: 1200,
          height: 630,
          alt: `Skatehive - ${title}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} - Skatehive`,
      description: `Skateboarding posts tagged "${decodedTag}" on Skatehive.`,
      images: ["/ogimage.png"],
    },
  };
}

export default async function TagPage(props: Props) {
  const { tag } = await props.params;
  const decodedTag = decodeURIComponent(tag);
  const title = formatTagTitle(decodedTag);

  const posts = await fetchPostsByTag(decodedTag);

  // CollectionPage JSON-LD
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${title} - Skatehive`,
    description: `Skateboarding posts tagged "${decodedTag}" on Skatehive.`,
    url: `${BASE_URL}/blog/tag/${decodedTag}`,
    isPartOf: {
      "@type": "WebSite",
      name: "Skatehive",
      url: BASE_URL,
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: posts.length,
      itemListElement: posts
        .filter((p) => p?.author && p?.permlink)
        .slice(0, 10)
        .map((post, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${BASE_URL}/post/${post.author}/${post.permlink}`,
          name: post.title || "Skatehive Post",
        })),
    },
  };

  // BreadcrumbList JSON-LD
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: BASE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${BASE_URL}/blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: title,
        item: `${BASE_URL}/blog/tag/${decodedTag}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(breadcrumbJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(collectionJsonLd),
        }}
      />
      <TagPageClient tag={decodedTag} initialPosts={posts} />
    </>
  );
}
