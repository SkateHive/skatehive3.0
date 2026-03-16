import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const C = {
  bg: "#050505",
  green: "#a7ff00",
  greenDim: "rgba(167, 255, 0, 0.10)",
  greenGlow: "rgba(167, 255, 0, 0.20)",
  text: "#f0f0f0",
  dim: "#888",
  border: "#222",
} as const;

interface PostData {
  title: string;
  author: string;
  body: string;
  created: string;
  bannerImage: string | null;
  found: boolean;
}

async function getPostData(author: string, permlink: string): Promise<PostData> {
  try {
    const cleanAuthor = author.replace(/^@/, "");

    const res = await fetch("https://api.hive.blog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "condenser_api.get_content",
        params: [cleanAuthor, permlink],
        id: 1,
      }),
    });

    if (!res.ok) throw new Error("Failed to fetch post");

    const data = await res.json();
    if (data.error) throw new Error(data.error.message || "API error");
    const post = data.result;

    if (!post || !post.author) throw new Error("Post not found");

    // Extract banner image from json_metadata
    let bannerImage: string | null = null;
    try {
      let meta = post.json_metadata;
      if (typeof meta === "string") meta = JSON.parse(meta);
      if (meta?.image?.[0]) bannerImage = meta.image[0];
      else if (meta?.thumbnail?.[0]) bannerImage = meta.thumbnail[0];
    } catch {}

    // Also try to find image in body if metadata has none
    if (!bannerImage && post.body) {
      const imgMatch = post.body.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
      if (imgMatch) bannerImage = imgMatch[1];
      else {
        const htmlImgMatch = post.body.match(/<img[^>]+src="(https?:\/\/[^"]+)"/);
        if (htmlImgMatch) bannerImage = htmlImgMatch[1];
      }
    }

    // Clean body for description
    const body = (post.body || "")
      .replace(/<[^>]*>/g, "")
      .replace(/!\[.*?\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/\n{3,}/g, "\n")
      .trim()
      .slice(0, 200);

    return {
      title: post.title || "Skatehive Post",
      author: cleanAuthor,
      body,
      created: post.created || "",
      bannerImage,
      found: true,
    };
  } catch {
    return {
      title: "Skatehive Post",
      author: author.replace(/^@/, ""),
      body: "",
      created: "",
      bannerImage: null,
      found: false,
    };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ author: string; permlink: string }> },
) {
  try {
    const { author, permlink } = await params;
    const postData = await getPostData(author, permlink);

    const format = request.nextUrl.searchParams.get("format") || "og";
    const isFrame = format === "frame";
    const W = 1200;
    const H = isFrame ? 800 : 630;

    const formattedDate = postData.created
      ? new Date(postData.created + "Z").toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "";

    const avatarUrl = `https://images.hive.blog/u/${postData.author}/avatar`;
    const hasBanner = postData.found && !!postData.bannerImage;

    // Layout: if there's a banner image, show it on the right side
    // If no banner, full-width text layout
    const thumbnailWidth = hasBanner ? 420 : 0;
    const textAreaWidth = W - thumbnailWidth - 160; // padding

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
          {/* Subtle radial gradient */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "radial-gradient(ellipse 70% 50% at 30% 50%, rgba(167,255,0,0.03) 0%, transparent 70%)",
              display: "flex",
            }}
          />

          {/* Left accent bar */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "4px",
              height: "100%",
              background: `linear-gradient(180deg, transparent 10%, ${C.green} 35%, ${C.green} 65%, transparent 90%)`,
              display: "flex",
            }}
          />

          {/* Content layout */}
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: isFrame ? "48px 60px 48px 60px" : "36px 60px 36px 60px",
            }}
          >
            {/* Top bar: SKATEHIVE / POST + date */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    color: C.green,
                    fontSize: "20px",
                    fontWeight: "900",
                    display: "flex",
                    letterSpacing: "5px",
                  }}
                >
                  SKATEHIVE
                </div>
                <div style={{ color: C.dim, fontSize: "20px", display: "flex" }}>/</div>
                <div
                  style={{
                    color: C.dim,
                    fontSize: "14px",
                    display: "flex",
                    letterSpacing: "3px",
                  }}
                >
                  {postData.title === "Skatehive Post" ? "POST" : "post/@" + postData.author}
                </div>
              </div>

              {formattedDate && (
                <div
                  style={{
                    color: C.dim,
                    fontSize: "14px",
                    display: "flex",
                    letterSpacing: "1px",
                  }}
                >
                  {formattedDate}
                </div>
              )}
            </div>

            {/* Main content row: text left, thumbnail right */}
            <div
              style={{
                display: "flex",
                flex: 1,
                gap: "40px",
                alignItems: "center",
                paddingTop: "12px",
                paddingBottom: "12px",
              }}
            >
              {/* Text column */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  flex: 1,
                  justifyContent: "center",
                  maxWidth: hasBanner ? `${textAreaWidth}px` : "100%",
                }}
              >
                {/* Author info */}
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  {postData.found && (
                    <img
                      src={avatarUrl}
                      alt=""
                      width="40"
                      height="40"
                      style={{
                        borderRadius: "50%",
                        border: `2px solid ${C.green}`,
                      }}
                    />
                  )}
                  <div
                    style={{
                      color: C.green,
                      fontSize: "18px",
                      fontWeight: "bold",
                      display: "flex",
                    }}
                  >
                    @{postData.author}
                  </div>
                </div>

                {/* Title */}
                <div
                  style={{
                    color: C.text,
                    fontSize: postData.title.length > 60 ? "28px" : postData.title.length > 40 ? "34px" : "40px",
                    fontWeight: "900",
                    display: "flex",
                    lineHeight: "1.2",
                    letterSpacing: "0.5px",
                  }}
                >
                  {postData.title.length > 85
                    ? postData.title.slice(0, 82) + "..."
                    : postData.title}
                </div>

                {/* Excerpt - only if no banner (more space) or short title */}
                {postData.body && (!hasBanner || postData.title.length < 50) && (
                  <div
                    style={{
                      color: C.dim,
                      fontSize: "16px",
                      display: "flex",
                      lineHeight: "1.5",
                      maxWidth: hasBanner ? "500px" : "800px",
                    }}
                  >
                    {postData.body.length > (hasBanner ? 120 : 180)
                      ? postData.body.slice(0, hasBanner ? 117 : 177) + "..."
                      : postData.body}
                  </div>
                )}
              </div>

              {/* Thumbnail image — right side */}
              {hasBanner && (
                <div
                  style={{
                    display: "flex",
                    flexShrink: 0,
                    width: `${thumbnailWidth}px`,
                    height: isFrame ? "380px" : "320px",
                    position: "relative",
                    overflow: "hidden",
                    border: `1px solid ${C.border}`,
                  }}
                >
                  <img
                    src={postData.bannerImage!}
                    alt=""
                    width={thumbnailWidth}
                    height={isFrame ? 380 : 320}
                    style={{
                      objectFit: "cover",
                      width: "100%",
                      height: "100%",
                    }}
                  />
                  {/* Subtle gradient overlay on image edges */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      background: "linear-gradient(90deg, rgba(5,5,5,0.3) 0%, transparent 20%, transparent 80%, rgba(5,5,5,0.1) 100%)",
                      display: "flex",
                    }}
                  />
                </div>
              )}
            </div>

            {/* Bottom bar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: `1px solid ${C.border}`,
                paddingTop: "12px",
              }}
            >
              <div
                style={{
                  color: C.green,
                  fontSize: "15px",
                  fontWeight: "900",
                  display: "flex",
                  letterSpacing: "3px",
                }}
              >
                skatehive.app
              </div>
              <div
                style={{
                  color: C.dim,
                  fontSize: "13px",
                  display: "flex",
                  letterSpacing: "2px",
                }}
              >
                SKATE. CREATE. EARN.
              </div>
            </div>
          </div>
        </div>
      ),
      { width: W, height: H },
    );
  } catch (err) {
    console.error("POST OG ERROR:", err);
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
          <div style={{ color: "#a7ff00", fontSize: "48px", fontWeight: "bold", display: "flex" }}>
            SKATEHIVE
          </div>
          <div style={{ color: "#888", fontSize: "24px", display: "flex", marginTop: "20px" }}>
            Post not found
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }
}
