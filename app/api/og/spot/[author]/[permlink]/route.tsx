import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { parseSpotBody } from "@/lib/utils/parseSpotBody";
import { pickSpotThumbnail } from "@/lib/spotmap/getThumbnail";
import { parseKmlDescription } from "@/lib/spotmap/parseKmlDescription";

export const runtime = "edge";

const OG_CACHE_HEADER =
  "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";

// Reserved author for spots imported from the Google My Maps KML feed.
// Matches app/spot/[author]/[permlink]/page.tsx.
const SYNTHETIC_KML_AUTHOR = "skatehive-map";

// Extensions next/og (Satori) cannot embed as an <img>. Blocklist rather
// than allowlist so extensionless IPFS CIDs still render. Same rule as
// /api/og/post.
const NON_RENDERABLE_EXTENSIONS = new Set([
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".avi",
  ".mkv",
  ".m3u8",
  ".ts",
  ".mp3",
  ".wav",
  ".ogg",
  ".flac",
  ".json",
  ".html",
  ".htm",
  ".pdf",
  ".svg",
]);

const C = {
  bg: "#050505",
  green: "#a7ff00",
  greenDim: "rgba(167, 255, 0, 0.10)",
  text: "#f0f0f0",
  dim: "#888",
  border: "#222",
} as const;

interface SpotCardData {
  name: string;
  authorLabel: string;
  location: string;
  description: string;
  created: string;
  image: string | null;
  found: boolean;
}

function getRenderableImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.href.length > 2048) return null;

    const pathname = url.pathname.toLowerCase();
    const dotIndex = pathname.lastIndexOf(".");
    const extension = dotIndex >= 0 ? pathname.slice(dotIndex) : "";
    if (extension && NON_RENDERABLE_EXTENSIONS.has(extension)) return null;
    return url.href;
  } catch {}

  return null;
}

/**
 * Satori cannot embed WebP, and full-size phone photos blow the card
 * render. IPFS gateway URLs get a JPEG transform (same as /api/og/post).
 * images.hive.blog / files.peakd.com go through the Hive resize proxy so
 * the ~420px panel does not pull a multi-megabyte original.
 */
function toSatoriRenderableUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const isGatewayImage =
      url.hostname.includes("ipfs.skatehive.app") ||
      url.hostname.includes("pinata") ||
      url.pathname.includes("/ipfs/");
    if (isGatewayImage) {
      url.searchParams.set("img-format", "jpeg");
      url.searchParams.set("img-width", "480");
      url.searchParams.set("img-fit", "cover");
      url.searchParams.set("img-quality", "80");
      return url.href;
    }
    if (
      url.hostname === "images.hive.blog" ||
      url.hostname === "files.peakd.com"
    ) {
      return `https://images.hive.blog/960x0/${url.href}`;
    }
  } catch {}
  return value;
}

