import { Metadata } from "next";
import { APP_CONFIG, HIVE_CONFIG } from "@/config/app.config";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";

const BASE_URL = APP_CONFIG.BASE_URL;

// Fetch recent posts server-side for SSR content (Google sees real posts in HTML)
async function fetchRecentPostTitles(): Promise<
  { title: string; author: string; permlink: string }[]
> {
  try {
    const res = await fetch("https://api.hive.blog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "bridge.get_ranked_posts",
        params: {
          sort: "created",
          tag: HIVE_CONFIG.COMMUNITY_TAG,
          limit: 10,
          observer: "",
        },
        id: 1,
      }),
      next: { revalidate: 3600 }, // Cache 1h
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.result || []).map(
      (p: { title: string; author: string; permlink: string }) => ({
        title: p.title,
        author: p.author,
        permlink: p.permlink,
      })
    );
  } catch {
    return [];
  }
}

export const metadata: Metadata = {
  title: "Skate Blog — Videos, Tricks, Spots & Stories from Skaters Worldwide",
  description:
    "Watch skate videos, learn new tricks, discover street spots, and read stories from the global skateboarding community. New content daily from skaters around the world.",
  keywords: [
    "skate blog",
    "skateboarding videos",
    "skate tricks",
    "skateboard blog",
    "skate videos",
    "street skating",
    "skatepark videos",
    "skateboarding community",
    "skate content",
  ],
  alternates: {
    canonical: `${BASE_URL}/blog`,
  },
  openGraph: {
    title: "Skate Blog — Videos, Tricks & Stories | Skatehive",
    description:
      "Watch skate videos, learn tricks, discover spots, and read stories from skaters worldwide. New content daily.",
    url: `${BASE_URL}/blog`,
    siteName: "Skatehive",
    type: "website",
    images: [
      {
        url: "/ogimage.png",
        width: 1200,
        height: 630,
        alt: "Skatehive Blog - Skateboarding content from around the world",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Skate Blog — Videos, Tricks & Stories | Skatehive",
    description:
      "Watch skate videos, learn tricks, discover spots. New content daily from skaters worldwide.",
    images: ["/ogimage.png"],
  },
};

export default async function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const recentPosts = await fetchRecentPostTitles();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Skatehive Blog",
    description:
      "Watch skate videos, learn new tricks, discover street spots, and read stories from the global skateboarding community.",
    url: `${BASE_URL}/blog`,
    publisher: {
      "@type": "Organization",
      name: "Skatehive",
      url: BASE_URL,
      logo: { "@type": "ImageObject", url: `${BASE_URL}/ogimage.png` },
    },
    inLanguage: "en",
    isPartOf: {
      "@type": "WebSite",
      name: "Skatehive",
      url: BASE_URL,
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${BASE_URL}/blog` },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
      />
      {/* SSR content block — Google sees real post titles in initial HTML */}
      {recentPosts.length > 0 && (
        <div
          data-ssr-seo="true"
          style={{
            position: "absolute",
            width: "1px",
            height: "1px",
            padding: 0,
            margin: "-1px",
            overflow: "hidden",
            clip: "rect(0, 0, 0, 0)",
            whiteSpace: "nowrap",
            borderWidth: 0,
          }}
        >
          <h1>Skate Blog — Videos, Tricks, Spots and Stories from Skaters Worldwide</h1>
          <p>
            Watch skate videos, learn new tricks, discover street spots, and read stories
            from the global skateboarding community. New content daily.
          </p>
          <h2>Latest Posts</h2>
          <ul>
            {recentPosts.map((post) => (
              <li key={`${post.author}/${post.permlink}`}>
                <a href={`${BASE_URL}/post/${post.author}/${post.permlink}`}>
                  {post.title}
                </a>{" "}
                by @{post.author}
              </li>
            ))}
          </ul>
        </div>
      )}
      {children}
    </>
  );
}
