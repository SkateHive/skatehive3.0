/**
 * Clean video processing service - Step 2
 * 
 * Uses centralized API proxy for intelligent server routing and health checks.
 * The API handles server failover automatically.
 */

import { APP_CONFIG } from "@/config/app.config";

export interface ProcessingResult {
  success: boolean;
  url?: string;
  hash?: string;
  error?: string;
  /** Which server(s) failed: 'oracle' | 'macmini' | 'pi' | 'all' */
  failedServer?: 'oracle' | 'macmini' | 'pi' | 'all';
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Error type: 'connection' | 'timeout' | 'server_error' | 'upload_rejected' | 'file_too_large' | 'unknown' */
  errorType?: 'connection' | 'timeout' | 'server_error' | 'upload_rejected' | 'file_too_large' | 'unknown';
}

/** Server type identifiers */
export type ServerKey = 'macmini' | 'oracle' | 'pi';

/** Server configuration - SINGLE SOURCE OF TRUTH for server order */
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
 * Process non-MP4 video via API proxy
 * The API handles server selection and failover automatically
 */
export async function processVideoOnServer(
  file: File,
  username: string = 'anonymous',
  enhancedOptions?: EnhancedProcessingOptions
): Promise<ProcessingResult> {
  // Use centralized API proxy instead of direct server access
  const API_TRANSCODE_URL = 'https://api.skatehive.app/api/transcode';
  
  console.log('🎬 Using API proxy for video processing...');
  
  // Notify that we're attempting primary server (API decides which one internally)
  enhancedOptions?.onServerAttempt?.('macmini', 'API Proxy', 'PRIMARY');

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

    // Generate correlation ID for tracking
    const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
    formData.append('correlationId', requestId);

    // Progress tracking via periodic polling
    if (enhancedOptions?.onProgress) {
      // Initial progress
      enhancedOptions.onProgress(5, 'uploading');
      
      // Simulate progress (API doesn't expose SSE yet)
      const progressInterval = setInterval(() => {
        const randomProgress = Math.floor(Math.random() * 20) + 40; // 40-60%
        enhancedOptions.onProgress?.(randomProgress, 'transcoding');
      }, 2000);

      // Clean up on completion
      setTimeout(() => clearInterval(progressInterval), 60000);
    }

    // Create abort controller with timeout
    const controller = new AbortController();
    const fileSizeMB = file.size / (1024 * 1024);
    // Dynamic timeout: 30s base + 10s per MB (max 5 minutes for API proxy)
    const timeout = Math.min(30000 + (fileSizeMB * 10000), 300000);
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      const response = await fetch(API_TRANSCODE_URL, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }

        let errorType: ProcessingResult['errorType'] = 'server_error';
        if (response.status === 403) {
          errorType = 'upload_rejected';
        } else if (response.status === 413) {
          errorType = 'file_too_large';
        } else if (response.status === 503) {
          errorType = 'connection'; // All servers down
        } else if (response.status >= 500) {
          errorType = 'server_error';
        }

        // Notify failure
        enhancedOptions?.onServerFailed?.('macmini', errorData.message || errorData.error);

        return {
          success: false,
          error: errorData.message || errorData.error || `API responded with ${response.status}`,
          statusCode: response.status,
          errorType,
          failedServer: 'all'
        };
      }

      const result = await response.json();

      if (!result.cid && !result.gatewayUrl && !result.ipfsUrl) {
        return {
          success: false,
          error: result.error || 'API processing failed - no valid URL returned',
          errorType: 'server_error',
          failedServer: 'all'
        };
      }

      const hash = result.cid;
      const skateHiveUrl = `https://${APP_CONFIG.IPFS_GATEWAY}/ipfs/${hash}`;

      // Final progress update
      enhancedOptions?.onProgress?.(100, 'complete');

      console.log('✅ Video processed successfully via API proxy');

      return {
        success: true,
        url: skateHiveUrl,
        hash
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        enhancedOptions?.onServerFailed?.('macmini', 'Request timed out');
        return {
          success: false,
          error: 'API request timed out',
          errorType: 'timeout',
          failedServer: 'all'
        };
      }

      throw error;
    }
  } catch (error) {
    // Handle connection errors
    if (error instanceof Error) {
      const isConnectionError = error.message.includes('Failed to fetch') ||
        error.message.includes('NetworkError') ||
        error.message.includes('net::ERR');
      
      const errorType = isConnectionError ? 'connection' : 'unknown';
      const errorMessage = isConnectionError 
        ? 'Cannot reach API server. Check your internet connection.'
        : error.message;

      enhancedOptions?.onServerFailed?.('macmini', errorMessage);

      return {
        success: false,
        error: errorMessage,
        errorType,
        failedServer: 'all'
      };
    }

    enhancedOptions?.onServerFailed?.('macmini', 'Unknown error');

    return {
      success: false,
      error: 'Video processing failed',
      errorType: 'unknown',
      failedServer: 'all'
    };
  }
}
