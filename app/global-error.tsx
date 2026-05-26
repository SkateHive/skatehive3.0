"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "@/lib/i18n/hooks";

const css = `
@keyframes bodyarc {
  0%   { left: -60px;  bottom: 18px;  opacity: 1; transform: rotate(0deg);  }
  18%  { left: 60px;   bottom: 18px;  opacity: 1; transform: rotate(0deg);  }
  22%  { left: 78px;   bottom: 18px;  opacity: 1; transform: rotate(0deg);  }
  44%  { left: 158px;  bottom: 105px; opacity: 1; transform: rotate(0deg);  }
  64%  { left: 228px;  bottom: 18px;  opacity: 1; transform: rotate(0deg);  }
  70%  { left: 238px;  bottom: 10px;  opacity: 1; transform: rotate(20deg); }
  77%  { left: 242px;  bottom: 2px;   opacity: 1; transform: rotate(85deg); }
  80%  { left: 243px;  bottom: 0px;   opacity: 0; transform: rotate(90deg); }
  81%  { left: -60px;  bottom: 18px;  opacity: 0; transform: rotate(0deg);  }
  87%  { left: -60px;  bottom: 18px;  opacity: 1; transform: rotate(0deg);  }
  100% { left: -60px;  bottom: 18px;  opacity: 1; transform: rotate(0deg);  }
}
@keyframes boardarc {
  0%   { left: -60px;  bottom: 9px;  opacity: 1; }
  18%  { left: 60px;   bottom: 9px;  opacity: 1; }
  22%  { left: 78px;   bottom: 9px;  opacity: 1; }
  44%  { left: 158px;  bottom: 58px; opacity: 1; }
  64%  { left: 228px;  bottom: 9px;  opacity: 1; }
  66%  { left: 232px;  bottom: 9px;  opacity: 0; }
  80%  { left: 232px;  bottom: 9px;  opacity: 0; }
  81%  { left: -60px;  bottom: 9px;  opacity: 0; }
  87%  { left: -60px;  bottom: 9px;  opacity: 1; }
  100% { left: -60px;  bottom: 9px;  opacity: 1; }
}
@keyframes flipanim {
  0%   { transform: rotateX(0deg);   }
  21%  { transform: rotateX(0deg);   }
  64%  { transform: rotateX(360deg); }
  65%  { transform: rotateX(0deg);   }
  100% { transform: rotateX(0deg);   }
}
@keyframes leananim {
  0%   { transform: rotate(0deg);   }
  21%  { transform: rotate(0deg);   }
  26%  { transform: rotate(-12deg); }
  44%  { transform: rotate(5deg);   }
  63%  { transform: rotate(0deg);   }
  100% { transform: rotate(0deg);   }
}
@keyframes breakleft {
  0%   { left: 214px; bottom: 9px; opacity: 0; transform: rotate(0deg);   }
  65%  { left: 214px; bottom: 9px; opacity: 0; transform: rotate(0deg);   }
  66%  { left: 214px; bottom: 9px; opacity: 1; transform: rotate(0deg);   }
  78%  { left: 198px; bottom: 3px; opacity: 1; transform: rotate(-28deg); }
  83%  { left: 192px; bottom: 0px; opacity: 0; transform: rotate(-38deg); }
  84%  { left: -40px; bottom: 9px; opacity: 0; }
  87%  { left: -40px; bottom: 9px; opacity: 1; }
  100% { left: -40px; bottom: 9px; opacity: 1; }
}
@keyframes breakright {
  0%   { left: 240px; bottom: 9px; opacity: 0; transform: rotate(0deg);  }
  65%  { left: 240px; bottom: 9px; opacity: 0; transform: rotate(0deg);  }
  66%  { left: 240px; bottom: 9px; opacity: 1; transform: rotate(0deg);  }
  78%  { left: 255px; bottom: 3px; opacity: 1; transform: rotate(28deg); }
  83%  { left: 261px; bottom: 0px; opacity: 0; transform: rotate(38deg); }
  84%  { left: -20px; bottom: 9px; opacity: 0; }
  87%  { left: -20px; bottom: 9px; opacity: 1; }
  100% { left: -20px; bottom: 9px; opacity: 1; }
}
@keyframes load {
  0%   { width: 0%; }
  100% { width: 100%; }
}
@keyframes dots {
  0%   { content: ''; }
  33%  { content: '.'; }
  66%  { content: '..'; }
  100% { content: '...'; }
}
`;

