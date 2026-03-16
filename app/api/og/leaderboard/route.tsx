import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const C = {
  bg: "#050505",
  green: "#a7ff00",
  greenDim: "rgba(167, 255, 0, 0.10)",
  gold: "#FFD700",
  silver: "#C0C0C0",
  bronze: "#CD7F32",
  text: "#f0f0f0",
  dim: "#888",
  border: "#222",
} as const;

interface SkaterEntry {
  name: string;
  points: number;
  avatar: string;
}

async function getTop3(): Promise<SkaterEntry[]> {
  try {
    const res = await fetch("https://api.skatehive.app/api/v2/leaderboard", {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return [];

    const sorted = [...data].sort((a: any, b: any) => b.points - a.points).slice(0, 3);
    return sorted.map((s: any) => ({
      name: s.hive_author,
      points: Math.round(s.points),
      avatar: `https://images.hive.blog/u/${s.hive_author}/avatar/large`,
    }));
  } catch (e) {
    console.error("Leaderboard OG fetch error:", e);
    return [];
  }
}

function formatPoints(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format") || "og";
  const isFrame = format === "frame";
  const W = 1200;
  const H = isFrame ? 800 : 630;

  const top3 = await getTop3();

  // Podium order: [1st center, 2nd left, 3rd right]
  const first = top3[0];
  const second = top3[1];
  const third = top3[2];

  const medalColors = [C.gold, C.silver, C.bronze];
  const podiumHeights = isFrame ? [320, 260, 220] : [260, 210, 180];
  const avatarSizes = [120, 100, 100];

  const renderPodiumSlot = (
    skater: SkaterEntry | undefined,
    rank: number,
    height: number,
    avatarSize: number,
  ) => {
    if (!skater) return null;
    const medal = medalColors[rank];
    const rankLabel = rank === 0 ? "1ST" : rank === 1 ? "2ND" : "3RD";

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
        }}
      >
        {/* Avatar with medal ring */}
        <div
          style={{
            display: "flex",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              border: `4px solid ${medal}`,
              borderRadius: "50%",
              padding: "3px",
              background: C.bg,
              boxShadow: `0 0 20px ${medal}40`,
            }}
          >
            <img
              src={skater.avatar}
              alt=""
              width={avatarSize}
              height={avatarSize}
              style={{ borderRadius: "50%", objectFit: "cover" }}
            />
          </div>
        </div>

        {/* Name */}
        <div
          style={{
            color: C.text,
            fontSize: skater.name.length > 12 ? "16px" : "20px",
            fontWeight: "900",
            display: "flex",
            letterSpacing: "1px",
          }}
        >
          {skater.name}
        </div>

        {/* Podium bar */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "220px",
            height: `${height}px`,
            background: `linear-gradient(180deg, ${medal}18 0%, ${medal}08 100%)`,
            border: `1px solid ${medal}40`,
            borderBottom: "none",
            paddingTop: "20px",
            gap: "8px",
          }}
        >
          {/* Rank */}
          <div
            style={{
              color: medal,
              fontSize: "28px",
              fontWeight: "900",
              display: "flex",
              letterSpacing: "3px",
            }}
          >
            {rankLabel}
          </div>

          {/* Points */}
          <div
            style={{
              color: C.text,
              fontSize: "32px",
              fontWeight: "900",
              display: "flex",
            }}
          >
            {formatPoints(skater.points)}
          </div>

          <div
            style={{
              color: C.dim,
              fontSize: "11px",
              display: "flex",
              letterSpacing: "3px",
            }}
          >
            POINTS
          </div>
        </div>
      </div>
    );
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          fontFamily: "monospace",
          overflow: "hidden",
          backgroundColor: C.bg,
        }}
      >
        {/* Subtle radial glow */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "radial-gradient(ellipse 70% 40% at 50% 30%, rgba(167,255,0,0.04) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Grid lines */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "repeating-linear-gradient(90deg, transparent, transparent 120px, rgba(167,255,0,0.015) 120px, rgba(167,255,0,0.015) 121px)",
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
            padding: isFrame ? "40px 60px 0" : "30px 60px 0",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: isFrame ? "30px" : "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  color: C.green,
                  fontSize: "22px",
                  fontWeight: "900",
                  display: "flex",
                  letterSpacing: "6px",
                }}
              >
                SKATEHIVE
              </div>
              <div style={{ color: C.dim, fontSize: "22px", display: "flex" }}>/</div>
              <div
                style={{
                  color: C.dim,
                  fontSize: "16px",
                  display: "flex",
                  letterSpacing: "4px",
                }}
              >
                LEADERBOARD
              </div>
            </div>

            <div
              style={{
                color: C.green,
                fontSize: "14px",
                display: "flex",
                letterSpacing: "3px",
              }}
            >
              skatehive.app
            </div>
          </div>

          {/* Podium — 2nd | 1st | 3rd aligned to bottom */}
          <div
            style={{
              display: "flex",
              flex: 1,
              alignItems: "flex-end",
              justifyContent: "center",
              gap: "16px",
            }}
          >
            {/* 2nd place */}
            {renderPodiumSlot(second, 1, podiumHeights[1], avatarSizes[1])}

            {/* 1st place */}
            {renderPodiumSlot(first, 0, podiumHeights[0], avatarSizes[0])}

            {/* 3rd place */}
            {renderPodiumSlot(third, 2, podiumHeights[2], avatarSizes[2])}
          </div>
        </div>
      </div>
    ),
    { width: W, height: H },
  );
}
