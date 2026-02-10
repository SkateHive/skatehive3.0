"use client";

import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
} from "react";

import {
  isMP4,
  validateVideo,
  uploadToIPFS,
  EnhancedUploadOptions,
} from "@/lib/utils/videoUpload";
import {
  processVideoOnServer,
  EnhancedProcessingOptions,
  ProcessingResult,
  SERVER_CONFIG,
  ServerKey,
} from "@/lib/utils/videoProcessing";
import { handleVideoUpload } from "@/lib/utils/videoUploadUtils";
import { useHiveUser } from "@/contexts/UserContext";
import useHivePower from "@/hooks/useHivePower";
import {
  VideoUploadTerminal,
  useUploadTerminal,
  TerminalLine,
} from "./VideoUploadTerminal";
import type { TrimmedVideoFile } from "./VideoTrimModal";
import { useTranslations } from "@/lib/i18n/hooks";

// Enable debug mode via localStorage or environment
const DEBUG_MODE = typeof window !== 'undefined' && (
  localStorage.getItem('SKATEHIVE_DEBUG') === 'true' ||
  process.env.NODE_ENV === 'development'
);

/**
 * Error details for debugging and display
 */
interface ErrorDetails {
  errorType?: ProcessingResult['errorType'] | 'ipfs_upload' | 'validation';
  statusCode?: number;
  failedServer?: ProcessingResult['failedServer'] | 'pinata';
  rawError: string;
  uploadType: 'mp4_direct' | 'transcoding';
  fileInfo: {
    name: string;
    size: string;
    type: string;
  };
}

// Roast count configuration for random selection
const ROAST_COUNTS: Record<string, number> = {
  oracle: 3, macmini: 3, pi: 3, pinata: 3, all: 8
};

/**
 * Pick a random translated roast for the failed server
 */
function getRandomRoast(t: (key: string) => string, server: string): string {
  const count = ROAST_COUNTS[server] || ROAST_COUNTS.all;
  const index = Math.floor(Math.random() * count) + 1;
  return t(`roasts.${server}${index}`);
}

/**
 * Generate funny, informative error messages based on the failure type
 */
function generateFunnyErrorMessage(errorDetails: ErrorDetails, t: (key: string) => string): string {
  const { errorType, statusCode, failedServer, rawError, uploadType, fileInfo } = errorDetails;

  // Get status code explanation
  const getStatusExplanation = (code?: number): string => {
    if (!code) return "";
    const statusMap: Record<number, string> = {
      400: t('status.s400'),
      403: t('status.s403'),
      404: t('status.s404'),
      413: t('status.s413'),
      500: t('status.s500'),
      502: t('status.s502'),
      503: t('status.s503'),
      504: t('status.s504'),
    };
    return statusMap[code] || `HTTP ${code}`;
  };

  // Error type explanations with actionable advice
  const getActionableAdvice = (): string => {
    if (uploadType === 'mp4_direct') {
      if (statusCode === 500) return `💡 ${t('advice.mp4Direct500')}`;
      if (statusCode === 413) return `💡 ${t('advice.mp4Direct413')}`;
      return `💡 ${t('advice.mp4DirectDefault')}`;
    }

    if (statusCode === 403) return `💡 ${t('advice.transcoding403')}`;
    if (statusCode === 413 || errorType === 'file_too_large') return `💡 ${t('advice.transcodingFileTooLarge')}`;
    if (errorType === 'timeout') return `💡 ${t('advice.transcodingTimeout')}`;
    if (errorType === 'connection' || rawError.includes('Failed to fetch')) return `💡 ${t('advice.transcodingConnection')}`;
    if (errorType === 'server_error' || (statusCode && statusCode >= 500)) return `💡 ${t('advice.transcodingServerError')}`;
    return `💡 ${t('advice.transcodingDefault')}`;
  };

  // Build server chain status dynamically from SERVER_CONFIG
  const getServerChainStatus = (): string => {
    if (uploadType === 'mp4_direct') {
      return `📌 ${t('message.serverChainDirect')} → ❌`;
    }

    // Build chain display from SERVER_CONFIG
    const chainParts = SERVER_CONFIG.map(s => `${s.emoji} ${s.name} → ❌`);
    const fullChain = chainParts.join(' | ');

    if (failedServer === 'all') {
      return fullChain;
    }

    // Find which server failed and show chain up to that point
    const failedIndex = SERVER_CONFIG.findIndex(s => s.key === failedServer);
    if (failedIndex >= 0) {
      const partialChain = chainParts.slice(0, failedIndex + 1).join(' | ');
      const remaining = SERVER_CONFIG.slice(failedIndex + 1).map(s => s.name).join(' & ');
      if (remaining) {
        return `${partialChain} ${t('message.stoppedHere').replace('{remaining}', remaining)}`;
      }
      return partialChain;
    }

    return `Upload type: ${uploadType}, Server: ${failedServer || 'unknown'}`;
  };

  // Build the final message with all the details
  const serverRoast = getRandomRoast(t, failedServer || 'all');
  const serverChain = getServerChainStatus();
  const statusExplanation = statusCode ? getStatusExplanation(statusCode) : null;
  const advice = getActionableAdvice();

  let message = serverRoast;
  message += `\n\n📡 ${t('message.serversTried')}\n${serverChain}`;

  if (statusCode) {
    message += `\n\n❌ ${t('message.error').replace('{detail}', statusExplanation || '')}`;
  } else if (errorType) {
    message += `\n\n❌ ${t('message.errorType').replace('{type}', errorType)}`;
  }

  message += `\n📁 ${t('message.file').replace('{name}', fileInfo.name).replace('{size}', fileInfo.size).replace('{type}', fileInfo.type)}`;

  if (rawError && !rawError.includes('Server processing failed')) {
    const shortError = rawError.length > 80 ? rawError.substring(0, 80) + '...' : rawError;
    message += `\n📝 ${t('message.details').replace('{detail}', shortError)}`;
  }

  message += `\n\n${advice}`;

  return message;
}