function isChunkError(error: Error): boolean {
  return (
    error.name === "ChunkLoadError" ||
    error.message.includes("Loading chunk") ||
    error.message.includes("Failed to fetch dynamically imported module")
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("globalError");
  const chunkError = isChunkError(error);

  const [shouldReload, setShouldReload] = useState(false);

  useEffect(() => {
    if (!chunkError) return;
    const retryKey = "chunk-error-retry-ts";
    const now = Date.now();
    const lastRetry = Number(sessionStorage.getItem(retryKey) ?? 0);
    const hasRetriedRecently = now - lastRetry < 30_000;
    if (!hasRetriedRecently) {
      sessionStorage.setItem(retryKey, String(now));
      setShouldReload(true);
    }
  }, [chunkError]);

  useEffect(() => {
    if (shouldReload) {
      window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
    }
  }, [shouldReload]);

  return (
    <html>
      <body>
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <div
          style={{
            "--ge-bg": "#0a0a0a",
            "--ge-accent": "#FFD700",
            "--ge-stroke": "#eee",
            "--ge-dim": "#888",
            "--ge-track": "#222",
            "--ge-ground": "#444",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "2rem",
            padding: "3rem 1rem",
            background: "var(--ge-bg)",
          } as React.CSSProperties}
        >
          <div style={{ position: "relative", width: 340, height: 150, overflow: "hidden" }}>
            <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, height: "1.5px", background: "var(--ge-ground)" }} />
            <img
              src="/logos/skatehive-logo-rounded.png"
              alt=""
              style={{
                position: "absolute",
                left: 150,
                bottom: 9,
                width: 38,
                height: 38,
                imageRendering: "pixelated",
              }}
            />
            <div style={{ position: "absolute", animation: "boardarc 4.2s linear infinite" }}>
              <svg
                width="50"
                height="20"
                viewBox="0 0 50 20"
                fill="none"
                style={{ animation: "flipanim 4.2s linear infinite", transformOrigin: "25px 4px", color: "var(--ge-stroke)" }}
              >
                <line x1="5" y1="4" x2="45" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="3" y1="4" x2="7" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="47" y1="4" x2="43" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="13" y1="4" x2="13" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="37" y1="4" x2="37" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="13" cy="11" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <circle cx="37" cy="11" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </div>
            <div style={{ position: "absolute", animation: "bodyarc 4.2s linear infinite" }}>
              <svg
                width="50"
                height="60"
                viewBox="0 0 50 60"
                fill="none"
                style={{ animation: "leananim 4.2s linear infinite", transformOrigin: "center bottom", color: "var(--ge-stroke)" }}
              >
                <circle cx="25" cy="7" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
                <line x1="25" y1="13" x2="25" y2="34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="25" y1="19" x2="12" y2="27" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="25" y1="19" x2="38" y2="25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="25" y1="34" x2="16" y2="50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="25" y1="34" x2="32" y2="50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="16" y1="50" x2="14" y2="58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="32" y1="50" x2="34" y2="58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 500,
                color: "var(--ge-accent)",
                fontFamily: "monospace",
                letterSpacing: ".05em",
              }}
            >
              {t("bailDetected")}
            </div>
            <div style={{ fontSize: 14, color: "var(--ge-dim)", fontFamily: "monospace" }}>
              {t("gettingBackUp")}
            </div>
          </div>

          <div style={{ width: 200, height: 3, background: "var(--ge-track)", borderRadius: 2, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                background: "var(--ge-accent)",
                borderRadius: 2,
                animation: "load 4.2s linear infinite",
              }}
            />
          </div>

          <button
            onClick={reset}
            style={{
              padding: "8px 20px",
              background: "transparent",
              border: "1px solid var(--ge-accent)",
              color: "var(--ge-accent)",
              fontFamily: "monospace",
              fontSize: 14,
              cursor: "pointer",
              borderRadius: 4,
            }}
          >
            {t("tryAgain")}
          </button>
        </div>
      </body>
    </html>
  );
}
