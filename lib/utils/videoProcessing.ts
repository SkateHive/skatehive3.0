/**
 * Video processing service — server-side transcoding with multi-server fallback.
 *
 * Architecture note:
 *   Health checks always go through /api/video-proxy (same-origin, avoids CORS).
 *   Uploads for Tailscale hosts (Mac Mini, Pi) also go through the proxy because
 *   the browser may not be able to reach *.tail83ea3e.ts.net directly from all
 *   networks — the proxy path ensures the transfer goes browser → Vercel → host
 *   instead of browser → host, eliminating the false-positive-health / real-upload-fail
 *   race condition.
 */

import { APP_CONFIG } from "@/config/app.config";

export interface ProcessingResult {
  success: boolean;
  url?: string;
  hash?: string;
  error?: string;
  /** Which server(s) failed */
  failedServer?: "macmini" | "oracle" | "pi" | "all";
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Structured error type for UI routing */
  errorType?:
    | "connection"
    | "timeout"
    | "server_error"
    | "upload_rejected"
    | "file_too_large"
    | "unknown";
}

export type ServerKey = "macmini" | "oracle" | "pi";

export interface ServerConfig {
  key: ServerKey;
  name: string;
  emoji: string;
  priority: string;
  /** Base URL of the transcoding server */
  url: string;
  /**
   * When true, uploads are routed through /api/video-proxy instead of going
   * directly from the browser. Required for Tailscale hosts which are publicly
   * reachable from Vercel but may be blocked or CORS-restricted in some browsers.
   */
  useProxy: boolean;
}

/**
 * Single source of truth for server order and routing.
 * All servers run the same SkateHive video-transcoder codebase.
 */
export const SERVER_CONFIG: ServerConfig[] = [
  {
    key: "oracle",
    name: "Oracle",
    emoji: "🔮",
    priority: "PRIMARY",
    url: "https://transcode.skatehive.app",
    useProxy: false, // Public endpoint — browser can POST directly
  },
  {
    key: "macmini",
    name: "Mac Mini M4",
    emoji: "🍎",
    priority: "SECONDARY",
    url: "https://minivlad.tail83ea3e.ts.net/video",
    useProxy: true, // Tailscale Funnel — route through Vercel to avoid browser CORS/firewall
  },
  {
    key: "pi",
    name: "Raspberry Pi",
    emoji: "🫐",
    priority: "TERTIARY",
    url: "https://vladsberry.tail83ea3e.ts.net/video",
    useProxy: true, // Tailscale Funnel — same reason as Mac Mini
  },
];

export interface EnhancedProcessingOptions {
  userHP?: number;
  platform?: string;
  deviceInfo?: string;
  browserInfo?: string;
  viewport?: string;
  connectionType?: string;
  onProgress?: (progress: number, stage: string) => void;
  onServerAttempt?: (serverKey: ServerKey, serverName: string, priority: string) => void;
  onServerFailed?: (serverKey: ServerKey, error?: string) => void;
}

// ---------------------------------------------------------------------------
// Circuit breaker — sessionStorage-backed, 5-minute TTL per server.
// Prevents retrying a server that just failed within the same session.
// ---------------------------------------------------------------------------

const CIRCUIT_TTL_MS = 5 * 60 * 1000;

function isCircuitOpen(key: ServerKey): boolean {
  try {
    const trippedAt = sessionStorage.getItem(`circuit_${key}`);
    return !!trippedAt && Date.now() - Number(trippedAt) < CIRCUIT_TTL_MS;
  } catch {
    return false;
  }
}

function tripCircuit(key: ServerKey): void {
  try {
    sessionStorage.setItem(`circuit_${key}`, String(Date.now()));
  } catch {
    // sessionStorage unavailable (SSR guard — this module is client-only)
  }
}

function resetCircuit(key: ServerKey): void {
  try {
    sessionStorage.removeItem(`circuit_${key}`);
  } catch {}
}

// ---------------------------------------------------------------------------
// Health check — always via same-origin proxy to avoid CORS from any region
// ---------------------------------------------------------------------------

