import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { cleanUsername } from "@/lib/utils/cleanUsername";
import { cleanHiveUsername, validateHiveUsernameFormat } from "@/lib/utils/hiveAccountUtils";
import { Image } from "@chakra-ui/react";

export const runtime = "edge";

// Constants
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const CARD_WIDTH = 400;
const AVATAR_SIZE = 140;
const COLORS = {
  primary: "#4CAF50",
  secondary: "#2196F3",
  accent: "#FF9800",
  background: "#0a0a0a",
  cardBg: "rgba(20, 20, 20, 0.9)",
  text: "#ffffff",
  textSecondary: "#cccccc",
} as const;

interface UserData {
  username: string;
  name: string;
  about: string;
  profileImage: string;
  coverImage: string | null;
  followers: number;
  following: number;
  posts: number;
}

async function getUserData(username: string): Promise<UserData> {
  try {
    const normalized = cleanHiveUsername(username);
    const isHiveValid = validateHiveUsernameFormat(normalized).isValid;

    if (!isHiveValid) {
      return {
        username,
        name: username,
        about: "",
        profileImage: `https://images.hive.blog/u/${username}/avatar/small`,
        coverImage: null,
        followers: 0,
        following: 0,
        posts: 0,
      };
    }

    const accountResponse = await fetch("https://api.hive.blog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "condenser_api.get_accounts",
        params: [[normalized]],
        id: 2,
      }),
    });

    if (!accountResponse.ok) {
      throw new Error("Failed to fetch user data from Hive API");
    }

    const accountData = await accountResponse.json();
    const account = accountData.result?.[0];

    if (!account) {
      throw new Error("User not found");
    }

    const profileResponse = await fetch("https://api.hive.blog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "bridge.get_profile",
        params: { account: normalized },
        id: 1,
      }),
    });

    const profileData = profileResponse.ok ? await profileResponse.json() : null;
    const profileInfo = profileData?.result;

    let profileImage = `https://images.hive.blog/u/${normalized}/avatar/small`;
    let coverImage = null;
    let about = "";
    let name = normalized;

    // Parse posting_json_metadata for profile info
    if (account.posting_json_metadata) {
      try {
        const parsedMetadata = JSON.parse(account.posting_json_metadata);
        const profile = parsedMetadata?.profile || {};
        profileImage = profile.profile_image || profileImage;
        coverImage = profile.cover_image;
        about = profile.about || "";
        name = profile.name || username;
      } catch (err) {
        console.warn("Failed to parse posting_json_metadata:", err);
      }
    }

    return {
      username: normalized,
      name,
      about: about.slice(0, 120),
      profileImage,
      coverImage,
      followers: profileInfo?.stats?.followers || 0,
      following: profileInfo?.stats?.following || 0,
      posts: profileInfo?.stats?.post_count || 0,
    };
  } catch (error) {
    console.error("Failed to fetch user data:", error);
    // Return fallback data
    return {
      username,
      name: username,
      about: "",
      profileImage: `https://images.hive.blog/u/${username}/avatar/small`,
      coverImage: null,
      followers: 0,
      following: 0,
      posts: 0,
    };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username: rawUsername } = await params;
    const username = cleanUsername(rawUsername);

    if (!username) {
      throw new Error("Invalid username");
    }

    const userData = await getUserData(username);

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            position: "relative",
            backgroundColor: COLORS.background,
          }}
        >
          {/* Background Layer */}
          {userData.coverImage ? (
            <Image
              alt=" Cover Image"
              src={userData.coverImage}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "brightness(0.3) blur(1px)",
              }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                opacity: 0.8,
              }}
            />
          )}

          {/* Dark Overlay */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.8) 100%)",
              display: "flex",
            }}
          />

          {/* Content Container */}
          <div
            style={{
              position: "relative",
              zIndex: 10,
              width: "100%",
              height: "100%",
              display: "flex",
              padding: "40px",
            }}
          >
            {/* Profile Card */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: `${CARD_WIDTH}px`,
                height: "100%",
                backgroundColor: COLORS.cardBg,
                borderRadius: "20px",
                border: `2px solid ${COLORS.primary}40`,
                boxShadow: "0 10px 40px rgba(0, 0, 0, 0.5)",
                padding: "30px",
                gap: "20px",
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  position: "relative",
                  display: "flex",
                }}
              >
                <div
                  style={{
                    width: `${AVATAR_SIZE}px`,
                    height: `${AVATAR_SIZE}px`,
                    borderRadius: `${AVATAR_SIZE / 2}px`,
                    background: `linear-gradient(45deg, ${COLORS.primary}, ${COLORS.secondary}, ${COLORS.accent})`,
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Image
                    alt="Avatar"
                    src={userData.profileImage}
                    style={{
                      width: `${AVATAR_SIZE - 10}px`,
                      height: `${AVATAR_SIZE - 10}px`,
                      borderRadius: `${(AVATAR_SIZE - 10) / 2}px`,
                      border: "3px solid #000",
                    }}
                  />
                </div>
              </div>

              {/* User Info */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "32px",
                    fontWeight: "bold",
                    color: COLORS.text,
                    textShadow: "2px 2px 4px rgba(0, 0, 0, 0.8)",
                    display: "flex",
                  }}
                >
                  {userData.name}
                </div>

                <div
                  style={{
                    fontSize: "20px",
                    color: COLORS.primary,
                    fontWeight: "600",
                    display: "flex",
                  }}
                >
                  @{username}
                </div>

                {userData.about && (
                  <div
                    style={{
                      fontSize: "14px",
                      color: COLORS.textSecondary,
                      lineHeight: "1.4",
                      textAlign: "center",
                      maxWidth: "300px",
                      display: "flex",
                    }}
                  >
                    {userData.about}
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel - Stats Dashboard */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                marginLeft: "40px",
                gap: "30px",
              }}
            >
              {/* Stats Cards */}
              <div
                style={{
                  display: "flex",
                  gap: "20px",
                  justifyContent: "center",
                }}
              >
                {/* Followers Card */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    backgroundColor: "rgba(76, 175, 80, 0.2)",
                    border: "2px solid rgba(76, 175, 80, 0.4)",
                    borderRadius: "15px",
                    padding: "20px 30px",
                    minWidth: "140px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "36px",
                      fontWeight: "bold",
                      color: "#4CAF50",
                      textShadow: "0 0 10px rgba(76, 175, 80, 0.5)",
                      display: "flex",
                    }}
                  >
                    {userData.followers.toLocaleString()}
                  </div>
                  <div
                    style={{
                      fontSize: "16px",
                      color: "white",
                      fontWeight: "600",
                      display: "flex",
                    }}
                  >
                    FOLLOWERS
                  </div>
                </div>

                {/* Following Card */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    backgroundColor: "rgba(33, 150, 243, 0.2)",
                    border: "2px solid rgba(33, 150, 243, 0.4)",
                    borderRadius: "15px",
                    padding: "20px 30px",
                    minWidth: "140px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "36px",
                      fontWeight: "bold",
                      color: "#2196F3",
                      textShadow: "0 0 10px rgba(33, 150, 243, 0.5)",
                      display: "flex",
                    }}
                  >
                    {userData.following.toLocaleString()}
                  </div>
                  <div
                    style={{
                      fontSize: "16px",
                      color: "white",
                      fontWeight: "600",
                      display: "flex",
                    }}
                  >
                    FOLLOWING
                  </div>
                </div>

                {/* Posts Card */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    backgroundColor: "rgba(255, 152, 0, 0.2)",
                    border: "2px solid rgba(255, 152, 0, 0.4)",
                    borderRadius: "15px",
                    padding: "20px 30px",
                    minWidth: "140px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "36px",
                      fontWeight: "bold",
                      color: "#FF9800",
                      textShadow: "0 0 10px rgba(255, 152, 0, 0.5)",
                      display: "flex",
                    }}
                  >
                    {userData.posts.toLocaleString()}
                  </div>
                  <div
                    style={{
                      fontSize: "16px",
                      color: "white",
                      fontWeight: "600",
                      display: "flex",
                    }}
                  >
                    POSTS
                  </div>
                </div>
              </div>

              {/* Platform Branding */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "15px",
                }}
              >
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: "bold",
                    color: "#4CAF50",
                    textShadow: "0 0 15px rgba(76, 175, 80, 0.8)",
                    display: "flex",
                  }}
                >
                  🛹 SKATEHIVE
                </div>
                <div
                  style={{
                    fontSize: "18px",
                    color: "#cccccc",
                    display: "flex",
                  }}
                >
                  skatehive.app
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error("Error generating profile OG image:", error);

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#1a1a1a",
          }}
        >
          <div
            style={{
              fontSize: "48px",
              color: "white",
              display: "flex",
            }}
          >
            🛹 Skatehive Profile
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  }
}
