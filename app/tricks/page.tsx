import { Metadata } from "next";
import Link from "next/link";
import { APP_CONFIG, HIVE_CONFIG } from "@/config/app.config";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";
import HiveClient from "@/lib/hive/hiveclient";
import TricksPageWrapper from "@/components/tricks/TricksPageWrapper";
import TrickCard from "@/components/tricks/TrickCard";
import CoachFred from "@/components/tricks/CoachFred";
import { extractPostThumbnail } from "@/lib/utils/postThumbnail";

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

// Trick categories with their tags for Hive lookup
const TRICK_CATEGORIES = [
    {
        name: "Flip Tricks",
        tricks: [
            { name: "Kickflip", slug: "kickflip", tags: ["kickflip"] },
            { name: "Heelflip", slug: "heelflip", tags: ["heelflip"] },
            { name: "Varial Kickflip", slug: "varial-kickflip", tags: ["varial", "varialkickflip"] },
            { name: "Tre Flip (360 Flip)", slug: "tre-flip", tags: ["treflip", "360flip"] },
            { name: "Hardflip", slug: "hardflip", tags: ["hardflip"] },
            { name: "Frontside Flip", slug: "frontside-flip", tags: ["frontsideflip", "fsflip"] },
            { name: "Backside Flip", slug: "backside-flip", tags: ["backsideflip", "bsflip"] },
            { name: "Varial Heelflip", slug: "varial-heelflip", tags: ["varialheel", "varialheeflip"] },
            { name: "Laser Flip", slug: "laser-flip", tags: ["laserflip"] },
        ],
    },
    {
        name: "Flatground",
        tricks: [
            { name: "Ollie", slug: "ollie", tags: ["ollie"] },
            { name: "Nollie", slug: "nollie", tags: ["nollie"] },
            { name: "Pop Shove-it", slug: "pop-shove-it", tags: ["shove", "shoveit", "popshove"] },
            { name: "Frontside Shuvit", slug: "frontside-shuvit", tags: ["frontsideshove", "fsshoveit"] },
            { name: "Backside 180", slug: "backside-180", tags: ["backside180", "bs180"] },
            { name: "Frontside 180", slug: "frontside-180", tags: ["frontside180", "fs180"] },
            { name: "360 Pop Shuvit", slug: "360-pop-shuvit", tags: ["360shove", "3shove"] },
            { name: "One-Foot Ollie", slug: "one-foot-ollie", tags: ["onefootollie", "onefoot"] },
            { name: "Backside Bigspin", slug: "backside-bigspin", tags: ["backsidebigspin", "bsbigspin", "bigspin"] },
            { name: "Manual", slug: "manual", tags: ["manual"] },
            { name: "No Comply", slug: "no-comply", tags: ["nocomply"] },
            { name: "Boneless", slug: "boneless", tags: ["boneless"] },
        ],
    },
    {
        name: "Grinds & Slides",
        tricks: [
            { name: "50-50 Grind", slug: "50-50", tags: ["5050", "grind"] },
            { name: "Boardslide", slug: "boardslide", tags: ["boardslide"] },
            { name: "Nosegrind", slug: "nosegrind", tags: ["nosegrind"] },
            { name: "Smith Grind", slug: "smith-grind", tags: ["smithgrind"] },
            { name: "Feeble Grind", slug: "feeble", tags: ["feeble", "feeblegrind"] },
            { name: "Crooked Grind", slug: "crooked-grind", tags: ["crooks", "crookedgrind"] },
            { name: "Blunt to Fakie", slug: "blunt-to-fakie", tags: ["blunttofakie", "blunt", "bluntfakie"] },
            { name: "Wallride", slug: "wallride", tags: ["wallride"] },
        ],
    },
    {
        name: "Transition",
        tricks: [
            { name: "Drop In", slug: "drop-in", tags: ["dropin"] },
            { name: "Rock to Fakie", slug: "rock-to-fakie", tags: ["rocktofakie", "rock"] },
            { name: "Axle Stall", slug: "axle-stall", tags: ["axlestall"] },
            { name: "Frontside Air", slug: "frontside-air", tags: ["frontsideair"] },
            { name: "Backside Air", slug: "backside-air", tags: ["backsideair"] },
        ],
    },
];

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
                <header style={{ textAlign: "center", marginBottom: "32px" }}>
                    <h1
                        style={{
                            fontSize: "2.2rem",
                            fontWeight: "bold",
                            color: "#a7ff00",
                            marginBottom: "12px",
                        }}
                    >
                        Skateboard Tricks
                    </h1>
                    <p
                        style={{
                            fontSize: "1.1rem",
                            color: "#ccc",
                            maxWidth: "600px",
                            margin: "0 auto",
                            lineHeight: 1.6,
                        }}
                    >
                        Learn tricks and browse clips filmed by real skaters from the Skatehive
                        community. Click any trick for tutorials, GIFs, videos, and posts.
                    </p>
                </header>

                {TRICK_CATEGORIES.map((category) => (
                    <section key={category.name} style={{ marginBottom: "40px" }}>
                        <h2
                            style={{
                                fontSize: "1.4rem",
                                color: "#fff",
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
            <CoachFred />
            </TricksPageWrapper>
        </>
    );
}