async function checkServerHealth(serverBaseUrl: string): Promise<boolean> {
  try {
    const healthUrl = `/api/video-proxy?url=${encodeURIComponent(
      `${serverBaseUrl}/healthz`
    )}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(healthUrl, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Orchestrator — loop over SERVER_CONFIG with circuit breaker + rich errors
// ---------------------------------------------------------------------------

export async function processVideoOnServer(
  file: File,
  username: string = "anonymous",
  enhancedOptions?: EnhancedProcessingOptions
): Promise<ProcessingResult> {
  // One correlationId covers the entire multi-server attempt for end-to-end tracing
  const correlationId = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  type FailureRecord = {
    server: ServerConfig;
    error: string;
    errorType: ProcessingResult["errorType"];
  };
  const failures: FailureRecord[] = [];

  for (const server of SERVER_CONFIG) {
    // --- Circuit breaker ---
    if (isCircuitOpen(server.key)) {
      const msg = `${server.name} skipped — circuit open (failed recently)`;
      console.log(`⚡ [${correlationId}] ${msg}`);
      failures.push({ server, error: msg, errorType: "connection" });
      enhancedOptions?.onServerFailed?.(server.key, msg);
      continue;
    }

    // --- Health check ---
    console.log(`🔍 [${correlationId}] Checking ${server.name} health...`);
    const healthy = await checkServerHealth(server.url);

    if (!healthy) {
      const msg = `${server.name} offline (health check failed)`;
      console.log(`❌ [${correlationId}] ${msg}`);
      failures.push({ server, error: msg, errorType: "connection" });
      enhancedOptions?.onServerFailed?.(server.key, msg);
      tripCircuit(server.key);
      continue;
    }

    // --- Upload attempt ---
    const uploadPath = server.useProxy ? "via proxy" : "direct";
    console.log(
      `✅ [${correlationId}] ${server.name} healthy — uploading (${uploadPath})...`
    );
    enhancedOptions?.onServerAttempt?.(server.key, server.name, server.priority);

    const result = await tryServer(
      server,
      file,
      username,
      enhancedOptions,
      correlationId
    );

    if (result.success) {
      resetCircuit(server.key);
      return result;
    }

    const errMsg = result.error ?? `${server.name} failed`;
    console.warn(`⚠️ [${correlationId}] ${server.name} upload failed: ${errMsg}`);
    failures.push({ server, error: errMsg, errorType: result.errorType });
    enhancedOptions?.onServerFailed?.(server.key, errMsg);
    tripCircuit(server.key);
  }

  // --- All servers failed — build rich, non-opaque error ---
  const summary = failures
    .map((f) => `${f.server.key}(${f.errorType ?? "unknown"}): ${f.error}`)
    .join(" | ");

  console.error(`❌ [${correlationId}] All servers failed — ${summary}`);

  // Pick the most informative error type to surface to the UI
  const priority: ProcessingResult["errorType"][] = [
    "server_error",
    "timeout",
    "file_too_large",
    "upload_rejected",
    "connection",
    "unknown",
  ];
  const bestFailure =
    priority.reduce<FailureRecord | undefined>(
      (best, type) => best ?? failures.find((f) => f.errorType === type),
      undefined
    ) ?? failures[failures.length - 1];

  return {
    success: false,
    error: `All servers failed — ${summary}`,
    errorType: bestFailure?.errorType ?? "unknown",
    failedServer: "all",
  };
}

// ---------------------------------------------------------------------------
// Single-server attempt
// ---------------------------------------------------------------------------

async function tryServer(
  server: ServerConfig,
  file: File,
  username: string,
  enhancedOptions: EnhancedProcessingOptions | undefined,
  correlationId: string
): Promise<ProcessingResult> {
  const { key: serverKey, name: serverName, url: serverBaseUrl, useProxy } = server;
  const label = `${serverName} (${server.priority})`;

  // Route Tailscale hosts through the Vercel proxy to avoid browser CORS/firewall.
  // Direct (non-proxied) hosts are reached straight from the browser.
  const transcodeUrl = useProxy
    ? `/api/video-proxy?url=${encodeURIComponent(`${serverBaseUrl}/transcode`)}`
    : `${serverBaseUrl}/transcode`;

  let eventSource: EventSource | null = null;

  try {
    const formData = new FormData();
    formData.append("video", file);
    formData.append("creator", username);
    formData.append("source_app", "webapp");
    formData.append("correlationId", correlationId);

    if (enhancedOptions?.platform) formData.append("platform", enhancedOptions.platform);
    if (enhancedOptions?.userHP !== undefined)
      formData.append("userHP", enhancedOptions.userHP.toString());
    if (enhancedOptions?.deviceInfo) formData.append("deviceInfo", enhancedOptions.deviceInfo);
    if (enhancedOptions?.browserInfo)
      formData.append("browserInfo", enhancedOptions.browserInfo);
    if (enhancedOptions?.viewport) formData.append("viewport", enhancedOptions.viewport);
    if (enhancedOptions?.connectionType)
      formData.append("connectionType", enhancedOptions.connectionType);

    // SSE progress is only possible for direct uploads — proxied servers are not
    // reachable by the browser, so opening an EventSource to them would silently fail.
    if (enhancedOptions?.onProgress && !useProxy) {
      const progressUrl = `${serverBaseUrl}/progress/${correlationId}`;
      try {
        eventSource = new EventSource(progressUrl);
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            enhancedOptions.onProgress?.(data.progress, data.stage);
          } catch {
            // Ignore SSE parse errors
          }
        };
        eventSource.onerror = () => {
          // SSE errors are non-fatal; upload continues without progress
        };
      } catch {
        // EventSource not supported or failed — continue without progress
      }
    }

    const controller = new AbortController();
    const fileSizeMB = file.size / (1024 * 1024);
    // Dynamic timeout: 60 s base + 5 s/MB, capped at 15 minutes
    const timeout = Math.min(60_000 + fileSizeMB * 5_000, 900_000);
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(transcodeUrl, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response
          .text()
          .catch(() => `HTTP ${response.status}`);

        let errorType: ProcessingResult["errorType"] = "server_error";
        if (response.status === 403) errorType = "upload_rejected";
        else if (response.status === 413) errorType = "file_too_large";

        throw {
          message: `${label} responded with ${response.status}: ${errorText}`,
          statusCode: response.status,
          errorType,
          failedServer: serverKey,
        };
      }

      const result = await response.json();

      if (!result.cid && !result.gatewayUrl && !result.ipfsUrl) {
        throw new Error(
          result.error ?? `${label} processing failed — no valid URL returned`
        );
      }

      const hash = result.cid;
      const skateHiveUrl = `https://${APP_CONFIG.IPFS_GATEWAY}/ipfs/${hash}`;
      enhancedOptions?.onProgress?.(100, "complete");

      return { success: true, url: skateHiveUrl, hash };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw {
          message: `${label} timed out after ${Math.round(timeout / 1000)}s`,
          errorType: "timeout" as const,
          failedServer: serverKey,
        };
      }
      throw error;
    }
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      const e = error as {
        message: string;
        statusCode?: number;
        errorType?: ProcessingResult["errorType"];
      };
      return {
        success: false,
        error: e.message,
        statusCode: e.statusCode,
        errorType: e.errorType ?? "unknown",
        failedServer: serverKey,
      };
    }
    if (error instanceof Error) {
      const isConn =
        error.message.includes("Failed to fetch") ||
        error.message.includes("NetworkError") ||
        error.message.includes("net::ERR");
      return {
        success: false,
        error: error.message,
        errorType: isConn ? "connection" : "unknown",
        failedServer: serverKey,
      };
    }
    return {
      success: false,
      error: `${label} failed`,
      errorType: "unknown",
      failedServer: serverKey,
    };
  } finally {
    eventSource?.close();
  }
}
