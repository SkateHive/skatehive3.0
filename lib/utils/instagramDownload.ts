/**
 * Instagram media download utility
 */

export interface InstagramDownloadResult {
  success: boolean;
  cid?: string;
  url?: string;
  filename?: string;
  bytes?: number;
  error?: string;
}

/**
 * Download Instagram media and get IPFS URL
 */
export async function downloadInstagramMedia(instagramUrl: string): Promise<InstagramDownloadResult> {
  try {
    // Validate Instagram URL format - supports posts and reels with or without usernames
    const instagramRegex =
      /^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(p\/[A-Za-z0-9_-]+|([A-Za-z0-9_.]+\/)?(reel|tv)\/[A-Za-z0-9_-]+)\/?(\?.*)?$/;
    if (!instagramRegex.test(instagramUrl)) {
      throw new Error('Invalid Instagram URL format');
    }

    const response = await fetch('/api/instagram-download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: instagramUrl }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Download failed');
    }

    const result = await response.json();

    if (!result.success || !result.cid) {
      throw new Error('Download failed - no media found');
    }

    return result;
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unknown error occurred');
  }
}

/**
 * Validate Instagram URL format
 */
export function isValidInstagramUrl(url: string): boolean {
  const instagramRegex =
    /^https?:\/\/(www\.)?instagram\.com\/(p\/[A-Za-z0-9_-]+|([A-Za-z0-9_.]+\/)?(reel|tv)\/[A-Za-z0-9_-]+)\/?/;
  return instagramRegex.test(url);
}

/**
 * Determine if the downloaded file is likely a video based on filename
 */
export function isVideoFile(filename: string): boolean {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];
  return videoExtensions.some(ext => filename.toLowerCase().includes(ext));
}
