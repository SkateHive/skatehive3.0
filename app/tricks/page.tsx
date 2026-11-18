import { Metadata } from "next";
import Link from "next/link";
import { APP_CONFIG, HIVE_CONFIG } from "@/config/app.config";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";
import HiveClient from "@/lib/hive/hiveclient";
import TricksPageWrapper from "@/components/tricks/TricksPageWrapper";
import TrickCard from "@/components/tricks/TrickCard";
import TricksHeader from "@/components/tricks/TricksHeader";
import { extractPostThumbnail } from "@/lib/utils/postThumbnail";
import { TRICK_TUTORIALS } from "@/lib/utils/trickTutorials";
import { TRICK_CATEGORIES } from "@/lib/tricks/catalog";

function extractYouTubeId(url: string): string | null {
    const match = url.match(/(?:[?&]v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return match ? match[1] : null;
}

const BASE_URL = APP_CONFIG.BASE_URL;
const ogImageUrl = `${BASE_URL}/api/og/page?title=Skate%20Tricks&subtitle=Learn%20tricks%20from%20the%20community`;

export const metadata: Metadata = {
    title: "Skateboard Tricks — GIFs, Videos & How-To Clips from Real Skaters",
    description:
        "Browse skateboard tricks with GIFs and video clips from real skaters. Kickflips, ollies, grinds, slides, manuals, and more. Community-filmed trick clips on Skatehive.",
    keywords: [
        "skateboard tricks",
        "skate tricks",
        "kickflip",
        "ollie",
        "skateboard trick list",
        "trick gif",
        "skate trick gif",
        "how to kickflip",
        "skateboard tricks for beginners",
        "grind tricks",
        "slide tricks",
        "flip tricks",
        "skateboarding tricks list",
        "skate clips",
    ],
    openGraph: {
        title: "Skateboard Tricks — GIFs & Videos from Real Skaters | Skatehive",
        description:
            "Browse skate tricks with community-filmed clips. Kickflips, grinds, slides, and more.",
        url: `${BASE_URL}/tricks`,
        siteName: "Skatehive",
        type: "website",
        images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
        card: "summary_large_image",
        title: "Skateboard Tricks — GIFs & Videos | Skatehive",
        description: "Community-filmed skate trick clips. Kickflips, grinds, slides, and more.",
        images: [ogImageUrl],
    },
    other: {
        "fc:frame": JSON.stringify({
            version: "next",
            imageUrl: ogImageUrl,
            button: {
                title: "Browse Tricks",
                action: { type: "launch_frame", name: "Skatehive", url: `${BASE_URL}/tricks` },
            },
            postUrl: `${BASE_URL}/tricks`,
        }),
        "fc:frame:image": ogImageUrl,
        "fc:frame:post_url": `${BASE_URL}/tricks`,
    },
    alternates: {
        canonical: `${BASE_URL}/tricks`,
    },
};

type HivePost = {
    author?: string;
    permlink?: string;
    title?: string;
    created?: string;
    body?: string;
    json_metadata?: unknown;
    category?: string;
};

async function fetchFirstPostForTrick(tags: string[]): Promise<HivePost | null> {
    try {
        const results = await Promise.allSettled(
            tags.map((tag) =>
                HiveClient.call("bridge", "get_ranked_posts", {
                    sort: "created",
                    tag,
                    limit: 10,
                    observer: "",
                })
            )
        );
        for (const r of results) {
            if (r.status !== "fulfilled" || !r.value?.length) continue;
            const community = (r.value as HivePost[]).find(
                (p) => p.category === HIVE_CONFIG.COMMUNITY_TAG
            );
            if (community) return community;
        }
        return null;
    } catch {
        return null;
    }
}

export const revalidate = 300; // ISR: render once, refresh every 5 min (static-safe page)

export default async function TricksPage() {
    // Fetch one representative post per trick in parallel to extract a thumbnail URL.
    // Uses the same limit:1 pattern already established in fetchFirstPostForTrick.
    const allTricks = TRICK_CATEGORIES.flatMap((cat) => cat.tricks);
    const postResults = await Promise.allSettled(
        allTricks.map((trick) => fetchFirstPostForTrick(trick.tags))
    );
    const thumbnailMap = new Map<string, string | null>();
    allTricks.forEach((trick, i) => {
        const result = postResults[i];
        const post = result.status === "fulfilled" ? result.value : null;
        thumbnailMap.set(trick.slug, post ? extractPostThumbnail(post) : null);
    });

    const tutorialThumbnailMap = new Map<string, string>();
    allTricks.forEach((trick) => {
        const url = TRICK_TUTORIALS[trick.slug];
        if (url) {
            const id = extractYouTubeId(url);
            if (id) tutorialThumbnailMap.set(trick.slug, `https://img.youtube.com/vi/${id}/hqdefault.jpg`);
        }
    });

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Skateboard Tricks",
        description:
            "Browse skateboard tricks with community-filmed GIFs and video clips.",
        url: `${BASE_URL}/tricks`,
        isPartOf: {
            "@type": "WebSite",
            name: "Skatehive",
            url: BASE_URL,
        },
        breadcrumb: {
            "@type": "BreadcrumbList",
            itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
                {
                    "@type": "ListItem",
                    position: 2,
                    name: "Tricks",
                    item: `${BASE_URL}/tricks`,
                },
            ],
        },
        mainEntity: {
            "@type": "ItemList",
            name: "Skateboard Trick Categories",
            itemListElement: TRICK_CATEGORIES.flatMap((cat, ci) =>
                cat.tricks.map((trick, ti) => ({
                    "@type": "ListItem",
                    position: ci * 10 + ti + 1,
                    name: trick.name,
                    url: `${BASE_URL}/tricks/${trick.slug}`,
                }))
            ),
        },
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
            />
            <TricksPageWrapper>
                <div
                    style={{
                        maxWidth: "1000px",
                        margin: "0 auto",
                        padding: "24px 16px",
                        minHeight: "100vh",
                    }}
                >
                <TricksHeader />

                {TRICK_CATEGORIES.map((category) => (
                    <section key={category.name} style={{ marginBottom: "40px" }}>
                        <h2
                            style={{
                                fontSize: "1.4rem",
                                fontWeight: "bold",
                                color: "var(--chakra-colors-primary)",
                                marginBottom: "16px",
                                borderBottom: "1px solid #333",
                                paddingBottom: "8px",
                            }}
                        >
                            {category.name}
                        </h2>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns:
                                    "repeat(auto-fill, minmax(200px, 1fr))",
                                gap: "12px",
                            }}
                        >
                            {category.tricks.map((trick) => (
                                <TrickCard
                                    key={trick.slug}
                                    trick={trick}
                                    tutorialThumbnailUrl={tutorialThumbnailMap.get(trick.slug)}
                                    thumbnailUrl={thumbnailMap.get(trick.slug) ?? null}
                                />
                            ))}
                        </div>
                    </section>
                ))}

                <section
                    style={{
                        padding: "32px 0",
                        color: "#aaa",
                        lineHeight: 1.8,
                        borderTop: "1px solid #333",
                        marginTop: "20px",
                    }}
                >
                    <h2
                        style={{
                            fontSize: "1.3rem",
                            color: "#fff",
                            marginBottom: "12px",
                        }}
                    >
                        Learn Skateboard Tricks with Community Clips
                    </h2>
                    <p style={{ marginBottom: "12px" }}>
                        Every trick page shows real clips from skaters around the world,
                        posted on the Hive blockchain through Skatehive. From beginner
                        tricks like ollies and pop shove-its to advanced flip tricks and
                        grinds — all filmed by real skaters, not actors.
                    </p>
                    <p>
                        Want to contribute? Post your trick clips on{" "}
                        <Link href="/compose" style={{ color: "#a7ff00" }}>
                            Skatehive
                        </Link>{" "}
                        with the trick name as a tag, and your clip will automatically
                        appear on the trick page.
                    </p>
                </section>
            </div>
            </TricksPageWrapper>
        </>
    );
}
