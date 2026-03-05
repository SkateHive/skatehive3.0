import { Metadata } from "next";
import Link from "next/link";
import { APP_CONFIG } from "@/config/app.config";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";
import HiveClient from "@/lib/hive/hiveclient";

const BASE_URL = APP_CONFIG.BASE_URL;

// Map of trick slugs to display names and search tags
const TRICK_MAP: Record<string, { name: string; tags: string[]; description: string }> = {
    kickflip: {
        name: "Kickflip",
        tags: ["kickflip"],
        description: "A kickflip is a skateboarding trick where the rider flips the board 360 degrees along the axis that extends from the nose to the tail. It was invented by Rodney Mullen in 1983.",
    },
    heelflip: {
        name: "Heelflip",
        tags: ["heelflip"],
        description: "The heelflip is the opposite of a kickflip — the board flips toward the rider using the heel. Invented by Rodney Mullen, it is a fundamental flip trick.",
    },
    ollie: {
        name: "Ollie",
        tags: ["ollie"],
        description: "The ollie is the foundation of almost all skateboard tricks. It allows the skater to jump with the board without using their hands, invented by Alan Gelfand in 1978.",
    },
    "pop-shove-it": {
        name: "Pop Shove-it",
        tags: ["shove", "shoveit", "popshove", "pop-shove-it"],
        description: "The pop shove-it involves popping the tail while scooping the board 180 degrees under the feet. A fundamental trick that opens the door to more complex combinations.",
    },
    "varial-kickflip": {
        name: "Varial Kickflip",
        tags: ["varial", "varialkickflip", "varial-kickflip"],
        description: "A varial kickflip combines a pop shove-it with a kickflip, making the board both spin and flip simultaneously.",
    },
    "tre-flip": {
        name: "Tre Flip (360 Flip)",
        tags: ["treflip", "360flip", "tre-flip"],
        description: "The tre flip (or 360 flip) combines a 360 pop shove-it with a kickflip. One of the most stylish and sought-after tricks in skateboarding.",
    },
    hardflip: {
        name: "Hardflip",
        tags: ["hardflip"],
        description: "A hardflip is a combination of a frontside pop shove-it and a kickflip. The board flips between the legs, making it one of the most visually striking flip tricks.",
    },
    "laser-flip": {
        name: "Laser Flip",
        tags: ["laserflip", "laser-flip"],
        description: "The laser flip combines a 360 frontside shove-it with a heelflip. One of the hardest flip tricks in skateboarding.",
    },
    nollie: {
        name: "Nollie",
        tags: ["nollie"],
        description: "A nollie is an ollie performed by popping the nose of the board instead of the tail. It is the mirror image of a regular ollie.",
    },
    manual: {
        name: "Manual",
        tags: ["manual", "manny"],
        description: "A manual is riding on only two wheels (the back trucks) without letting the tail touch the ground. It is the skateboard equivalent of a wheelie.",
    },
    "no-comply": {
        name: "No Comply",
        tags: ["nocomply", "no-comply"],
        description: "The no comply is an old-school trick where the front foot steps off the board while the back foot pops it into the air.",
    },
    boneless: {
        name: "Boneless",
        tags: ["boneless"],
        description: "The boneless is a grab trick where the skater grabs the board with their hand while planting their front foot on the ground to jump.",
    },
    "50-50": {
        name: "50-50 Grind",
        tags: ["5050", "grind", "50-50"],
        description: "The 50-50 grind is the most basic grind, where both trucks grind along a rail, ledge, or coping.",
    },
    boardslide: {
        name: "Boardslide",
        tags: ["boardslide"],
        description: "A boardslide involves sliding the middle of the board along a rail or ledge. One of the first grind/slide tricks most skaters learn.",
    },
    nosegrind: {
        name: "Nosegrind",
        tags: ["nosegrind"],
        description: "A nosegrind is grinding on only the front truck. It requires precise balance and is considered a more advanced grind.",
    },
    "smith-grind": {
        name: "Smith Grind",
        tags: ["smithgrind", "smith"],
        description: "The smith grind is performed by grinding on the back truck while the front truck hangs below the edge of the obstacle.",
    },
    feeble: {
        name: "Feeble Grind",
        tags: ["feeble", "feeblegrind"],
        description: "A feeble grind is the opposite of a smith grind — the back truck grinds while the front truck goes over the obstacle.",
    },
    "crooked-grind": {
        name: "Crooked Grind",
        tags: ["crooks", "crookedgrind", "crooked"],
        description: "The crooked grind (or crooks) is a nosegrind at an angle, with the nose of the board pressing into the ledge.",
    },
    "blunt-stall": {
        name: "Blunt Stall",
        tags: ["bluntstall", "blunt"],
        description: "A blunt stall involves riding up a ramp, locking the back trucks on the coping with the board vertical, and coming back in.",
    },
    wallride: {
        name: "Wallride",
        tags: ["wallride"],
        description: "A wallride is riding up and along a wall on the skateboard. It requires speed, commitment, and style.",
    },
    "drop-in": {
        name: "Drop In",
        tags: ["dropin", "drop-in"],
        description: "Dropping in is one of the first transition tricks to learn. The skater places the tail on the coping and leans forward to ride down the ramp.",
    },
    "rock-to-fakie": {
        name: "Rock to Fakie",
        tags: ["rocktofakie", "rock"],
        description: "A rock to fakie involves riding up a ramp, rocking the front trucks over the coping, and coming back fakie (backwards).",
    },
    "axle-stall": {
        name: "Axle Stall",
        tags: ["axlestall"],
        description: "An axle stall is a 50-50 stall on the coping of a ramp, where the skater locks both trucks on the edge before dropping back in.",
    },
    "frontside-air": {
        name: "Frontside Air",
        tags: ["frontsideair"],
        description: "A frontside air is a grab trick performed on a ramp where the skater airs above the coping while turning frontside.",
    },
    "backside-air": {
        name: "Backside Air",
        tags: ["backsideair"],
        description: "A backside air is an aerial trick on a ramp where the skater turns backside while grabbing the board.",
    },
};

