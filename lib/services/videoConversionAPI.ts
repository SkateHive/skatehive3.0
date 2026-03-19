/**
 * Video Conversion API Service
 * Handles video conversion using external APIs with fallback mechanisms
 */

export interface VideoConversionResult {
  success: boolean;
  url?: string;
  error?: string;
  method?: 'primary_api' | 'secondary_api' | 'fallback_api' | 'native';
  duration?: number;
  fileSize?: number;
}

export interface VideoConversionOptions {
  creator?: string;
  thumbnailUrl?: string;
  onProgress?: (progress: number) => void;
  maxRetries?: number;
}

// Primary API configuration - Mac Mini M4 (updated with Pinata Groups + standardized metadata)
const PRIMARY_API_ENDPOINT = "https://minivlad.tail83ea3e.ts.net/video/transcode";

// Secondary API configuration - Oracle (fallback)
const SECONDARY_API_ENDPOINT = "https://146-235-239-243.sslip.io/transcode";

// Fallback API configuration - Raspberry Pi (reliable backup)
const FALLBACK_API_ENDPOINT = "https://vladsberry.tail83ea3e.ts.net/video/transcode";

/**
 * Attempts to upload and convert video using the primary API (Oracle)
 */
async function uploadToPrimaryAPI(
  file: File,
  options: VideoConversionOptions
): Promise<VideoConversionResult> {
  try {
    console.log("� Attempting upload to Oracle API (primary)...");

    const formData = new FormData();
    formData.append("video", file);

    if (options.creator) {
      formData.append("creator", options.creator);
    }

    if (options.thumbnailUrl) {
      formData.append("thumbnailUrl", options.thumbnailUrl);
    }

    const response = await fetch(PRIMARY_API_ENDPOINT, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Oracle API failed: ${response.status} - ${response.statusText}`);
    }

    const result = await response.json();

    console.log("🔍 Mac Mini M4 API Response Debug:");
    console.log("Full result:", JSON.stringify(result, null, 2));
    console.log("result.url:", result.url, typeof result.url);
    console.log("result.gatewayUrl:", result.gatewayUrl, typeof result.gatewayUrl);

    // Mac Mini returns: { cid, gatewayUrl, requestId, duration, creator, sourceApp, timestamp }
    if (result.gatewayUrl || result.url) {
      const videoUrl = result.gatewayUrl || result.url;

      console.log("✅ Mac Mini M4 API upload successful!");
      console.log("Selected videoUrl:", videoUrl, typeof videoUrl);

      return {
        success: true,
        url: videoUrl,
        method: 'primary_api',
        duration: result.duration,
        fileSize: result.fileSize || file.size,
      };
    } else {
      throw new Error("Mac Mini M4 API returned invalid response - no URL found");
    }
  } catch (error) {
    console.error("❌ Mac Mini M4 API failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      method: 'primary_api',
    };
  }
}

/**
 * Attempts to upload and convert video using the secondary API (Mac Mini M4)
 */
async function uploadToSecondaryAPI(
  file: File,
  options: VideoConversionOptions
): Promise<VideoConversionResult> {
  try {
    console.log("🍎 Attempting upload to secondary API (Mac Mini M4)...");

    const formData = new FormData();
    formData.append("video", file);

    if (options.creator) {
      formData.append("creator", options.creator);
    }

    if (options.thumbnailUrl) {
      formData.append("thumbnailUrl", options.thumbnailUrl);
    }

    const response = await fetch(SECONDARY_API_ENDPOINT, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Oracle API failed: ${response.status} - ${response.statusText}`);
    }

    const result = await response.json();

    if (result.url || result.ipfsUrl || result.videoUrl || result.gatewayUrl) {
      const videoUrl = result.gatewayUrl || result.url || result.ipfsUrl || result.videoUrl;

      console.log("✅ Oracle API upload successful!");
      return {
        success: true,
        url: videoUrl,
        method: 'secondary_api',
        duration: result.duration,
        fileSize: result.fileSize || file.size,
      };
    } else {
      throw new Error("Oracle API returned invalid response - no URL found");
    }
  } catch (error) {
    console.error("❌ Oracle API failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      method: 'secondary_api',
    };
  }
}

