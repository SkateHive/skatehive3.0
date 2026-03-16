import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const C = {
  bg: "#050505",
  card: "#111111",
  green: "#a7ff00",
  greenDim: "rgba(167, 255, 0, 0.08)",
  greenGlow: "rgba(167, 255, 0, 0.25)",
  text: "#f0f0f0",
  dim: "#888",
  border: "#222",
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
  found: boolean;
}

async function getUserData(username: string): Promise<UserData> {
  try {
    const normalized = username.toLowerCase().trim().replace(/^@/, "");

    if (!normalized || normalized.length < 3 || normalized.length > 16) {
      return {
        username: normalized,
        name: normalized,
        about: "",
        profileImage: `https://images.hive.blog/u/${normalized}/avatar/large`,
        coverImage: null,
        followers: 0,
        following: 0,
        posts: 0,
        found: false,
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

    if (!accountResponse.ok) throw new Error("Hive API error");

    const accountData = await accountResponse.json();
    const account = accountData.result?.[0];
    if (!account) throw new Error("User not found");

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

    let profileImage = `https://images.hive.blog/u/${normalized}/avatar/large`;
    let coverImage = null;
    let about = "";
    let name = normalized;

    if (account.posting_json_metadata) {
      try {
        const parsed = JSON.parse(account.posting_json_metadata);
        const profile = parsed?.profile || {};
        profileImage = profile.profile_image || profileImage;
        coverImage = profile.cover_image || null;
        about = profile.about || "";
        const rawName = profile.name || normalized;
        name = rawName.replace(/[\u{10000}-\u{10FFFF}]|[\u{2460}-\u{24FF}]|[\u{2600}-\u{27BF}]|[\u{1F000}-\u{1FFFF}]/gu, "").trim();
        if (!name) name = normalized;
      } catch {}
    }

    return {
      username: normalized,
      name,
      about: about.slice(0, 140),
      profileImage,
      coverImage,
      followers: profileInfo?.stats?.followers || 0,
      following: profileInfo?.stats?.following || 0,
      posts: account.post_count || profileInfo?.stats?.post_count || 0,
      found: true,
    };
  } catch {
    return {
      username,
      name: username,
      about: "",
      profileImage: `https://images.hive.blog/u/${username}/avatar/large`,
      coverImage: null,
      followers: 0,
      following: 0,
      posts: 0,
      found: false,
    };
  }
}

function formatStat(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
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

    const format = request.nextUrl.searchParams.get("format") || "og";
    const isFrame = format === "frame";
    const W = 1200;
    const H = isFrame ? 800 : 630;

    const userData = await getUserData(username);

    const avatarSize = isFrame ? 260 : 220;

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            backgroundColor: C.bg,
            fontFamily: "monospace",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Cover image as background — full bleed */}
          {userData.found && userData.coverImage && (
            <img
              src={userData.coverImage}
              alt=""
              width={W}
              height={H}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.45,
              }}
            />
          )}

          {/* Heavy dark gradient overlay */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "linear-gradient(135deg, rgba(5,5,5,0.75) 0%, rgba(5,5,5,0.45) 40%, rgba(5,5,5,0.8) 100%)",
              display: "flex",
            }}
          />

          {/* Large green glow orb — centered behind avatar area */}
          <div
            style={{
              position: "absolute",
              top: `${isFrame ? 100 : 60}px`,
              left: "20px",
              width: "500px",
              height: "500px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(167,255,0,0.07) 0%, transparent 65%)",
              display: "flex",
            }}
          />

          {/* Accent line — left edge */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "4px",
              height: "100%",
              background: `linear-gradient(180deg, transparent 10%, ${C.green} 40%, ${C.green} 60%, transparent 90%)`,
              display: "flex",
            }}
          />

          {/* Content */}
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: isFrame ? "50px 80px" : "40px 70px",
              gap: isFrame ? "36px" : "28px",
            }}
          >
            {/* Main row: Avatar + Info */}
            <div
              style={{
                display: "flex",
                gap: "52px",
                alignItems: "center",
              }}
            >
              {/* Avatar with glow ring */}
              <div
                style={{
                  display: "flex",
                  flexShrink: 0,
                  position: "relative",
                }}
              >
                {/* Glow behind avatar */}
                <div
                  style={{
                    position: "absolute",
                    top: "-12px",
                    left: "-12px",
                    width: `${avatarSize + 24}px`,
                    height: `${avatarSize + 24}px`,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${C.greenGlow} 0%, transparent 70%)`,
                    display: "flex",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    border: `4px solid ${C.green}`,
                    borderRadius: "50%",
                    padding: "4px",
                    width: `${avatarSize + 8}px`,
                    height: `${avatarSize + 8}px`,
                    alignItems: "center",
                    justifyContent: "center",
                    background: C.bg,
                    position: "relative",
                  }}
                >
                  {userData.found ? (
                    <img
                      src={userData.profileImage}
                      alt=""
                      width={avatarSize}
                      height={avatarSize}
                      style={{
                        objectFit: "cover",
                        borderRadius: "50%",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        color: C.green,
                        fontSize: "72px",
                        fontWeight: "900",
                        display: "flex",
                        opacity: 0.3,
                      }}
                    >
                      ?
                    </div>
                  )}
                </div>
              </div>

              {/* Name + username + bio */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  flex: 1,
                }}
              >
                {/* Display name — large */}
                <div
                  style={{
                    color: C.text,
                    fontSize: userData.name.length > 14 ? "44px" : "54px",
                    fontWeight: "900",
                    display: "flex",
                    lineHeight: "1.1",
                    letterSpacing: "-1px",
                  }}
                >
                  {userData.name}
                </div>

                {/* @username */}
                <div
                  style={{
                    color: C.green,
                    fontSize: "22px",
                    display: "flex",
                    letterSpacing: "1px",
                  }}
                >
                  @{username}
                </div>

                {/* Bio */}
                {userData.about && (
                  <div
                    style={{
                      color: C.dim,
                      fontSize: "18px",
                      display: "flex",
                      lineHeight: "1.5",
                      marginTop: "6px",
                      maxWidth: "550px",
                    }}
                  >
                    {userData.about}
                  </div>
                )}
              </div>
            </div>

            {/* Stats bar — full width with separators */}
            <div
              style={{
                display: "flex",
                border: `1px solid ${C.border}`,
                background: "rgba(17,17,17,0.8)",
              }}
            >
              {/* Followers */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: 1,
                  padding: "20px 0",
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    color: C.green,
                    fontSize: "38px",
                    fontWeight: "900",
                    display: "flex",
                    lineHeight: "1",
                  }}
                >
                  {formatStat(userData.followers)}
                </div>
                <div
                  style={{
                    color: C.dim,
                    fontSize: "11px",
                    display: "flex",
                    letterSpacing: "4px",
                  }}
                >
                  FOLLOWERS
                </div>
              </div>

              {/* Separator */}
              <div
                style={{
                  width: "1px",
                  background: C.border,
                  display: "flex",
                }}
              />

              {/* Following */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: 1,
                  padding: "20px 0",
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    color: C.text,
                    fontSize: "38px",
                    fontWeight: "900",
                    display: "flex",
                    lineHeight: "1",
                  }}
                >
                  {formatStat(userData.following)}
                </div>
                <div
                  style={{
                    color: C.dim,
                    fontSize: "11px",
                    display: "flex",
                    letterSpacing: "4px",
                  }}
                >
                  FOLLOWING
                </div>
              </div>

              {/* Separator */}
              <div
                style={{
                  width: "1px",
                  background: C.border,
                  display: "flex",
                }}
              />

              {/* Posts */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: 1,
                  padding: "20px 0",
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    color: C.text,
                    fontSize: "38px",
                    fontWeight: "900",
                    display: "flex",
                    lineHeight: "1",
                  }}
                >
                  {formatStat(userData.posts)}
                </div>
                <div
                  style={{
                    color: C.dim,
                    fontSize: "11px",
                    display: "flex",
                    letterSpacing: "4px",
                  }}
                >
                  POSTS
                </div>
              </div>
            </div>

            {/* Footer: logo + url */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    color: C.green,
                    fontSize: "18px",
                    fontWeight: "bold",
                    display: "flex",
                    letterSpacing: "5px",
                  }}
                >
                  SKATEHIVE
                </div>
              </div>
              <div
                style={{
                  color: C.dim,
                  fontSize: "16px",
                  display: "flex",
                  letterSpacing: "1px",
                }}
              >
                skatehive.app/user/{username}
              </div>
            </div>
          </div>
        </div>
      ),
      { width: W, height: H },
    );
  } catch {
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
            SKATEHIVE
          </div>
          <div style={{ color: C.dim, fontSize: "24px", display: "flex", marginTop: "20px" }}>
            {">"} Profile not found
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }
}
