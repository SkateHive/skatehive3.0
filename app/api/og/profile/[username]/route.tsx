import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

// Terminal colors
const C = {
  bg: "#0a0a0a",
  green: "#a7ff00",
  text: "#e0e0e0",
  dim: "#666",
  border: "#333",
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
    // Inline username cleaning (avoid importing large utils)
    const normalized = username.toLowerCase().trim().replace(/^@/, "");

    // Basic validation (3-16 chars, alphanumeric + dots/dashes)
    if (!normalized || normalized.length < 3 || normalized.length > 16) {
      return {
        username: normalized,
        name: normalized,
        about: "",
        profileImage: `https://images.hive.blog/u/${normalized}/avatar/small`,
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
    const username = rawUsername.toLowerCase().trim().replace(/^@/, "");

    if (!username || username.length < 3 || username.length > 16) {
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
            backgroundColor: C.bg,
            fontFamily: "monospace",
          }}
        >
          {/* Terminal Window */}
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              padding: "20px",
              gap: "20px",
            }}
          >
            {/* Terminal Header */}
            <div
              style={{
                display: "flex",
                borderBottom: `2px solid ${C.border}`,
                paddingBottom: "10px",
                gap: "15px",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ width: "12px", height: "12px", background: "#ff5f56", borderRadius: "6px" }} />
                <div style={{ width: "12px", height: "12px", background: "#ffbd2e", borderRadius: "6px" }} />
                <div style={{ width: "12px", height: "12px", background: "#27c93f", borderRadius: "6px" }} />
              </div>
              <div style={{ color: C.green, fontSize: "20px", display: "flex" }}>
                🛹 SKATEHIVE {'>'} user/{username}
              </div>
            </div>

            {/* Content */}
            <div
              style={{
                display: "flex",
                gap: "40px",
                flex: 1,
              }}
            >
              {/* Left Panel - Avatar & Info */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "15px",
                  width: "350px",
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    display: "flex",
                    border: `3px solid ${C.green}`,
                    padding: "3px",
                  }}
                >
                  <img
                    src={userData.profileImage}
                    alt="Avatar"
                    width="150"
                    height="150"
                    style={{
                      border: `2px solid ${C.bg}`,
                    }}
                  />
                </div>

                {/* User Info */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ color: C.green, fontSize: "14px", display: "flex" }}>
                    {'>'} NAME:
                  </div>
                  <div style={{ color: C.text, fontSize: "24px", fontWeight: "bold", display: "flex" }}>
                    {userData.name}
                  </div>

                  <div style={{ color: C.green, fontSize: "14px", display: "flex", marginTop: "10px" }}>
                    {'>'} USERNAME:
                  </div>
                  <div style={{ color: C.text, fontSize: "18px", display: "flex" }}>
                    @{username}
                  </div>

                  {userData.about && (
                    <>
                      <div style={{ color: C.green, fontSize: "14px", display: "flex", marginTop: "10px" }}>
                        {'>'} BIO:
                      </div>
                      <div style={{ color: C.dim, fontSize: "14px", display: "flex", lineHeight: "1.4" }}>
                        {userData.about}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right Panel - Stats */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "25px",
                  flex: 1,
                  justifyContent: "center",
                }}
              >
                {/* Stats Grid */}
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {/* Followers */}
                  <div
                    style={{
                      display: "flex",
                      border: `2px solid ${C.border}`,
                      padding: "15px 20px",
                      backgroundColor: "rgba(167, 255, 0, 0.05)",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px", width: "100%" }}>
                      <div style={{ color: C.green, fontSize: "14px", display: "flex" }}>
                        {'>'} FOLLOWERS
                      </div>
                      <div style={{ color: C.text, fontSize: "42px", fontWeight: "bold", display: "flex" }}>
                        {userData.followers.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Following */}
                  <div
                    style={{
                      display: "flex",
                      border: `2px solid ${C.border}`,
                      padding: "15px 20px",
                      backgroundColor: "rgba(167, 255, 0, 0.05)",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px", width: "100%" }}>
                      <div style={{ color: C.green, fontSize: "14px", display: "flex" }}>
                        {'>'} FOLLOWING
                      </div>
                      <div style={{ color: C.text, fontSize: "42px", fontWeight: "bold", display: "flex" }}>
                        {userData.following.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Posts */}
                  <div
                    style={{
                      display: "flex",
                      border: `2px solid ${C.border}`,
                      padding: "15px 20px",
                      backgroundColor: "rgba(167, 255, 0, 0.05)",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px", width: "100%" }}>
                      <div style={{ color: C.green, fontSize: "14px", display: "flex" }}>
                        {'>'} POSTS
                      </div>
                      <div style={{ color: C.text, fontSize: "42px", fontWeight: "bold", display: "flex" }}>
                        {userData.posts.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    borderTop: `1px solid ${C.border}`,
                    paddingTop: "15px",
                    alignItems: "center",
                  }}
                >
                  <div style={{ color: C.green, fontSize: "16px", display: "flex" }}>
                    {'>_'}
                  </div>
                  <div style={{ color: C.dim, fontSize: "16px", display: "flex" }}>
                    skatehive.app
                  </div>
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
            backgroundColor: C.bg,
            fontFamily: "monospace",
          }}
        >
          <div style={{ color: C.green, fontSize: "48px", fontWeight: "bold", display: "flex" }}>
            🛹 SKATEHIVE
          </div>
          <div style={{ color: C.dim, fontSize: "24px", display: "flex", marginTop: "20px" }}>
            {'>'} Profile not found
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
