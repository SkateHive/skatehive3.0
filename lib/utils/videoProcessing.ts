/**
 * Clean video processing service - Step 2
 */

import { APP_CONFIG } from "@/config/app.config";

export interface ProcessingResult {
  success: boolean;
  url?: string;
  hash?: string;
  error?: string;
  /** Which server(s) failed: 'macmini' | 'oracle' | 'pi' | 'all' */
  failedServer?: 'macmini' | 'oracle' | 'pi' | 'all';
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Error type: 'connection' | 'timeout' | 'server_error' | 'upload_rejected' | 'file_too_large' | 'unknown' */
  errorType?: 'connection' | 'timeout' | 'server_error' | 'upload_rejected' | 'file_too_large' | 'unknown';
}

/** Server type identifiers */
export type ServerKey = 'macmini' | 'oracle' | 'pi';

/** Server configuration - SINGLE SOURCE OF TRUTH for server order
 *  All servers run the same SkateHive video-transcoder codebase */
export const SERVER_CONFIG: Array<{ key: ServerKey; name: string; emoji: string; priority: string }> = [
  { key: 'macmini', name: 'Mac Mini M4', emoji: '🍎', priority: 'PRIMARY' },
  { key: 'oracle', name: 'Oracle', emoji: '🔮', priority: 'SECONDARY' },
  { key: 'pi', name: 'Raspberry Pi', emoji: '🫐', priority: 'TERTIARY' },
];

/**
 * Enhanced processing options interface
 */
export interface EnhancedProcessingOptions {
  userHP?: number;
  platform?: string;
  deviceInfo?: string;
  browserInfo?: string;
  viewport?: string;
  connectionType?: string;
  onProgress?: (progress: number, stage: string) => void;
  /** Called when attempting a new server */
  onServerAttempt?: (serverKey: ServerKey, serverName: string, priority: string) => void;
  /** Called when a server fails */
  onServerFailed?: (serverKey: ServerKey, error?: string) => void;
}

/**
 * Quick health check for a server (3 second timeout)
 */
