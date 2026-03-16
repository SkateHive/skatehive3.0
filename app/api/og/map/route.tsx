import { ImageResponse } from "next/og";

export const runtime = "edge";

const C = {
  bg: "#050505",
  green: "#a7ff00",
  greenDim: "rgba(167, 255, 0, 0.10)",
  dim: "#888",
  text: "#f0f0f0",
  border: "#222",
} as const;

export async function GET() {
  const W = 1200;
  const H = 630;
  const globeSize = 220;

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
        {/* Radial glow behind globe */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "radial-gradient(circle at 50% 42%, rgba(167,255,0,0.08) 0%, transparent 50%)",
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
            background: "repeating-linear-gradient(0deg, transparent, transparent 60px, rgba(167,255,0,0.012) 60px, rgba(167,255,0,0.012) 61px), repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(167,255,0,0.012) 60px, rgba(167,255,0,0.012) 61px)",
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
            gap: "28px",
            padding: "50px 80px",
          }}
        >
          {/* SKATEHIVE brand */}
          <div
            style={{
              color: C.green,
              fontSize: "20px",
              fontWeight: "900",
              display: "flex",
              letterSpacing: "8px",
            }}
          >
            SKATEHIVE
          </div>

          {/* Globe */}
          <div
            style={{
              display: "flex",
              position: "relative",
              width: `${globeSize}px`,
              height: `${globeSize}px`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Outer glow */}
            <div
              style={{
                position: "absolute",
                width: `${globeSize + 40}px`,
                height: `${globeSize + 40}px`,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(167,255,0,0.15) 0%, transparent 70%)",
                display: "flex",
                top: "-20px",
                left: "-20px",
              }}
            />

            {/* Main globe circle */}
            <div
              style={{
                position: "absolute",
                width: `${globeSize}px`,
                height: `${globeSize}px`,
                borderRadius: "50%",
                border: `2px solid ${C.green}`,
                display: "flex",
              }}
            />

            {/* Vertical ellipse (meridian) */}
            <div
              style={{
                position: "absolute",
                width: `${globeSize * 0.5}px`,
                height: `${globeSize}px`,
                borderRadius: "50%",
                border: `1.5px solid rgba(167,255,0,0.4)`,
                display: "flex",
              }}
            />

            {/* Narrower vertical ellipse */}
            <div
              style={{
                position: "absolute",
                width: `${globeSize * 0.2}px`,
                height: `${globeSize}px`,
                borderRadius: "50%",
                border: `1px solid rgba(167,255,0,0.25)`,
                display: "flex",
              }}
            />

            {/* Horizontal line (equator) */}
            <div
              style={{
                position: "absolute",
                width: `${globeSize}px`,
                height: "0px",
                borderTop: `1.5px solid rgba(167,255,0,0.4)`,
                display: "flex",
              }}
            />

            {/* Upper latitude line */}
            <div
              style={{
                position: "absolute",
                width: `${globeSize * 0.85}px`,
                height: "0px",
                borderTop: `1px solid rgba(167,255,0,0.2)`,
                top: `${globeSize * 0.28}px`,
                display: "flex",
              }}
            />

            {/* Lower latitude line */}
            <div
              style={{
                position: "absolute",
                width: `${globeSize * 0.85}px`,
                height: "0px",
                borderTop: `1px solid rgba(167,255,0,0.2)`,
                top: `${globeSize * 0.72}px`,
                display: "flex",
              }}
            />

            {/* Small pin dot — top right area */}
            <div
              style={{
                position: "absolute",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: C.green,
                boxShadow: `0 0 12px ${C.green}`,
                top: `${globeSize * 0.3}px`,
                left: `${globeSize * 0.65}px`,
                display: "flex",
              }}
            />

            {/* Small pin dot — bottom left */}
            <div
              style={{
                position: "absolute",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: C.green,
                boxShadow: `0 0 10px ${C.green}`,
                top: `${globeSize * 0.6}px`,
                left: `${globeSize * 0.25}px`,
                display: "flex",
              }}
            />

            {/* Small pin dot — center */}
            <div
              style={{
                position: "absolute",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: C.green,
                boxShadow: `0 0 10px ${C.green}`,
                top: `${globeSize * 0.42}px`,
                left: `${globeSize * 0.48}px`,
                display: "flex",
              }}
            />
          </div>

          {/* Title */}
          <div
            style={{
              color: C.text,
              fontSize: "56px",
              fontWeight: "900",
              display: "flex",
              letterSpacing: "2px",
            }}
          >
            Skate Map
          </div>

          {/* Subtitle */}
          <div
            style={{
              color: C.dim,
              fontSize: "20px",
              display: "flex",
              letterSpacing: "2px",
            }}
          >
            Find skate spots worldwide
          </div>

          {/* Bottom URL */}
          <div
            style={{
              position: "absolute",
              bottom: "30px",
              display: "flex",
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
              skatehive.app/map
            </div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H },
  );
}
