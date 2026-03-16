
/**
 * Video upload utilities
 * For handling client-side video uploads and validation
 */

import { APP_CONFIG } from "@/config/app.config";

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
// Threshold above which we upload directly to Pinata (bypassing Vercel's ~4.5MB payload limit)
const DIRECT_UPLOAD_THRESHOLD = 4 * 1024 * 1024; // 4MB

/**
 * Get a temporary signed JWT for direct client-to-Pinata uploads
 */
async function getSignedJwt(): Promise<string> {
  const res = await fetch('/api/pinata/signed-url');
  if (!res.ok) throw new Error('Failed to get upload credentials');
  const data = await res.json();
  if (!data.jwt) throw new Error('No JWT returned');
  return data.jwt;
}

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
      browserInfo: enhancedOptions.browserInfo || 'unknown',
      viewport: enhancedOptions.viewport || `${window.screen.width}x${window.screen.height}`,
      connectionType: enhancedOptions.connectionType || 'unknown'
    } : getDetailedDeviceInfo();

    console.log('📤 IPFS upload started:', file.name, `(${(file.size / 1024 / 1024).toFixed(1)}MB)`);

    const useDirectUpload = file.size > DIRECT_UPLOAD_THRESHOLD;

    if (useDirectUpload) {
      console.log('📡 Using direct-to-Pinata upload (file > 4MB, bypassing Vercel limit)');
    }

    // Build FormData for Pinata
    const formData = new FormData();
    formData.append('file', file);

    if (useDirectUpload) {
      // Direct upload: add Pinata metadata inline
      const pinataMetadata = JSON.stringify({
        name: file.name,
        keyvalues: {
          creator: username,
          fileType: file.type,
          uploadDate: new Date().toISOString(),
          platform: deviceData.platform,
          deviceInfo: deviceData.deviceInfo,
        }
      });
      formData.append('pinataMetadata', pinataMetadata);
      formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));
    } else {
      // Proxy upload: add tracking fields for /api/pinata
      formData.append('creator', username);
      formData.append('platform', deviceData.platform);
      formData.append('deviceInfo', deviceData.deviceInfo);
      formData.append('browserInfo', deviceData.browserInfo);
      formData.append('viewport', deviceData.viewport);
      if (enhancedOptions?.userHP !== undefined) {
        formData.append('userHP', enhancedOptions.userHP.toString());
      }
      if (deviceData.connectionType !== 'unknown') {
        formData.append('connectionType', deviceData.connectionType);
      }
      formData.append('correlationId', `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    }

    // Get signed JWT for direct uploads
    let jwt: string | null = null;
    if (useDirectUpload) {
      jwt = await getSignedJwt();
    }

    const endpoint = useDirectUpload
      ? 'https://api.pinata.cloud/pinning/pinFileToIPFS'
      : '/api/pinata';

    // Use XHR for progress support
    const result = await new Promise<{ IpfsHash: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            onProgress(progress);
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const parsed = JSON.parse(xhr.responseText);
            resolve(parsed);
          } catch {
            reject(new Error('Invalid response from server'));
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status} - ${xhr.responseText?.substring(0, 200)}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error(`Network error: ${xhr.statusText || 'Unknown error'}`));
      });

      xhr.addEventListener('timeout', () => {
        reject(new Error('Upload timeout'));
      });

      xhr.timeout = 480000; // 8 minutes

      xhr.open('POST', endpoint);
      if (jwt) {
        xhr.setRequestHeader('Authorization', `Bearer ${jwt}`);
      }
      xhr.send(formData);
    });

    if (!result.IpfsHash) {
      throw new Error('No IPFS hash returned');
    }

    console.log('✅ IPFS upload successful:', result.IpfsHash);

    const ipfsUrl = `https://${APP_CONFIG.IPFS_GATEWAY}/ipfs/${result.IpfsHash}`;

    return {
      success: true,
      url: ipfsUrl,
      hash: result.IpfsHash
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
