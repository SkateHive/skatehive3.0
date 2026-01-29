import { Metadata } from "next";
import { headers } from "next/headers";
import ProfilePage from "@/components/profile/ProfilePage";
import { cleanUsername } from "@/lib/utils/cleanUsername";
import HiveClient from "@/lib/hive/hiveclient";
import { APP_CONFIG } from "@/config/app.config";
import { validateHiveUsernameFormat, cleanHiveUsername } from "@/lib/utils/hiveAccountUtils";

// Constants
const DOMAIN_URL = APP_CONFIG.BASE_URL;
const FALLBACK_AVATAR = "https://images.ecency.com/webp/u/default/avatar/small";
const FALLBACK_BANNER = `${APP_CONFIG.BASE_URL}/ogimage.png`;

type Props = {
  params: Promise<{ username: string }>;
};

async function getBaseUrl() {
  const hdrs = await headers();
  const host = hdrs.get("host");
  const protocol = hdrs.get("x-forwarded-proto") || "http";
  if (host) {
    return `${protocol}://${host}`;
  }
  return APP_CONFIG.ORIGIN || APP_CONFIG.BASE_URL;
}

async function getUserData(username: string, baseUrl: string) {
  try {
    const normalized = cleanHiveUsername(username);
    const isHiveValid = validateHiveUsernameFormat(normalized).isValid;

    const fetchUserbaseProfile = async () => {
      const userbaseResponse = await fetch(
        new URL(`/api/userbase/profile?handle=${encodeURIComponent(normalized)}`, baseUrl).toString(),
        { cache: "no-store" }
      ).catch(() => null);
      if (userbaseResponse?.ok) {
        const userbaseData = await userbaseResponse.json().catch(() => null);
        if (userbaseData?.user) {
          const user = userbaseData.user;
          return {
            username,
            name: user.display_name || user.handle || username,
            about: user.bio || "",
            profileImage: user.avatar_url || FALLBACK_AVATAR,
            coverImage: user.cover_url || FALLBACK_BANNER,
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

    // Parse posting_json_metadata for profile info
    if (account?.posting_json_metadata) {
      try {
        const parsedMetadata = JSON.parse(account.posting_json_metadata);
        const profile = parsedMetadata?.profile || {};
        profileImage = profile.profile_image || profileImage;
        coverImage = profile.cover_image || coverImage;
        about = profile.about || "";
        name = profile.name || username;
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
      followers: profileInfo?.stats?.followers || 0,
      following: profileInfo?.stats?.following || 0,
    };
  } catch (error) {
    console.error("Failed to fetch user data:", error);
    // Fallback to userbase profile if Hive RPC fails
    try {
      return await fetch(
        new URL(`/api/userbase/profile?handle=${encodeURIComponent(username)}`, baseUrl).toString(),
        { cache: "no-store" }
      )
        .then(async (resp) => {
          if (!resp.ok) return null;
          const userbaseData = await resp.json().catch(() => null);
          if (userbaseData?.user) {
            const user = userbaseData.user;
            return {
              username,
              name: user.display_name || user.handle || username,
              about: user.bio || "",
              profileImage: user.avatar_url || FALLBACK_AVATAR,
              coverImage: user.cover_url || FALLBACK_BANNER,
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
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const username = cleanUsername(params.username);

  try {
    const baseUrl = await getBaseUrl();
    const userData = await getUserData(username, baseUrl);
    if (!userData) {
      return {
        title: `${username} | Skatehive Profile`,
        description: `View ${username}'s profile on Skatehive.`,
      };
    }
    const profileUrl = `${DOMAIN_URL}/user/${username}`;

    // Create description from about text or fallback
    const description = userData.about
      ? `${userData.about.slice(0, 128)}...`
      : `View ${userData.name || username}'s profile on Skatehive - ${
          userData.followers
        } followers, ${userData.following} following`;

    // Generate dynamic OpenGraph image using our gamified API
    const frameImage = `${DOMAIN_URL}/api/og/profile/${username}`;

    return {
      title: `${userData.name || username} | Skatehive Profile`,
      description: description,
      authors: [{ name: username }],
      applicationName: "Skatehive",
      openGraph: {
        title: `${userData.name || username} (@${username})`,
        description: description,
        url: profileUrl,
        images: [
          {
            url: frameImage,
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
        images: frameImage,
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
    };
  }
}

export default async function UserProfilePage(props: Props) {
  const params = await props.params;
  const username = cleanUsername(params.username);

  return <ProfilePage username={username} />;
}