type HivePost = {
    author?: string;
    permlink?: string;
    title?: string;
    created?: string;
    body?: string;
    net_votes?: number;
    children?: number;
};

interface Props {
    params: Promise<{ trick: string }>;
}

async function fetchTrickPosts(tags: string[]): Promise<HivePost[]> {
    const allPosts: HivePost[] = [];
    const seen = new Set<string>();

    const results = await Promise.allSettled(
        tags.map((tag) =>
            HiveClient.call("bridge", "get_ranked_posts", {
                sort: "created",
                tag,
                limit: 20,
                observer: "",
            })
        )
    );

    for (const result of results) {
        if (result.status === "fulfilled" && Array.isArray(result.value)) {
            for (const post of result.value) {
                if (!post?.author || !post?.permlink) continue;
                const key = `${post.author}/${post.permlink}`;
                if (seen.has(key)) continue;
                seen.add(key);
                allPosts.push(post);
            }
        }
    }

    return allPosts;
}

function extractFirstImage(body: string): string | null {
    const match = body?.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
    return match ? match[1] : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { trick: trickSlug } = await params;
    const trickData = TRICK_MAP[trickSlug];

    if (!trickData) {
        return {
            title: `${trickSlug.replace(/-/g, " ")} — Skate Trick Clips | Skatehive`,
            description: `Watch ${trickSlug.replace(/-/g, " ")} clips from real skaters on Skatehive.`,
        };
    }

    return {
        title: `${trickData.name} — GIFs, Videos & Clips from Real Skaters`,
        description: `${trickData.description.slice(0, 155).replace(/\s+\S*$/, '')}...`,
        keywords: [
            ...trickData.tags,
            `${trickData.name.toLowerCase()} gif`,
            `${trickData.name.toLowerCase()} video`,
            `how to ${trickData.name.toLowerCase()}`,
            `${trickData.name.toLowerCase()} skateboard`,
            "skateboard tricks",
            "skatehive",
        ],
        openGraph: {
            title: `${trickData.name} — Skate Trick Clips | Skatehive`,
            description: `Watch ${trickData.name} clips from real skaters worldwide.`,
            url: `${BASE_URL}/tricks/${trickSlug}`,
            siteName: "Skatehive",
            type: "article",
        },
        twitter: {
            card: "summary_large_image",
            title: `${trickData.name} — Skate Trick Clips | Skatehive`,
            description: `Watch ${trickData.name} clips from real skaters.`,
        },
        alternates: {
            canonical: `${BASE_URL}/tricks/${trickSlug}`,
        },
    };
}

