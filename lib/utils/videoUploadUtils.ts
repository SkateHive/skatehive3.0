/**
 * Video upload utilities and file handling
 */

import { APP_CONFIG } from "@/config/app.config";

export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(video.src);
      resolve(duration);
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Failed to load video metadata"));
    };

    video.src = URL.createObjectURL(file);
  });
}

export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function isIPhoneMov(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith(".mov") &&
    file.type === "video/quicktime"
  );
}

export function isAlreadyProcessed(file: File): boolean {
  return (
    file.name.includes("trimmed_") ||
    file.type === "video/webm" ||
    (file as any).fromTrimModal
  );
}

export function getFileSizeLimits(userHP: number = 0) {
  const isMobile = isMobileDevice();
  const hasHighHP = userHP >= 100; // FILE_SIZE_LIMITS.MIN_HP_FOR_LARGE_FILES

  // Base limits for processing (not upload limits)
  const baseLimits = {
    chunkedUploadThreshold: 20 * 1024 * 1024, // 20MB
    largeFileThreshold: 30 * 1024 * 1024, // 30MB
    compressionThreshold: 12 * 1024 * 1024, // 12MB
  };

  if (hasHighHP) {
    // High HP users get higher processing limits
    return {
      ...baseLimits,
      maxSizeForMobile: 2 * 1024 * 1024 * 1024, // 2GB
      maxSizeForDesktop: 2 * 1024 * 1024 * 1024, // 2GB
      maxSize: 2 * 1024 * 1024 * 1024, // 2GB
    };
  }

  // Standard users get conservative limits
  return {
    ...baseLimits,
    maxSizeForMobile: 135 * 1024 * 1024, // 135MB
    maxSizeForDesktop: 150 * 1024 * 1024, // 150MB
    maxSize: isMobile ? 135 * 1024 * 1024 : 150 * 1024 * 1024,
  };
}

export async function uploadWithProgress(
  formData: FormData,
  onProgress: (progress: number) => void,
  file?: File // Add file parameter for error logging
): Promise<string> {
  return new Promise((resolve, reject) => {
    const isMobile = isMobileDevice();
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText);
      } else {
        const errorMsg = `Upload failed: ${xhr.status} - ${xhr.responseText}`;
        reject(new Error(errorMsg));
      }
    });

    xhr.addEventListener("error", () => {
      const errorMessage = `Network error: ${xhr.statusText || "Unknown error"
        } (Status: ${xhr.status}, State: ${xhr.readyState})`;
      reject(new Error(errorMessage));
    });

    xhr.addEventListener("timeout", () => {
      const timeoutError = "Upload timeout";
      reject(new Error(timeoutError));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload aborted"));
    });

    // Set timeout for mobile networks (increased for larger files)
    xhr.timeout = isMobile ? 600000 : 480000; // 10 minutes for mobile, 8 for desktop

    try {
      // Always use server-side API routes for security (keeps JWT server-side only)
      const endpoint = isMobile ? "/api/pinata-mobile" : "/api/pinata";
      xhr.open("POST", endpoint);
      if (isMobile) {
        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        xhr.setRequestHeader("X-Mobile-Upload", "true");
      }

      // IMPORTANT: Do NOT set the "Content-Type" header manually here. When
      // sending a FormData object, the browser (or XHR) will automatically set
      // the Content-Type including the multipart boundary. Manually setting
      // Content-Type to 'multipart/form-data' will omit the boundary and will
      // cause servers to reject the request.
      // See: https://developer.mozilla.org/en-US/docs/Web/API/FormData/Using_FormData_Objects
      xhr.send(formData);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Upload directly to Pinata's API (bypasses Vercel payload limit)
 */
export async function uploadDirectToPinata(
  formData: FormData,
  jwt: string,
  onProgress: (progress: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText);
      } else {
        reject(new Error(`Upload failed: ${xhr.status} - ${xhr.responseText?.substring(0, 200)}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error(`Network error: ${xhr.statusText || "Unknown error"}`));
    });

    xhr.addEventListener("timeout", () => {
      reject(new Error("Upload timeout"));
    });

    xhr.timeout = 600000; // 10 minutes for large files

    xhr.open("POST", "https://api.pinata.cloud/pinning/pinFileToIPFS");
    xhr.setRequestHeader("Authorization", `Bearer ${jwt}`);
    xhr.send(formData);
  });
}

export async function uploadWithChunks(
  file: File,
  creator?: string,
  thumbnailUrl?: string
): Promise<string> {
  const chunkSize = 10 * 1024 * 1024; // 10MB chunks
  const totalChunks = Math.ceil(file.size / chunkSize);

  if (totalChunks === 1) {
    // File is small enough for single chunk
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        try {
          const arrayBuffer = reader.result as ArrayBuffer;
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

          const response = await fetch('/api/pinata-chunked', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileName: file.name,
              fileType: file.type,
              creator,
              thumbnailUrl,
              totalSize: file.size,
              chunk: base64,
              chunkIndex: 0,
              totalChunks: 1
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Chunked upload failed: ${response.status} - ${errorText}`);
          }

          const result = await response.json();
          resolve(JSON.stringify(result));
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  } else {
    throw new Error("Multi-chunk uploads not yet supported");
  }
}

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
  IpfsHash?: string;
}

