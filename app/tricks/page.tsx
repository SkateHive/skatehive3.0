import { Metadata } from "next";
import Link from "next/link";
import { APP_CONFIG } from "@/config/app.config";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";
import HiveClient from "@/lib/hive/hiveclient";

const BASE_URL = APP_CONFIG.BASE_URL;

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
        images: [{ url: `${BASE_URL}/ogimage.png`, width: 1200, height: 630 }],
    },
    twitter: {
        card: "summary_large_image",
        title: "Skateboard Tricks — GIFs & Videos | Skatehive",
        description: "Community-filmed skate trick clips. Kickflips, grinds, slides, and more.",
        images: [`${BASE_URL}/ogimage.png`],
    },
    alternates: {
        canonical: `${BASE_URL}/tricks`,
    },
};

// Trick categories with their tags for Hive lookup
const TRICK_CATEGORIES = [
    {
        name: "Flip Tricks",
        emoji: "🔄",
        tricks: [
            { name: "Kickflip", slug: "kickflip", tags: ["kickflip"] },
            { name: "Heelflip", slug: "heelflip", tags: ["heelflip"] },
            { name: "Varial Kickflip", slug: "varial-kickflip", tags: ["varial", "varialkickflip"] },
            { name: "Tre Flip (360 Flip)", slug: "tre-flip", tags: ["treflip", "360flip"] },
            { name: "Hardflip", slug: "hardflip", tags: ["hardflip"] },
            { name: "Laser Flip", slug: "laser-flip", tags: ["laserflip"] },
        ],
    },
    {
        name: "Flatground",
        emoji: "🛹",
        tricks: [
            { name: "Ollie", slug: "ollie", tags: ["ollie"] },
            { name: "Nollie", slug: "nollie", tags: ["nollie"] },
            { name: "Pop Shove-it", slug: "pop-shove-it", tags: ["shove", "shoveit", "popshove"] },
            { name: "Manual", slug: "manual", tags: ["manual"] },
            { name: "No Comply", slug: "no-comply", tags: ["nocomply"] },
            { name: "Boneless", slug: "boneless", tags: ["boneless"] },
        ],
    },
    {
        name: "Grinds & Slides",
        emoji: "⚡",
        tricks: [
            { name: "50-50 Grind", slug: "50-50", tags: ["5050", "grind"] },
            { name: "Boardslide", slug: "boardslide", tags: ["boardslide"] },
            { name: "Nosegrind", slug: "nosegrind", tags: ["nosegrind"] },
            { name: "Smith Grind", slug: "smith-grind", tags: ["smithgrind"] },
            { name: "Feeble Grind", slug: "feeble", tags: ["feeble", "feeblegrind"] },
            { name: "Crooked Grind", slug: "crooked-grind", tags: ["crooks", "crookedgrind"] },
            { name: "Blunt Stall", slug: "blunt-stall", tags: ["bluntstall", "blunt"] },
            { name: "Wallride", slug: "wallride", tags: ["wallride"] },
        ],
    },
    {
        name: "Transition",
        emoji: "🌊",
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
};

async function fetchPostsForTrick(tags: string[]): Promise<number> {
    try {
        const results = await Promise.allSettled(
            tags.map((tag) =>
                HiveClient.call("bridge", "get_ranked_posts", {
                    sort: "created",
                    tag,
                    limit: 1,
                    observer: "",
                })
            )
        );
        let count = 0;
        for (const r of results) {
            if (r.status === "fulfilled" && r.value?.length) count += r.value.length;
        }
        return count;
    } catch {
        return 0;
    }
}

export default async function TricksPage() {
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
                        Browse trick clips filmed by real skaters from the Skatehive
                        community. Click any trick to see GIFs, videos, and posts.
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
                            {category.emoji} {category.name}
                        </h2>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns:
                                    "repeat(auto-fill, minmax(180px, 1fr))",
                                gap: "12px",
                            }}
                        >
                            {category.tricks.map((trick) => (
                                <Link
                                    key={trick.slug}
                                    href={`/tricks/${trick.slug}`}
                                    style={{
                                        display: "block",
                                        padding: "16px",
                                        background: "rgba(167, 255, 0, 0.05)",
                                        border: "1px solid rgba(167, 255, 0, 0.2)",
                                        borderRadius: "12px",
                                        textDecoration: "none",
                                        transition: "all 0.2s",
                                    }}
                                >
                                    <span
                                        style={{
                                            display: "block",
                                            fontSize: "1.1rem",
                                            color: "#a7ff00",
                                            fontWeight: "600",
                                            marginBottom: "4px",
                                        }}
                                    >
                                        {trick.name}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: "0.8rem",
                                            color: "#888",
                                        }}
                                    >
                                        View clips →
                                    </span>
                                </Link>
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
        </>
    );
}