export default async function TrickPage({ params }: Props) {
    const { trick: trickSlug } = await params;
    const trickData = TRICK_MAP[trickSlug];
    const displayName = trickData?.name || trickSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const description = trickData?.description || `Browse ${displayName} clips from the skateboarding community.`;
    const tags = trickData?.tags || [trickSlug.replace(/-/g, "")];

    // Fetch real posts from Hive
    const posts = await fetchTrickPosts(tags);

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${displayName} — Skateboard Trick`,
        description,
        url: `${BASE_URL}/tricks/${trickSlug}`,
        isPartOf: { "@type": "WebSite", name: "Skatehive", url: BASE_URL },
        breadcrumb: {
            "@type": "BreadcrumbList",
            itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
                { "@type": "ListItem", position: 2, name: "Tricks", item: `${BASE_URL}/tricks` },
                { "@type": "ListItem", position: 3, name: displayName, item: `${BASE_URL}/tricks/${trickSlug}` },
            ],
        },
        mainEntity: {
            "@type": "ItemList",
            numberOfItems: posts.length,
            itemListElement: posts.slice(0, 10).map((post, i) => ({
                "@type": "ListItem",
                position: i + 1,
                url: `${BASE_URL}/post/${post.author}/${post.permlink}`,
                name: post.title || `${displayName} clip by @${post.author}`,
            })),
        },
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
            />
            <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "24px 16px", minHeight: "100vh" }}>
                {/* Breadcrumb */}
                <nav style={{ marginBottom: "16px", fontSize: "0.85rem", color: "#888" }}>
                    <Link href="/" style={{ color: "#a7ff00" }}>Home</Link>
                    {" / "}
                    <Link href="/tricks" style={{ color: "#a7ff00" }}>Tricks</Link>
                    {" / "}
                    <span style={{ color: "#fff" }}>{displayName}</span>
                </nav>

                <header style={{ marginBottom: "24px" }}>
                    <h1 style={{ fontSize: "2rem", fontWeight: "bold", color: "#a7ff00", marginBottom: "12px" }}>
                        {displayName}
                    </h1>
                    <p style={{ fontSize: "1rem", color: "#ccc", lineHeight: 1.7, maxWidth: "700px" }}>
                        {description}
                    </p>
                </header>

                {/* Posts grid */}
                {posts.length > 0 ? (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                            gap: "16px",
                            marginBottom: "32px",
                        }}
                    >
                        {posts.map((post) => {
                            const image = extractFirstImage(post.body || "");
                            return (
                                <Link
                                    key={`${post.author}/${post.permlink}`}
                                    href={`/post/${post.author}/${post.permlink}`}
                                    style={{
                                        display: "block",
                                        background: "rgba(255,255,255,0.03)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: "12px",
                                        overflow: "hidden",
                                        textDecoration: "none",
                                        transition: "border-color 0.2s",
                                    }}
                                >
                                    {image && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={image}
                                            alt={`${displayName} by @${post.author}`}
                                            style={{
                                                width: "100%",
                                                height: "200px",
                                                objectFit: "cover",
                                            }}
                                            loading="lazy"
                                        />
                                    )}
                                    <div style={{ padding: "12px" }}>
                                        <h3
                                            style={{
                                                fontSize: "0.95rem",
                                                color: "#fff",
                                                marginBottom: "6px",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {post.title || `${displayName} clip`}
                                        </h3>
                                        <p style={{ fontSize: "0.8rem", color: "#888" }}>
                                            by @{post.author} • {post.net_votes || 0} votes
                                            {post.children ? ` • ${post.children} comments` : ""}
                                        </p>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                ) : (
                    <div
                        style={{
                            padding: "48px",
                            textAlign: "center",
                            color: "#888",
                            border: "1px dashed #333",
                            borderRadius: "12px",
                            marginBottom: "32px",
                        }}
                    >
                        <p style={{ fontSize: "1.1rem", marginBottom: "12px" }}>
                            No {displayName} clips yet!
                        </p>
                        <p>
                            Be the first to post a {displayName} clip on{" "}
                            <Link href="/compose" style={{ color: "#a7ff00" }}>
                                Skatehive
                            </Link>
                            .
                        </p>
                    </div>
                )}

                {/* SEO footer content */}
                <footer style={{ borderTop: "1px solid #333", paddingTop: "24px", color: "#aaa", lineHeight: 1.7 }}>
                    <h2 style={{ fontSize: "1.2rem", color: "#fff", marginBottom: "12px" }}>
                        About the {displayName}
                    </h2>
                    <p style={{ marginBottom: "12px" }}>{description}</p>
                    <p>
                        Want to see your {displayName.toLowerCase()} clip here? Post it on Skatehive
                        with the tag <code style={{ color: "#a7ff00" }}>#{tags[0]}</code> and
                        it will appear automatically.
                    </p>
                </footer>
            </div>
        </>
    );
}