async function checkServerHealth(serverBaseUrl: string): Promise<boolean> {
  try {
    const healthUrl = serverBaseUrl.includes('sslip.io')
      ? `${serverBaseUrl}/healthz`  // Oracle uses /healthz
      : `${serverBaseUrl}/healthz`; // Other servers also use /healthz

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Process non-MP4 video on server - tries servers in order defined by SERVER_CONFIG
 */
export async function processVideoOnServer(
  file: File,
  username: string = 'anonymous',
  enhancedOptions?: EnhancedProcessingOptions
): Promise<ProcessingResult> {
  // PRIMARY: Mac Mini M4
  const primaryServer = SERVER_CONFIG[0];
  const primaryUrl = 'https://minivlad.tail83ea3e.ts.net/video';

  console.log(`🔍 Checking ${primaryServer.name} health...`);
  const isPrimaryHealthy = await checkServerHealth(primaryUrl);

  let primaryResult: ProcessingResult;
  if (isPrimaryHealthy) {
    console.log(`✅ ${primaryServer.name} is healthy, attempting upload...`);
    enhancedOptions?.onServerAttempt?.(primaryServer.key, primaryServer.name, primaryServer.priority);

    primaryResult = await tryServer(
      primaryUrl,
      file,
      username,
      `${primaryServer.name} (${primaryServer.priority})`,
      enhancedOptions
    );

    if (primaryResult.success) {
      return primaryResult;
    }
  } else {
    console.log(`❌ ${primaryServer.name} health check failed, skipping...`);
    primaryResult = {
      success: false,
      error: `${primaryServer.name} is offline (health check failed)`,
      errorType: 'connection',
      failedServer: primaryServer.key
    };
  }

  enhancedOptions?.onServerFailed?.(primaryServer.key, primaryResult.error);

  // SECONDARY: Oracle Cloud
  const secondaryServer = SERVER_CONFIG[1];
  const secondaryUrl = 'https://146-235-239-243.sslip.io';

  console.log(`🔍 Checking ${secondaryServer.name} health...`);
  const isSecondaryHealthy = await checkServerHealth(secondaryUrl);

  let secondaryResult: ProcessingResult;
  if (isSecondaryHealthy) {
    console.log(`✅ ${secondaryServer.name} is healthy, attempting upload...`);
    enhancedOptions?.onServerAttempt?.(secondaryServer.key, secondaryServer.name, secondaryServer.priority);

    secondaryResult = await tryServer(
      secondaryUrl,
      file,
      username,
      `${secondaryServer.name} (${secondaryServer.priority})`,
      enhancedOptions
    );

    if (secondaryResult.success) {
      return secondaryResult;
    }
  } else {
    console.log(`❌ ${secondaryServer.name} health check failed, skipping...`);
    secondaryResult = {
      success: false,
      error: `${secondaryServer.name} is offline (health check failed)`,
      errorType: 'connection',
      failedServer: secondaryServer.key
    };
  }

  enhancedOptions?.onServerFailed?.(secondaryServer.key, secondaryResult.error);

  // TERTIARY: Raspberry Pi (backup)
  const tertiaryServer = SERVER_CONFIG[2];
  const tertiaryUrl = 'https://vladsberry.tail83ea3e.ts.net/video';

  console.log(`🔍 Checking ${tertiaryServer.name} health...`);
  const isTertiaryHealthy = await checkServerHealth(tertiaryUrl);

  let tertiaryResult: ProcessingResult;
  if (isTertiaryHealthy) {
    console.log(`✅ ${tertiaryServer.name} is healthy, attempting upload...`);
    enhancedOptions?.onServerAttempt?.(tertiaryServer.key, tertiaryServer.name, tertiaryServer.priority);

    tertiaryResult = await tryServer(
      tertiaryUrl,
      file,
      username,
      `${tertiaryServer.name} (${tertiaryServer.priority})`,
      enhancedOptions
    );

    if (tertiaryResult.success) {
      return tertiaryResult;
    }
  } else {
    console.log(`❌ ${tertiaryServer.name} health check failed, skipping...`);
    tertiaryResult = {
      success: false,
      error: `${tertiaryServer.name} is offline (health check failed)`,
      errorType: 'connection',
      failedServer: tertiaryServer.key
    };
  }

  enhancedOptions?.onServerFailed?.(tertiaryServer.key, tertiaryResult.error);

  // All servers failed
  const bestError = tertiaryResult.error ? tertiaryResult : (secondaryResult.error ? secondaryResult : primaryResult);
  return {
    ...bestError,
    failedServer: 'all'
  };
}

/**
 * Try processing on a specific server with SSE progress streaming
 */
async function tryServer(
  serverBaseUrl: string,
  file: File,
  username: string,
  serverName: string,
  enhancedOptions?: EnhancedProcessingOptions
): Promise<ProcessingResult> {
  // Extract server identifier from serverName
  const serverKey = serverName.toLowerCase().includes('oracle') ? 'oracle' :
    serverName.toLowerCase().includes('mac') ? 'macmini' : 'pi';

  // Determine endpoint paths based on server
  const transcodeUrl = serverBaseUrl.includes('sslip.io')
    ? `${serverBaseUrl}/transcode`  // Oracle uses /transcode
    : `${serverBaseUrl}/transcode`; // Others use /video/transcode but we changed base URL

  let eventSource: EventSource | null = null;

  try {
    const formData = new FormData();
    formData.append('video', file);
    formData.append('creator', username);

    // SOURCE APP IDENTIFIER - Always send 'webapp' from web application
    formData.append('source_app', 'webapp');

    // Add enhanced tracking information if provided
    if (enhancedOptions?.platform) {
      formData.append('platform', enhancedOptions.platform);
    }
    if (enhancedOptions?.userHP !== undefined) {
      formData.append('userHP', enhancedOptions.userHP.toString());
    }
    if (enhancedOptions?.deviceInfo) {
      formData.append('deviceInfo', enhancedOptions.deviceInfo);
    }
    if (enhancedOptions?.browserInfo) {
      formData.append('browserInfo', enhancedOptions.browserInfo);
    }
    if (enhancedOptions?.viewport) {
      formData.append('viewport', enhancedOptions.viewport);
    }
    if (enhancedOptions?.connectionType) {
      formData.append('connectionType', enhancedOptions.connectionType);
    }

    // Generate correlation ID for tracking AND for SSE progress
    const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
    formData.append('correlationId', requestId);

    // Start SSE listener for progress updates BEFORE sending request
    // All servers now support /progress SSE endpoint
    if (enhancedOptions?.onProgress) {
      const progressUrl = `${serverBaseUrl}/progress/${requestId}`;

      try {
        eventSource = new EventSource(progressUrl);
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            enhancedOptions.onProgress?.(data.progress, data.stage);
          } catch {
            // Ignore parse errors
          }
        };
        eventSource.onerror = () => {
          // SSE errors are non-fatal, continue silently
        };
      } catch {
        // SSE not supported or failed to connect - continue without progress
      }
    }

    // Create abort controller with shorter timeout for faster failover
    const controller = new AbortController();
    const fileSizeMB = file.size / (1024 * 1024);
    // Dynamic timeout: 30s base + 10s per MB (max 3 minutes)
    const timeout = Math.min(30000 + (fileSizeMB * 10000), 180000);
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      const response = await fetch(transcodeUrl, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();

        let errorType: ProcessingResult['errorType'] = 'server_error';
        if (response.status === 403) {
          errorType = 'upload_rejected';
        } else if (response.status === 413) {
          errorType = 'file_too_large';
        } else if (response.status >= 500) {
          errorType = 'server_error';
        }

        throw {
          message: `${serverName} responded with ${response.status}: ${errorText}`,
          statusCode: response.status,
          errorType,
          failedServer: serverKey
        };
      }

      const result = await response.json();

      if (!result.cid && !result.gatewayUrl && !result.ipfsUrl) {
        throw new Error(result.error || `${serverName} processing failed - no valid URL returned`);
      }

      const hash = result.cid;
      const skateHiveUrl = `https://${APP_CONFIG.IPFS_GATEWAY}/ipfs/${hash}`;

      // Final progress update
      enhancedOptions?.onProgress?.(100, 'complete');

      return {
        success: true,
        url: skateHiveUrl,
        hash
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw {
          message: `${serverName} request timed out`,
          errorType: 'timeout' as const,
          failedServer: serverKey
        };
      }

      throw error;
    }
  } catch (error) {
    // Handle custom error objects with extended info
    if (error && typeof error === 'object' && 'message' in error) {
      const customError = error as { message: string; statusCode?: number; errorType?: ProcessingResult['errorType']; failedServer?: string };
      return {
        success: false,
        error: customError.message,
        statusCode: customError.statusCode,
        errorType: customError.errorType || 'unknown',
        failedServer: serverKey
      };
    }

    // Handle connection errors
    if (error instanceof Error) {
      const isConnectionError = error.message.includes('Failed to fetch') ||
        error.message.includes('NetworkError') ||
        error.message.includes('net::ERR');
      return {
        success: false,
        error: error.message,
        errorType: isConnectionError ? 'connection' : 'unknown',
        failedServer: serverKey
      };
    }

    return {
      success: false,
      error: `${serverName} failed`,
      errorType: 'unknown',
      failedServer: serverKey
    };
  } finally {
    // Clean up SSE connection
    if (eventSource) {
      eventSource.close();
    }
  }
}