/**
 * Attempts to upload and convert video using the fallback API (Raspberry Pi)
 */
async function uploadToFallbackAPI(
  file: File,
  options: VideoConversionOptions
): Promise<VideoConversionResult> {
  try {
    console.log("🫐 Attempting upload to fallback API (Raspberry Pi)...");

    const formData = new FormData();
    formData.append("video", file);

    if (options.creator) {
      formData.append("creator", options.creator);
    }

    if (options.thumbnailUrl) {
      formData.append("thumbnailUrl", options.thumbnailUrl);
    }

    const response = await fetch(FALLBACK_API_ENDPOINT, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Raspberry Pi API failed: ${response.status} - ${response.statusText}`);
    }

    const result = await response.json();

    if (result.url || result.ipfsUrl || result.videoUrl) {
      const videoUrl = result.url || result.ipfsUrl || result.videoUrl;

      console.log("✅ Raspberry Pi API upload successful!");
      return {
        success: true,
        url: videoUrl,
        method: 'fallback_api',
        duration: result.duration,
        fileSize: result.fileSize || file.size,
      };
    } else {
      throw new Error("Raspberry Pi API returned invalid response - no URL found");
    }
  } catch (error) {
    console.error("❌ Raspberry Pi API failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      method: 'fallback_api',
    };
  }
}

/**
 * Main function to upload video with API fallback chain
 * Tries: Oracle -> Mac Mini M4 -> Raspberry Pi -> Native processing
 */
export async function uploadVideoWithAPIFallback(
  file: File,
  options: VideoConversionOptions = {}
): Promise<VideoConversionResult> {
  const { maxRetries = 1 } = options;

  console.log("🎬 Starting video upload with 3-tier API fallback chain...", {
    fileName: file.name,
    fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
    creator: options.creator,
    hasThumbnail: !!options.thumbnailUrl,
    chain: "Mac Mini M4 → Oracle → Raspberry Pi → Native"
  });

  // Try primary API first (Mac Mini M4)
  let result = await uploadToPrimaryAPI(file, options);
  if (result.success) {
    console.log("✅ Mac Mini M4 upload successful!");
    return result;
  }

  console.log("⚠️ Mac Mini M4 failed, trying Oracle...");

  // Try secondary API (Mac Mini M4)
  result = await uploadToSecondaryAPI(file, options);
  if (result.success) {
    console.log("✅ Mac Mini M4 upload successful!");
    return result;
  }

  console.log("⚠️ Mac Mini M4 failed, trying Raspberry Pi fallback...");

  // Try fallback API (Raspberry Pi)
  result = await uploadToFallbackAPI(file, options);
  if (result.success) {
    console.log("✅ Raspberry Pi API upload successful!");
    return result;
  }

  console.log("❌ All APIs failed, will fallback to native processing");

  // Return failure - the calling code will handle native fallback
  return {
    success: false,
    error: "All APIs failed (Mac Mini M4, Oracle, Raspberry Pi) - falling back to native processing",
    method: 'native',
  };
}

/**
 * Check if APIs are available
 */
export async function checkAPIAvailability(): Promise<{
  primaryAPI: boolean;
  fallbackAPI: boolean;
}> {
  const checkAPI = async (endpoint: string): Promise<boolean> => {
    try {
      const response = await fetch(endpoint, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const [primaryAPI, fallbackAPI] = await Promise.allSettled([
    checkAPI(PRIMARY_API_ENDPOINT),
    checkAPI(FALLBACK_API_ENDPOINT),
  ]);

  return {
    primaryAPI: primaryAPI.status === 'fulfilled' && primaryAPI.value,
    fallbackAPI: fallbackAPI.status === 'fulfilled' && fallbackAPI.value,
  };
}
lbackAPI.status === 'fulfilled' && fallbackAPI.value,
  };
}
