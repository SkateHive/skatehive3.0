"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    error?.name === "ChunkLoadError" ||
    error?.message?.includes("Loading chunk") ||
    error?.message?.includes("Failed to fetch dynamically imported module");

  useEffect(() => {
    if (isChunkError) {
      window.location.reload();
    }
  }, [isChunkError]);

  if (isChunkError) {
    return (
      <html>
        <body
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            fontFamily: "sans-serif",
            gap: "16px",
          }}
        >
          <p>Updating to the latest version...</p>
        </body>
      </html>
    );
  }

  return (
    <html>
      <body
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily: "sans-serif",
          gap: "16px",
        }}
      >
        <h2>Something went wrong</h2>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}