/**
 * Video processing service — server-side transcoding with multi-server fallback.
 *
 * Architecture note:
 *   Health checks go through /api/video-proxy (same-origin, avoids CORS).
 *   Uploads must go directly from browser → transcoder host. Do not proxy video
 *   blobs through Vercel/API routes; serverless body limits produce 413
 *   FUNCTION_PAYLOAD_TOO_LARGE for normal phone clips before the transcoder sees them.
 *
 *   Server list and order come from the canonical transcode registry
 *   (config/transcode.config.ts), the single source of truth shared with the
 *   status health check and api.skatehive.app.
 */

import { APP_CONFIG } from "@/config/app.config";
import { TRANSCODE_SERVERS } from "@/config/transcode.config";

export interface ProcessingResult {
  success: boolean;
  url?: string;
  hash?: string;
  error?: string;
  /** Which server(s) failed. 'pi' is retained for the error-demo panel only. */
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

/** Server type identifiers. 'pi' is retained for the error-demo panel only. */
export type ServerKey = "macmini" | "oracle" | "pi";

export interface ServerConfig {
  key: ServerKey;
  name: string;
  emoji: string;
  priority: string;
  /** Base URL of the transcoding server */
  url: string;
  /**
   * Legacy escape hatch for tiny diagnostic calls only. Keep false for uploads:
   * browser → Vercel → transcoder breaks on serverless body limits.
   */
  useProxy: boolean;
}

/** Carries per-server failure info through the orchestrator loop. */
interface FailureRecord {
  server: ServerConfig;
  error: string;
  errorType: ProcessingResult["errorType"];
}

/**
 * Single source of truth for server order and routing — derived from the
 * canonical transcode registry so uploads, the status health check, and the
 * UI all agree on which servers exist and in what order.
 * All servers run the same SkateHive video-transcoder codebase.
 */
export const SERVER_CONFIG: ServerConfig[] = TRANSCODE_SERVERS.map((s) => ({
  key: s.key,
  name: s.name,
  emoji: s.emoji,
  priority: s.label,
  url: s.baseUrl,
  useProxy: s.useProxy,
}));

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
// Custom error — carries HTTP status, errorType and failedServer so the catch
// block can inspect structured fields without throwing plain objects.
// ---------------------------------------------------------------------------

class TranscoderError extends Error {
  statusCode?: number;
  errorType?: ProcessingResult["errorType"];
  failedServer?: ServerKey;

  constructor(
    message: string,
    opts?: {
      statusCode?: number;
      errorType?: ProcessingResult["errorType"];
      failedServer?: ServerKey;
    }
  ) {
    super(message);
    this.name = "TranscoderError";
    this.statusCode = opts?.statusCode;
    this.errorType = opts?.errorType;
    this.failedServer = opts?.failedServer;
  }
}

// ---------------------------------------------------------------------------
// Circuit breaker — sessionStorage-backed, 5-minute TTL per server.
// Prevents retrying a server that just failed within the same session.
// ---------------------------------------------------------------------------

const CIRCUIT_TTL_MS = 5 * 60 * 1000;

function isCircuitOpen(key: ServerKey): boolean {
  try {
    const raw = sessionStorage.getItem(`circuit_${key}`);
    if (!raw) return false;
    const trippedAt = Number(raw);
    if (isNaN(trippedAt)) return false; // corrupted value — treat as closed
    return Date.now() - trippedAt < CIRCUIT_TTL_MS;
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
  } catch (_e) {
    // sessionStorage unavailable — safe to ignore on reset
  }
}

// ---------------------------------------------------------------------------
// Timeout constants for tryServer
// ---------------------------------------------------------------------------

const BASE_TIMEOUT_MS = 60_000;
const PER_MB_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 900_000; // 15 minutes

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

  // If every server's circuit is open, the user can't recover — they'd see
  // "All servers failed" for the full TTL with no way to retry. Treat a
  // fresh upload attempt as a user intent to try again: clear the breakers
  // and re-evaluate via real health checks. If the servers are still down,
  // the per-attempt failures will re-trip the circuits on this run.
  if (SERVER_CONFIG.every((s) => isCircuitOpen(s.key))) {
    console.log(
      `⚡ [${correlationId}] All circuits open — resetting to give the upload a fresh attempt`
    );
    SERVER_CONFIG.forEach((s) => resetCircuit(s.key));
  }

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
  const errorTypePriority: ProcessingResult["errorType"][] = [
    "server_error",
    "timeout",
    "file_too_large",
    "upload_rejected",
    "connection",
    "unknown",
  ];
  const bestFailure =
    errorTypePriority.reduce<FailureRecord | undefined>(
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

  // Upload directly to the transcoder host. Proxying file uploads through Vercel
  // causes 413 FUNCTION_PAYLOAD_TOO_LARGE before Mac Mini/Oracle can process them.
  const transcodeUrl = `${serverBaseUrl}/transcode`;

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
    const timeout = Math.min(
      BASE_TIMEOUT_MS + fileSizeMB * PER_MB_TIMEOUT_MS,
      MAX_TIMEOUT_MS
    );
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

        throw new TranscoderError(
          `${label} responded with ${response.status}: ${errorText}`,
          { statusCode: response.status, errorType, failedServer: serverKey }
        );
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
        throw new TranscoderError(
          `${label} timed out after ${Math.round(timeout / 1000)}s`,
          { errorType: "timeout", failedServer: serverKey }
        );
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof TranscoderError) {
      return {
        success: false,
        error: error.message,
        statusCode: error.statusCode,
        errorType: error.errorType ?? "unknown",
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
