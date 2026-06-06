import { Metadata } from "next";
import { cache } from "react";
import ProfilePage from "@/components/profile/ProfilePage";
import { cleanUsername } from "@/lib/utils/cleanUsername";
import HiveClient from "@/lib/hive/hiveclient";
import { APP_CONFIG } from "@/config/app.config";
import { REVALIDATE } from "@/config/revalidate";
import { validateHiveUsernameFormat, cleanHiveUsername } from "@/lib/utils/hiveAccountUtils";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";

// Constants
const DOMAIN_URL = APP_CONFIG.BASE_URL;
// Absolute origin for server-side self-fetches (the userbase profile API).
// Fixed (not header-derived) so this route can be statically cached.
const SELF_ORIGIN = APP_CONFIG.ORIGIN || APP_CONFIG.BASE_URL;
const FALLBACK_AVATAR = "https://images.ecency.com/webp/u/default/avatar/small";
const FALLBACK_BANNER = `${APP_CONFIG.BASE_URL}/ogimage.png`;

// ISR: a profile's header data changes slowly and the live feed/wallet
// hydrate client-side, so an hour-stale shell is invisible. Previously
// this route was forced fully dynamic by `headers()` + `cache: "no-store"`,
// hitting a serverless function on every request (~1.2K/day).
// `generateStaticParams` returning [] opts the dynamic segment into ISR.
//
// Must be a literal — Next statically parses this segment config and rejects
// imported constants. LISTING tier = 1 hour; see config/revalidate.ts.
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

type Props = {
  params: Promise<{ username: string }>;
};

// Cached + request-deduplicated: generateMetadata and the page body share
// one set of Hive RPCs / profile fetches per request instead of two.
const getUserData = cache(async (username: string) => {
  try {
    const normalized = cleanHiveUsername(username);
    const isHiveValid = validateHiveUsernameFormat(normalized).isValid;

    const fetchUserbaseProfile = async () => {
      const userbaseResponse = await fetch(
        new URL(`/api/userbase/profile?handle=${encodeURIComponent(normalized)}`, SELF_ORIGIN).toString(),
        { next: { revalidate: REVALIDATE.LISTING } }
      ).catch(() => null);
      if (userbaseResponse?.ok) {
        const userbaseData = await userbaseResponse.json().catch(() => null);
        if (userbaseData?.user) {
          const user = userbaseData.user;
          return {
            username,
            name: user.handle || user.display_name || username,
            about: user.bio || "",
            profileImage: user.avatar_url || FALLBACK_AVATAR,
            coverImage: user.cover_url || FALLBACK_BANNER,
            website: "",
            location: "",
            followers: 0,
            following: 0,
          };
        }
      }
      return null;
    };

    if (!isHiveValid) {
      return await fetchUserbaseProfile();
    }

    const hiveAccount = await HiveClient.database.call("get_accounts", [
      [normalized],
    ]);
    if (!hiveAccount || hiveAccount.length === 0) {
      return await fetchUserbaseProfile();
    }

    let profileInfo: any = null;
    try {
      profileInfo = await HiveClient.call("bridge", "get_profile", {
        account: normalized,
      });
    } catch (profileError) {
      console.warn("Failed to fetch Hive profile info:", profileError);
      profileInfo = null;
    }

    const account = hiveAccount[0];
    let profileImage = `https://images.ecency.com/webp/u/${normalized}/avatar/small`;
    let coverImage = FALLBACK_BANNER;
    let about = "";
    let name = normalized;
    let website = "";
    let location = "";

    // Parse posting_json_metadata for profile info
    if (account?.posting_json_metadata) {
      try {
        const parsedMetadata = JSON.parse(account.posting_json_metadata);
        const profile = parsedMetadata?.profile || {};
        profileImage = profile.profile_image || profileImage;
        coverImage = profile.cover_image || coverImage;
        about = profile.about || "";
        name = profile.name || username;
        website = profile.website || "";
        location = profile.location || "";
      } catch (err) {
        console.warn("Failed to parse posting_json_metadata", err);
      }
    }

    return {
      username: normalized,
      name,
      about,
      profileImage,
      coverImage,
      website,
      location,
      followers: profileInfo?.stats?.followers || 0,
      following: profileInfo?.stats?.following || 0,
    };
  } catch (error) {
    console.error("Failed to fetch user data:", error);
    // Fallback to userbase profile if Hive RPC fails
    try {
      return await fetch(
        new URL(`/api/userbase/profile?handle=${encodeURIComponent(username)}`, SELF_ORIGIN).toString(),
        { next: { revalidate: REVALIDATE.LISTING } }
      )
        .then(async (resp) => {
          if (!resp.ok) return null;
          const userbaseData = await resp.json().catch(() => null);
          if (userbaseData?.user) {
            const user = userbaseData.user;
            return {
              username,
              name: user.handle || user.display_name || username,
              about: user.bio || "",
              profileImage: user.avatar_url || FALLBACK_AVATAR,
              coverImage: user.cover_url || FALLBACK_BANNER,
              website: "",
              location: "",
              followers: 0,
              following: 0,
            };
          }
          return null;
        })
        .catch(() => null);
    } catch {
      return null;
    }
  }
});

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const username = cleanUsername(params.username);

  try {
    const userData = await getUserData(username);
    if (!userData) {
      return {
        title: `${username} | Skatehive Profile`,
        description: `View ${username}'s profile on Skatehive.`,
        robots: {
          index: false,
          follow: false,
          googleBot: {
            index: false,
            follow: false,
          },
        },
      };
    }
    const profileUrl = `${DOMAIN_URL}/user/${username}`;

    // Create description from about text or fallback
    const description = userData.about
      ? `${userData.about.slice(0, 155).replace(/\s+\S*$/, '')}...`
      : `${userData.name || username} is a skater on Skatehive with ${
          userData.followers
        } followers. Check out their skate videos, snaps, and posts.`;

    // Generate dynamic OpenGraph image using our gamified API.
    // Always point at the canonical domain so the route stays statically
    // cacheable (a header-derived host would force dynamic SSR).
    const ogImage = `${DOMAIN_URL}/api/og/profile/${username}`;
    const frameImage = `${DOMAIN_URL}/api/og/profile/${username}?format=frame`;

    return {
      title: `${userData.name || username} | Skatehive Profile`,
      description: description,
      authors: [{ name: username }],
      applicationName: "Skatehive",
      alternates: {
        canonical: profileUrl,
      },
      openGraph: {
        title: `${userData.name || username} (@${username})`,
        description: description,
        url: profileUrl,
        images: [
          {
            url: ogImage,
            width: 1200,
            height: 630,
          },
        ],
        siteName: "Skatehive",
        type: "profile",
      },
      twitter: {
        card: "summary_large_image",
        title: `${userData.name || username} (@${username})`,
        description: description,
        images: ogImage,
      },
      other: {
        "fc:frame": JSON.stringify({
          version: "next",
          imageUrl: frameImage,
          button: {
            title: "View Profile",
            action: {
              type: "launch_frame",
              name: "Skatehive",
              url: profileUrl,
            },
          },
          postUrl: profileUrl,
        }),
        "fc:frame:image": frameImage,
        "fc:frame:post_url": profileUrl,
      },
    };
  } catch (error) {
    console.error("Error generating profile metadata:", error);
    return {
      title: `${username} | Skatehive Profile`,
      description: `View ${username}'s profile on Skatehive.`,
      robots: {
        index: false,
        follow: false,
        googleBot: {
          index: false,
          follow: false,
        },
      },
    };
  }
}