function stripEmoji(value: string): string {
  return value
    .replace(/[\u{10000}-\u{10FFFF}]|[\u{2600}-\u{27BF}]|[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function locationLine(
  address: string | null,
  lat: number | null,
  lng: number | null,
): string {
  if (address) return stripEmoji(address);
  if (lat != null && lng != null) {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
  return "";
}

async function getKmlSpotData(permlink: string): Promise<SpotCardData | null> {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  const query = new URL(
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/spotmap_spots`,
  );
  query.searchParams.set("select", "name,lat,lng,address,thumbnail,thumbnail_override,kml_description");
  query.searchParams.set("hive_author", `eq.${SYNTHETIC_KML_AUTHOR}`);
  query.searchParams.set("hive_permlink", `eq.${permlink}`);
  query.searchParams.set("limit", "1");

  const res = await fetch(query.href, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{
    name?: string | null;
    lat?: number | null;
    lng?: number | null;
    address?: string | null;
    thumbnail?: string | null;
    thumbnail_override?: string | null;
    kml_description?: string | null;
  }>;
  const row = rows?.[0];
  if (!row) return null;

  const parsed = parseKmlDescription(row.kml_description);
  const image =
    getRenderableImageUrl(row.thumbnail_override) ??
    getRenderableImageUrl(row.thumbnail) ??
    getRenderableImageUrl(parsed.images[0]);

  return {
    name: stripEmoji(row.name || "") || "Skate spot",
    authorLabel: "Skate map",
    location: locationLine(row.address ?? null, row.lat ?? null, row.lng ?? null),
    description: stripEmoji(parsed.text).slice(0, 200),
    created: "",
    image: toSatoriRenderableUrl(image),
    found: true,
  };
}

async function getHiveSpotData(author: string, permlink: string): Promise<SpotCardData | null> {
  const res = await fetch("https://api.hive.blog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    next: { revalidate: 86400 },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "condenser_api.get_content",
      params: [author, permlink],
      id: 1,
    }),
  });
  if (!res.ok) return null;

  const data = await res.json();
  if (data.error) return null;
  const post = data.result;
  if (!post || !post.author) return null;

  const spot = parseSpotBody(post.body);
  const thumbnail = pickSpotThumbnail({
    firstMarkdownImage: spot.images[0]?.url,
    body: post.body,
    json_metadata: post.json_metadata,
  });

  const description = stripEmoji(spot.description || "").slice(0, 200);

  return {
    name: stripEmoji(spot.name || post.title || "") || "Skate spot",
    authorLabel: `@${author}`,
    location: locationLine(spot.address, spot.lat, spot.lng),
    description,
    created: post.created || "",
    image: toSatoriRenderableUrl(getRenderableImageUrl(thumbnail)),
    found: true,
  };
}

async function getSpotData(author: string, permlink: string): Promise<SpotCardData> {
  const cleanAuthor = author.replace(/^@/, "").trim();
  const empty: SpotCardData = {
    name: "Skate spot",
    authorLabel: cleanAuthor === SYNTHETIC_KML_AUTHOR ? "Skate map" : `@${cleanAuthor}`,
    location: "",
    description: "",
    created: "",
    image: null,
    found: false,
  };

  try {
    const data =
      cleanAuthor === SYNTHETIC_KML_AUTHOR
        ? await getKmlSpotData(permlink)
        : await getHiveSpotData(cleanAuthor, permlink);
    return data ?? empty;
  } catch {
    return empty;
  }
}

function SpotCard({
  spot,
  isFrame,
}: {
  spot: SpotCardData;
  isFrame: boolean;
}) {
  const W = 1200;
  const hasImage = spot.found && !!spot.image;
  const thumbnailWidth = hasImage ? 420 : 0;
  const textAreaWidth = W - thumbnailWidth - 160;
  const formattedDate = spot.created
    ? new Date(spot.created + "Z").toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";
  const name =
    spot.name.length > 72 ? spot.name.slice(0, 69) + "..." : spot.name;

  return (
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
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background:
            "radial-gradient(ellipse 70% 50% at 30% 50%, rgba(167,255,0,0.03) 0%, transparent 70%)",
          display: "flex",
        }}
      />
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
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: isFrame ? "48px 60px" : "36px 60px",
        }}
      >
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
              SPOT
            </div>
          </div>
          {formattedDate ? (
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
          ) : null}
        </div>

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
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              flex: 1,
              justifyContent: "center",
              maxWidth: hasImage ? `${textAreaWidth}px` : "100%",
            }}
          >
            <div
              style={{
                color: C.green,
                fontSize: "18px",
                fontWeight: "bold",
                display: "flex",
              }}
            >
              {spot.authorLabel}
            </div>
            <div
              style={{
                color: C.text,
                fontSize: name.length > 48 ? "32px" : "42px",
                fontWeight: "900",
                display: "flex",
                lineHeight: "1.2",
                letterSpacing: "0.5px",
              }}
            >
              {name}
            </div>
            {spot.location ? (
              <div
                style={{
                  color: C.green,
                  fontSize: "16px",
                  display: "flex",
                  letterSpacing: "0.5px",
                }}
              >
                {spot.location.length > 80
                  ? spot.location.slice(0, 77) + "..."
                  : spot.location}
              </div>
            ) : null}
            {spot.description ? (
              <div
                style={{
                  color: C.dim,
                  fontSize: "16px",
                  display: "flex",
                  lineHeight: "1.5",
                  maxWidth: hasImage ? "500px" : "800px",
                }}
              >
                {spot.description.length > (hasImage ? 110 : 180)
                  ? spot.description.slice(0, hasImage ? 107 : 177) + "..."
                  : spot.description}
              </div>
            ) : null}
          </div>

          {hasImage ? (
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
                src={spot.image!}
                alt=""
                width={thumbnailWidth}
                height={isFrame ? 380 : 320}
                style={{
                  objectFit: "cover",
                  width: "100%",
                  height: "100%",
                }}
              />
            </div>
          ) : null}
        </div>

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
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ author: string; permlink: string }> },
) {
  const format = request.nextUrl.searchParams.get("format") || "og";
  const isFrame = format === "frame";
  const width = 1200;
  const height = isFrame ? 800 : 630;

  try {
    const { author, permlink } = await params;
    const decodedAuthor = decodeURIComponent(author);
    const decodedPermlink = decodeURIComponent(permlink);
    const spot = await getSpotData(decodedAuthor, decodedPermlink);

    return new ImageResponse(<SpotCard spot={spot} isFrame={isFrame} />, {
      width,
      height,
      headers: { "Cache-Control": OG_CACHE_HEADER },
    });
  } catch (err) {
    console.error("SPOT OG ERROR:", err);
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
            Skate spot
          </div>
        </div>
      ),
      {
        width,
        height,
        headers: { "Cache-Control": OG_CACHE_HEADER },
      },
    );
  }
}