/**
 * Extract status code from error message like "Upload failed: 500"
 */
function extractStatusCode(errorMessage: string): number | undefined {
  const match = errorMessage.match(/(\d{3})/);
  return match ? parseInt(match[1], 10) : undefined;
}

export interface VideoUploaderProps {
  onUpload: (result: { url?: string; hash?: string } | null) => void;
  username?: string;
  onUploadStart?: () => void;
  onUploadFinish?: () => void;
  onError?: (error: string) => void;
  /** Render prop for terminal - allows parent to position it */
  renderTerminal?: (terminal: React.ReactNode) => React.ReactNode;
}

export interface VideoUploaderRef {
  trigger: () => void;
  handleFile: (file: File | TrimmedVideoFile) => void;
}

const VideoUploader = forwardRef<VideoUploaderRef, VideoUploaderProps>(
  (
    {
      onUpload,
      username = "anonymous",
      onUploadStart,
      onUploadFinish,
      onError,
      renderTerminal,
    },
    ref
  ) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentFile, setCurrentFile] = useState<File | null>(null);

    // Terminal state for showing upload progress
    const terminal = useUploadTerminal();

    // Translations for user-facing strings
    const t = useTranslations('videoUploader');

    // Get user context for enhanced logging
    const { hiveUser } = useHiveUser();
    const { hivePower } = useHivePower(username);

    // Helper to format file size
    const formatFileSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Enhanced device detection function
    const getDetailedDeviceInfo = () => {
      const ua = navigator.userAgent;
      const platform = navigator.platform;

      // Detect device type
      let deviceType = "desktop";
      if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
        deviceType = "mobile";
        if (/iPad/i.test(ua)) deviceType = "tablet";
      }

      // Detect OS
      let os = "unknown";
      if (/Mac/i.test(platform)) os = "macOS";
      else if (/Win/i.test(platform)) os = "Windows";
      else if (/Linux/i.test(platform)) os = "Linux";
      else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
      else if (/Android/i.test(ua)) os = "Android";

      // Detect browser
      let browser = "unknown";
      if (/Chrome/i.test(ua) && !/Edge|Edg/i.test(ua)) browser = "Chrome";
      else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
      else if (/Firefox/i.test(ua)) browser = "Firefox";
      else if (/Edge|Edg/i.test(ua)) browser = "Edge";

      return {
        platform: deviceType,
        deviceInfo: `${deviceType}/${os}/${browser}`,
        browserInfo: `${browser} on ${os}`,
        viewport: `${window.screen.width}x${window.screen.height}`,
        connectionType:
          (navigator as any).connection?.effectiveType || "unknown",
      };
    };

    const processFile = async (input: File | TrimmedVideoFile) => {
      if (isProcessing) return;

      // Unwrap TrimmedVideoFile wrapper
      const isTrimmed = "fromTrimModal" in input && input.fromTrimModal === true;
      const file = isTrimmed ? (input as TrimmedVideoFile).file : (input as File);
      const existingThumbnail = isTrimmed ? (input as TrimmedVideoFile).thumbnailUrl : null;

      setIsProcessing(true);
      setCurrentFile(file);
      onUploadStart?.();

      // Initialize terminal
      terminal.clear();
      terminal.show();
      terminal.addLine(t('terminal.startingUpload').replace('{name}', file.name), "info");
      terminal.addLine(t('terminal.fileInfo').replace('{size}', formatFileSize(file.size)).replace('{type}', file.type), "info");

      // Track error details for better messaging
      let errorDetails: ErrorDetails | null = null;

      try {
        // 1. Validate file
        terminal.addLine(t('terminal.validating'), "info");
        const validation = validateVideo(file);
        if (!validation.valid) {
          errorDetails = {
            errorType: 'validation',
            rawError: validation.error || 'Validation failed',
            uploadType: 'mp4_direct',
            fileInfo: { name: file.name, size: formatFileSize(file.size), type: file.type }
          };
          throw new Error(validation.error);
        }
        terminal.addLine(`✓ ${t('terminal.validated')}`, "success");

        // 2. Prepare enhanced options with device and user information
        const deviceData = getDetailedDeviceInfo();

        const enhancedOptions: EnhancedUploadOptions = {
          userHP: hivePower || 0,
          platform: deviceData.platform,
          viewport: deviceData.viewport,
          deviceInfo: deviceData.deviceInfo,
          browserInfo: deviceData.browserInfo,
          connectionType: deviceData.connectionType,
        };

        // 3. Handle MP4 files or already-processed trim modal files - direct upload
        if (isMP4(file) || isTrimmed) {
          const reason = isTrimmed && !isMP4(file)
            ? t('terminal.trimmedDetected')
            : t('terminal.mp4Detected');
          terminal.addLine(reason, "info");
          terminal.addLine(t('terminal.uploadingPinata'), "server", "pinata" as any, "trying");

          // For MP4 files, use direct IPFS upload with thumbnail support
          try {
            if (existingThumbnail) {
              // Use handleVideoUpload if we have a thumbnail to preserve
              const result = await handleVideoUpload(
                file,
                username,
                existingThumbnail,
                (progress) => terminal.updateProgress(progress, 'uploading'), // Real progress callback
                hivePower || 0,
                {
                  platform: deviceData.platform,
                  deviceInfo: deviceData.deviceInfo,
                  browserInfo: deviceData.browserInfo,
                  viewport: deviceData.viewport,
                  connectionType: deviceData.connectionType,
                }
              );

              if (result.success && result.url) {
                terminal.updateProgress(100); // Upload complete!
                terminal.addLine(`✓ ${t('terminal.ipfsSuccess')}`, "success");
                terminal.addLine(t('terminal.cidLabel').replace('{cid}', result.IpfsHash || 'unknown'), "info");
                terminal.addLine(`🎉 ${t('terminal.videoReady')}`, "success");

                onUpload({
                  url: result.url,
                  hash: result.IpfsHash,
                });
                return;
              } else {
                throw new Error(result.error || "Upload failed");
              }
            } else {
              // Use original uploadToIPFS for MP4 files without thumbnails
              const uploadResult = await uploadToIPFS(
                file,
                username,
                enhancedOptions,
                (progress) => terminal.updateProgress(progress, 'uploading') // Real progress!
              );

              if (uploadResult.success && uploadResult.url) {
                terminal.updateProgress(100, 'complete'); // Upload complete!
                terminal.addLine(`✓ ${t('terminal.ipfsSuccess')}`, "success");
                terminal.addLine(t('terminal.cidLabel').replace('{cid}', uploadResult.hash || 'unknown'), "info");
                terminal.addLine(`🎉 ${t('terminal.videoReady')}`, "success");

                onUpload({
                  url: uploadResult.url,
                  hash: uploadResult.hash,
                });
                return;
              } else {
                throw new Error(uploadResult.error || "Upload failed");
              }
            }
          } catch (uploadError) {
            const errorMsg = uploadError instanceof Error ? uploadError.message : String(uploadError);
            terminal.addLine(`✗ ${t('terminal.pinataFailed').replace('{error}', errorMsg)}`, "error");

            errorDetails = {
              errorType: 'ipfs_upload',
              statusCode: extractStatusCode(errorMsg),
              failedServer: 'pinata',
              rawError: errorMsg,
              uploadType: 'mp4_direct',
              fileInfo: { name: file.name, size: formatFileSize(file.size), type: file.type }
            };
            throw uploadError;
          }
        }

        // 5. Non-MP4 files - process on server with enhanced options
        terminal.addLine(t('terminal.nonMp4').replace('{type}', file.type), "info");
        terminal.addLine(t('terminal.startingFallback'), "info");

        terminal.updateProgress(5, 'receiving');

        const processingOptions: EnhancedProcessingOptions = {
          userHP: enhancedOptions.userHP,
          platform: enhancedOptions.platform,
          viewport: enhancedOptions.viewport,
          deviceInfo: enhancedOptions.deviceInfo,
          browserInfo: enhancedOptions.browserInfo,
          connectionType: enhancedOptions.connectionType,
          // Real-time progress from SSE!
          onProgress: (progress, stage) => {
            terminal.updateProgress(progress, stage);
          },
          // Dynamic server attempt notifications
          onServerAttempt: (serverKey, serverName, priority) => {
            const serverConfig = SERVER_CONFIG.find(s => s.key === serverKey);
            const emoji = serverConfig?.emoji || '🔄';
            terminal.addLine(t('terminal.tryingServer').replace('{emoji}', emoji).replace('{name}', serverName).replace('{priority}', priority), "server", serverKey, "trying");
          },
          // Dynamic server failure notifications  
          onServerFailed: (serverKey) => {
            const serverConfig = SERVER_CONFIG.find(s => s.key === serverKey);
            const name = serverConfig?.name || serverKey;
            terminal.addLine(`✗ ${t('terminal.serverFailed').replace('{name}', name)}`, "error", serverKey, "failed");
          }
        };

        // For non-MP4 files, use server processing with streaming progress
        const result = await processVideoOnServer(
          file,
          username,
          processingOptions
        );

        if (result.success && result.url) {
          terminal.updateProgress(100, 'complete'); // Complete!
          // Determine which server succeeded
          terminal.addLine(`✓ ${t('terminal.transcodingSuccess')}`, "success");
          terminal.addLine(t('terminal.ipfsCid').replace('{hash}', result.hash || ''), "info");
          terminal.addLine(`🎉 ${t('terminal.videoReady')}`, "success");

          onUpload({
            url: result.url,
            hash: result.hash,
          });
        } else {
          // Server failures are already logged via onServerAttempt/onServerFailed callbacks
          // Create error details for the message
          errorDetails = {
            errorType: result.errorType,
            statusCode: result.statusCode,
            failedServer: result.failedServer,
            rawError: result.error || 'Server processing failed',
            uploadType: 'transcoding',
            fileInfo: { name: file.name, size: formatFileSize(file.size), type: file.type }
          };

          throw new Error(result.error || "Server processing failed");
        }
      } catch (error) {
        // Build error details if not already set
        if (!errorDetails) {
          const rawMessage = error instanceof Error ? error.message : String(error);
          const processingError = error as Error & Partial<ProcessingResult>;
          errorDetails = {
            errorType: processingError.errorType || 'unknown',
            statusCode: processingError.statusCode || extractStatusCode(rawMessage),
            failedServer: processingError.failedServer,
            rawError: rawMessage,
            uploadType: isMP4(currentFile!) ? 'mp4_direct' : 'transcoding',
            fileInfo: {
              name: currentFile?.name || 'unknown',
              size: currentFile ? formatFileSize(currentFile.size) : 'unknown',
              type: currentFile?.type || 'unknown'
            }
          };
        }

        terminal.addLine(`❌ ${t('terminal.uploadFailed').replace('{error}', errorDetails.rawError)}`, "error");

        // Generate user-friendly message with funny roast
        const userMessage = generateFunnyErrorMessage(errorDetails, t);
        terminal.addLine("", "info"); // Empty line for spacing
        terminal.addLine(userMessage, "error");

        // Set error details for debug panel
        terminal.setError({
          errorType: errorDetails.errorType,
          statusCode: errorDetails.statusCode,
          failedServer: errorDetails.failedServer,
          rawError: errorDetails.rawError
        });

        onError?.(userMessage);
        onUpload(null);
      } finally {
        setIsProcessing(false);
        setCurrentFile(null);
        onUploadFinish?.();
      }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        processFile(file);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };

    const triggerFileSelect = () => {
      if (!isProcessing && fileInputRef.current) {
        fileInputRef.current.click();
      }
    };

    useImperativeHandle(ref, () => ({
      trigger: triggerFileSelect,
      handleFile: processFile,
    }));

    const terminalComponent = (
      <VideoUploadTerminal
        lines={terminal.lines}
        isVisible={terminal.isVisible}
        onClose={() => terminal.hide()}
        debugMode={DEBUG_MODE}
        progress={terminal.progress}
        stage={terminal.stage}
        errorDetails={terminal.errorDetails}
      />
    );

    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        {/* Terminal - either use renderTerminal prop or render inline */}
        {renderTerminal ? renderTerminal(terminalComponent) : terminalComponent}
      </>
    );
  }
);

VideoUploader.displayName = "VideoUploader";

// Export the demo panel for testing
export { ErrorDemoPanel } from "./ErrorDemoPanel";

export default VideoUploader;