export async function handleVideoUpload(
  file: File,
  username?: string,
  thumbnailUrl?: string,
  onProgress?: (progress: number) => void,
  userHP: number = 0,
  enhancedOptions?: {
    platform?: string;
    deviceInfo?: string;
    browserInfo?: string;
    viewport?: string;
    connectionType?: string;
  }
): Promise<UploadResult> {
  try {
    const limits = getFileSizeLimits(userHP);

    console.log('📤 Video upload started:', {
      fileName: file.name,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      creator: username,
      platform: enhancedOptions?.platform || 'web',
      userHP
    });

    if (file.size > limits.maxSize) {
      const sizeMB = Math.round((file.size / 1024 / 1024) * 100) / 100;
      const maxSizeMB = Math.round(limits.maxSize / 1024 / 1024);

      return {
        success: false,
        error: `File too large (${sizeMB}MB). Maximum: ${maxSizeMB}MB`
      };
    }

    // Files > 4MB bypass Vercel's payload limit by uploading directly to Pinata
    const DIRECT_UPLOAD_THRESHOLD = 4 * 1024 * 1024;
    const useDirectUpload = file.size > DIRECT_UPLOAD_THRESHOLD;

    const formData = new FormData();
    formData.append("file", file);

    let responseText: string;

    if (useDirectUpload) {
      // Direct-to-Pinata: get signed JWT, upload with Pinata metadata format
      console.log('📡 Direct-to-Pinata upload (file > 4MB, bypassing Vercel limit)');
      const pinataMetadata = JSON.stringify({
        name: file.name,
        keyvalues: {
          creator: username || 'anonymous',
          fileType: file.type,
          uploadDate: new Date().toISOString(),
          platform: enhancedOptions?.platform || 'web',
          ...(thumbnailUrl && { thumbnailUrl }),
        }
      });
      formData.append('pinataMetadata', pinataMetadata);
      formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

      const jwtRes = await fetch('/api/pinata/signed-url');
      if (!jwtRes.ok) throw new Error('Failed to get upload credentials');
      const { jwt } = await jwtRes.json();
      if (!jwt) throw new Error('No JWT returned');

      responseText = await uploadDirectToPinata(formData, jwt, onProgress || (() => { }));
    } else {
      // Small files: proxy through /api/pinata
      if (username) formData.append("creator", username);
      if (thumbnailUrl) formData.append("thumbnailUrl", thumbnailUrl);
      if (enhancedOptions?.platform) formData.append("platform", enhancedOptions.platform);
      if (userHP > 0) formData.append("userHP", userHP.toString());
      if (enhancedOptions?.deviceInfo) formData.append("deviceInfo", enhancedOptions.deviceInfo);
      if (enhancedOptions?.browserInfo) formData.append("browserInfo", enhancedOptions.browserInfo);
      if (enhancedOptions?.viewport) formData.append("viewport", enhancedOptions.viewport);
      if (enhancedOptions?.connectionType) formData.append("connectionType", enhancedOptions.connectionType);

      responseText = await uploadWithProgress(formData, onProgress || (() => { }));
    }

    const result = JSON.parse(responseText);

    if (!result || !result.IpfsHash) {
      return {
        success: false,
        error: "Failed to upload video - invalid response"
      };
    }

    console.log('✅ Video upload successful:', {
      creator: username,
      platform: enhancedOptions?.platform || 'web',
      ipfsHash: result.IpfsHash
    });

    return {
      success: true,
      url: `https://${APP_CONFIG.IPFS_GATEWAY}/ipfs/${result.IpfsHash}`,
      IpfsHash: result.IpfsHash
    };
  } catch (error) {
    console.error('❌ Video upload failed:', {
      creator: username,
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
