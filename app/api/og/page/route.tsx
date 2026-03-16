import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const C = {
  bg: "#050505",
  green: "#a7ff00",
  dim: "#888",
  text: "#f0f0f0",
  border: "#222",
} as const;

/**
 * Generic branded OG image for pages without custom OG.
 * Usage: /api/og/page?title=Skate+Map&subtitle=Find+spots+worldwide&icon=MAP
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get("title") || "Skatehive";
  const subtitle = searchParams.get("subtitle") || "";
  const icon = searchParams.get("icon") || "";
  const format = searchParams.get("format") || "og";

  const isFrame = format === "frame";
  const W = 1200;
  const H = isFrame ? 800 : 630;

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
        {/* Radial glow */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "radial-gradient(ellipse 60% 50% at 50% 45%, rgba(167,255,0,0.05) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Grid pattern */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "repeating-linear-gradient(0deg, transparent, transparent 80px, rgba(167,255,0,0.012) 80px, rgba(167,255,0,0.012) 81px), repeating-linear-gradient(90deg, transparent, transparent 80px, rgba(167,255,0,0.012) 80px, rgba(167,255,0,0.012) 81px)",
            display: "flex",
          }}
        />

        {/* Left accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "5px",
            height: "100%",
            background: `linear-gradient(180deg, transparent 5%, ${C.green} 30%, ${C.green} 70%, transparent 95%)`,
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
            alignItems: "center",
            gap: "24px",
            padding: "60px 80px",
          }}
        >
          {/* SKATEHIVE brand */}
          <div
            style={{
              color: C.green,
              fontSize: "22px",
              fontWeight: "900",
              display: "flex",
              letterSpacing: "8px",
            }}
          >
            SKATEHIVE
          </div>

          {/* Icon/emoji placeholder */}
          {icon && (
            <div
              style={{
                color: C.green,
                fontSize: "18px",
                fontWeight: "bold",
                display: "flex",
                letterSpacing: "4px",
                opacity: 0.6,
                border: `1px solid ${C.border}`,
                padding: "6px 20px",
              }}
            >
              {icon}
            </div>
          )}

          {/* Main title */}
          <div
            style={{
              color: C.text,
              fontSize: title.length > 30 ? "52px" : "64px",
              fontWeight: "900",
              display: "flex",
              textAlign: "center",
              letterSpacing: "2px",
              lineHeight: "1.1",
            }}
          >
            {title}
          </div>

          {/* Subtitle */}
          {subtitle && (
            <div
              style={{
                color: C.dim,
                fontSize: "20px",
                display: "flex",
                textAlign: "center",
                maxWidth: "800px",
                lineHeight: "1.5",
                letterSpacing: "1px",
              }}
            >
              {subtitle}
            </div>
          )}

          {/* Bottom URL */}
          <div
            style={{
              position: "absolute",
              bottom: "30px",
              display: "flex",
              gap: "8px",
              alignItems: "center",
            }}
          >
            <div style={{ color: C.green, fontSize: "15px", fontWeight: "900", display: "flex", letterSpacing: "3px" }}>
              skatehive.app
            </div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H },
  );
}