export default async function UserProfilePage(props: Props) {
  const params = await props.params;
  const username = cleanUsername(params.username);

  // Build Person JSON-LD + SSR content for SEO
  let personJsonLd: Record<string, unknown> | null = null;
  let ssrName = "";
  let ssrAbout = "";
  let ssrFollowers = 0;
  let ssrFollowing = 0;
  try {
    const userData = await getUserData(username);
    if (userData) {
      const profileUrl = `${DOMAIN_URL}/user/${username}`;
      ssrName = userData.name || username;
      ssrAbout = userData.about || "";
      ssrFollowers = userData.followers || 0;
      ssrFollowing = userData.following || 0;

      const sameAs = [`https://hive.blog/@${username}`];
      if (userData.website) sameAs.push(userData.website);

      personJsonLd = {
        "@context": "https://schema.org",
        "@type": "Person",
        name: userData.name || username,
        url: profileUrl,
        image: userData.profileImage,
        description: userData.about || undefined,
        sameAs,
        ...(userData.location ? { homeLocation: { "@type": "Place", name: userData.location } } : {}),
        mainEntityOfPage: {
          "@type": "ProfilePage",
          "@id": profileUrl,
        },
      };
    }
  } catch {
    // Silently fail - page renders without JSON-LD
  }

  return (
    <>
      {personJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(personJsonLd) }}
        />
      )}
      {/* SSR content block — visible to Google in initial HTML */}
      {ssrName && (
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
          <h1>{ssrName} — Skatehive Profile</h1>
          <p>@{username} on Skatehive — the decentralized skateboarding community</p>
          {ssrAbout && <p>{ssrAbout}</p>}
          <p>{ssrFollowers} followers · {ssrFollowing} following</p>
          <p>View skate videos, snaps, and posts by {ssrName} on Skatehive — the decentralized skateboarding community.</p>
        </div>
      )}
      <ProfilePage username={username} />
    </>
  );
}
