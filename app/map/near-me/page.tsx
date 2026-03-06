import { Metadata } from "next";
import dynamic from "next/dynamic";
import { APP_CONFIG } from "@/config/app.config";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";

const BASE_URL = APP_CONFIG.BASE_URL;

export const metadata: Metadata = {
    title: "Skate Spots Near Me — Find Skateparks & Street Spots Nearby",
    description:
        "Find skateparks, street spots, and DIY spots near your location. Browse the community-built skate spot map with spots submitted by skaters worldwide. Free, no app required.",
    keywords: [
        "skate spots near me",
        "skateparks near me",
        "skateboard spots near me",
        "skate park near me",
        "street spots near me",
        "find skate spots",
        "skate spot finder",
        "skatepark finder",
        "skate spots nearby",
        "local skate spots",
        "skate spot locator",
        "skateboard park locator",
        "DIY skate spots",
        "best skate spots",
    ],
    openGraph: {
        title: "Skate Spots Near Me — Find Skateparks & Street Spots",
        description:
            "Find skateparks and street spots near your location. Community-built map by skaters worldwide.",
        url: `${BASE_URL}/map/near-me`,
        siteName: "Skatehive",
        type: "website",
        images: [
            {
                url: `${BASE_URL}/ogimage.png`,
                width: 1200,
                height: 630,
                alt: "Find skate spots near you on Skatehive",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Skate Spots Near Me — Find Skateparks Nearby",
        description:
            "Community-built skate spot map. Find parks, street spots, and DIY spots near you.",
        images: [`${BASE_URL}/ogimage.png`],
    },
    alternates: {
        canonical: `${BASE_URL}/map/near-me`,
    },
};

const EmbeddedMap = dynamic(
    () => import("@/components/spotmap/EmbeddedMap"),
    { ssr: true }
);

export default function NearMePage() {
    // This page uses geolocation to center the map on the user
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "Skate Spots Near Me",
        description:
            "Find skateparks, street spots, and DIY spots near your location on the Skatehive community map.",
        url: `${BASE_URL}/map/near-me`,
        isPartOf: {
            "@type": "WebSite",
            name: "Skatehive",
            url: BASE_URL,
        },
        mainEntity: {
            "@type": "Map",
            name: "Skatehive Skate Spot Map",
            description:
                "Community-built map of skateparks, street spots, and DIY spots worldwide.",
            url: `${BASE_URL}/map`,
            mapType: "https://schema.org/VenueMap",
        },
        breadcrumb: {
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
                    name: "Skate Map",
                    item: `${BASE_URL}/map`,
                },
                {
                    "@type": "ListItem",
                    position: 3,
                    name: "Near Me",
                    item: `${BASE_URL}/map/near-me`,
                },
            ],
        },
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: safeJsonLdStringify(jsonLd),
                }}
            />
            <article
                style={{
                    maxWidth: "1200px",
                    margin: "0 auto",
                    padding: "0 16px",
                }}
            >
                {/* SEO content block — visible to users AND bots */}
                <header style={{ padding: "24px 0 8px", textAlign: "center" }}>
                    <h1
                        style={{
                            fontSize: "2rem",
                            fontWeight: "bold",
                            color: "#a7ff00",
                            marginBottom: "12px",
                        }}
                    >
                        Find Skate Spots Near You
                    </h1>
                    <p
                        style={{
                            fontSize: "1.1rem",
                            color: "#ccc",
                            maxWidth: "700px",
                            margin: "0 auto 16px",
                            lineHeight: 1.6,
                        }}
                    >
                        Discover skateparks, street spots, and DIY spots near your location.
                        Our community-built map is maintained by skaters from around the world
                        — find your next session spot or add your own local gems.
                    </p>
                </header>

                {/* The actual map — uses geolocation to center near user */}
                <EmbeddedMap useGeolocation={true} fullHeight={true} />

                {/* Additional SEO content below the map */}
                <section
                    style={{
                        padding: "32px 0",
                        maxWidth: "800px",
                        margin: "0 auto",
                        color: "#aaa",
                        lineHeight: 1.8,
                    }}
                >
                    <h2
                        style={{
                            fontSize: "1.5rem",
                            color: "#fff",
                            marginBottom: "16px",
                        }}
                    >
                        How to Find Skate Spots
                    </h2>
                    <p style={{ marginBottom: "16px" }}>
                        The Skatehive Skate Map is a free, community-driven tool that helps
                        skaters find skateparks, street spots, transitions, ledges, rails,
                        stairs, and DIY spots anywhere in the world. Every spot on the map has
                        been submitted by a real skater.
                    </p>
                    <p style={{ marginBottom: "16px" }}>
                        Whether you are looking for a skatepark near you for a quick session,
                        searching for the best street spots in a new city, or want to discover
                        hidden gems that only locals know about — our map has you covered.
                    </p>

                    <h2
                        style={{
                            fontSize: "1.5rem",
                            color: "#fff",
                            marginBottom: "16px",
                            marginTop: "24px",
                        }}
                    >
                        Add Your Local Spots
                    </h2>
                    <p style={{ marginBottom: "16px" }}>
                        Know a spot that is not on the map? Help the skateboarding community by
                        adding it! Every contribution makes the map better for all skaters.
                        Share the location, add photos, and describe the features — ledges,
                        rails, flat ground, transitions, or anything else.
                    </p>

                    <h2
                        style={{
                            fontSize: "1.5rem",
                            color: "#fff",
                            marginBottom: "16px",
                            marginTop: "24px",
                        }}
                    >
                        Popular Skate Spot Types
                    </h2>
                    <ul
                        style={{
                            listStyle: "none",
                            padding: 0,
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                            gap: "8px",
                        }}
                    >
                        {[
                            "Skateparks",
                            "Street Spots",
                            "DIY Spots",
                            "Transition / Bowl",
                            "Ledges & Manny Pads",
                            "Rails & Hubbas",
                            "Stairs & Gaps",
                            "Flat Ground",
                        ].map((type) => (
                            <li
                                key={type}
                                style={{
                                    padding: "8px 16px",
                                    background: "rgba(167, 255, 0, 0.1)",
                                    borderRadius: "8px",
                                    color: "#a7ff00",
                                    fontSize: "0.9rem",
                                }}
                            >
                                🛹 {type}
                            </li>
                        ))}
                    </ul>
                </section>
            </article>
        </>
    );
}
