import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const C = {
  bg: "#0a0a0a",
  green: "#a7ff00",
  text: "#e0e0e0",
  dim: "#666",
  border: "#333",
} as const;

interface PostData {
  title: string;
  author: string;
  body: string;
  created: string;
  bannerImage: string | null;
}

async function getPostData(
  author: string,
  permlink: string,
): Promise<PostData> {
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
    };
  } catch {
    return {
      title: "Skatehive Post",
      author: author.replace(/^@/, ""),
      body: "",
      created: "",
      bannerImage: null,
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

    const formattedDate = postData.created
      ? new Date(postData.created + "Z").toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "";

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
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              padding: "20px",
              gap: "16px",
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
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    background: "#ff5f56",
                    borderRadius: "6px",
                  }}
                />
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    background: "#ffbd2e",
                    borderRadius: "6px",
                  }}
                />
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    background: "#27c93f",
                    borderRadius: "6px",
                  }}
                />
              </div>
              <div
                style={{ color: C.green, fontSize: "18px", display: "flex" }}
              >
                SKATEHIVE {">"} post/{postData.author}
              </div>
            </div>

            {/* Content */}
            <div
              style={{
                display: "flex",
                gap: "30px",
                flex: 1,
              }}
            >
              {/* Left - Author + Meta */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  width: "280px",
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    display: "flex",
                    border: `3px solid ${C.green}`,
                    padding: "3px",
                    width: "120px",
                    height: "120px",
                  }}
                >
                  <img
                    src={`https://images.hive.blog/u/${postData.author}/avatar/small`}
                    alt="Avatar"
                    width="114"
                    height="114"
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div
                    style={{
                      color: C.green,
                      fontSize: "13px",
                      display: "flex",
                    }}
                  >
                    {">"} AUTHOR:
                  </div>
                  <div
                    style={{
                      color: C.text,
                      fontSize: "20px",
                      fontWeight: "bold",
                      display: "flex",
                    }}
                  >
                    @{postData.author}
                  </div>

                  {formattedDate && (
                    <>
                      <div
                        style={{
                          color: C.green,
                          fontSize: "13px",
                          display: "flex",
                          marginTop: "8px",
                        }}
                      >
                        {">"} DATE:
                      </div>
                      <div
                        style={{
                          color: C.dim,
                          fontSize: "16px",
                          display: "flex",
                        }}
                      >
                        {formattedDate}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right - Title + Excerpt */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  gap: "16px",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    color: C.green,
                    fontSize: "13px",
                    display: "flex",
                  }}
                >
                  {">"} TITLE:
                </div>
                <div
                  style={{
                    color: C.text,
                    fontSize: "32px",
                    fontWeight: "bold",
                    display: "flex",
                    lineHeight: "1.2",
                  }}
                >
                  {postData.title.length > 80
                    ? postData.title.slice(0, 77) + "..."
                    : postData.title}
                </div>

                {postData.body && (
                  <>
                    <div
                      style={{
                        color: C.green,
                        fontSize: "13px",
                        display: "flex",
                        marginTop: "8px",
                      }}
                    >
                      {">"} EXCERPT:
                    </div>
                    <div
                      style={{
                        color: C.dim,
                        fontSize: "16px",
                        display: "flex",
                        lineHeight: "1.5",
                      }}
                    >
                      {postData.body.length > 150
                        ? postData.body.slice(0, 147) + "..."
                        : postData.body}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                gap: "10px",
                borderTop: `1px solid ${C.border}`,
                paddingTop: "10px",
                alignItems: "center",
              }}
            >
              <div
                style={{ color: C.green, fontSize: "16px", display: "flex" }}
              >
                {">_"}
              </div>
              <div style={{ color: C.dim, fontSize: "16px", display: "flex" }}>
                skatehive.app
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
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
          <div
            style={{
              color: C.green,
              fontSize: "48px",
              fontWeight: "bold",
              display: "flex",
            }}
          >
            SKATEHIVE
          </div>
          <div
            style={{
              color: C.dim,
              fontSize: "24px",
              display: "flex",
              marginTop: "20px",
            }}
          >
            {">"} Post not found
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  }
}
