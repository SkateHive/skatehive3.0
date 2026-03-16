
/**
 * Video upload utilities
 * For handling client-side video uploads and validation
 */

import { APP_CONFIG } from "@/config/app.config";
import { uploadToIpfsSmart } from "./ipfsUpload";

export interface UploadResult {
  success: boolean;
  url?: string;
  hash?: string;
  error?: string;
}

/**
 * Check if file is MP4
 */
export function isMP4(file: File): boolean {
  return file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');
}

/**
 * Validate video file
 */
export function validateVideo(file: File): { valid: boolean; error?: string } {
  if (!file.type.startsWith('video/')) {

    return { valid: false, error: 'File must be a video' };
  }

  // Basic size check (150MB limit for now)
  const maxSize = 150 * 1024 * 1024;
  if (file.size > maxSize) {
    // Log size restriction error
    return { valid: false, error: 'File too large (max 150MB)' };
  }

  // Warn about large files that may process slowly
  const slowProcessingSize = 20 * 1024 * 1024; // 20MB
  if (file.size > slowProcessingSize) {
    console.warn(`⚠️ Large video file (${(file.size / 1024 / 1024).toFixed(1)}MB) - processing may take 2-3 minutes`);
  }

  return { valid: true };
}

/**
 * Enhanced upload options interface
 */
export interface EnhancedUploadOptions {
  userHP?: number;
  platform?: string;
  deviceInfo?: string;
  browserInfo?: string;
  viewport?: string;
  connectionType?: string;
}

/**
 * Get detailed device information for better logging
 */
export function getDetailedDeviceInfo(): {
  platform: string;
  deviceInfo: string;
  browserInfo: string;
  viewport: string;
  connectionType: string;
} {
  const ua = navigator.userAgent;
  const platform = navigator.platform;

  // Detect device type
  let deviceType = 'desktop';
  if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    deviceType = 'mobile';
    if (/iPad/i.test(ua)) deviceType = 'tablet';
  }

  // Detect OS
  let os = 'unknown';
  if (/Mac/i.test(platform)) os = 'macOS';
  else if (/Win/i.test(platform)) os = 'Windows';
  else if (/Linux/i.test(platform)) os = 'Linux';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';

  // Detect browser
  let browser = 'unknown';
  if (/Chrome/i.test(ua) && !/Edge|Edg/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Edge|Edg/i.test(ua)) browser = 'Edge';

  return {
    platform: deviceType,
    deviceInfo: `${deviceType}/${os}/${browser}`,
    browserInfo: `${browser} on ${os}`,
    viewport: `${window.screen.width}x${window.screen.height}`,
    connectionType: (navigator as any).connection?.effectiveType || 'unknown'
  };
}

/**
 * Upload video directly to IPFS (for MP4 files)
 */
export async function uploadToIPFS(
  file: File,
  username: string = 'anonymous',
  enhancedOptions?: EnhancedUploadOptions,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  try {
    const deviceData = enhancedOptions ? {
      platform: enhancedOptions.platform || 'web',
      deviceInfo: enhancedOptions.deviceInfo || 'unknown',
    } : getDetailedDeviceInfo();

    const result = await uploadToIpfsSmart(file, {
      fileName: file.name,
      creator: username,
      onProgress,
      metadata: {
        platform: deviceData.platform,
        deviceInfo: deviceData.deviceInfo,
      },
    });

    return {
      success: true,
      url: result.url,
      hash: result.IpfsHash,
    };
  } catch (error) {
    console.error('❌ IPFS upload failed:', {
      creator: username,
      error: error instanceof Error ? error.message : 'Upload failed'
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
}
