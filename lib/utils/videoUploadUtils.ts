/**
 * Video upload utilities and file handling
 */

const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT;

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

export function getFileSizeLimits() {
  const isMobile = isMobileDevice();
  return {
    maxSizeForMobile: 45 * 1024 * 1024, // 45MB
    maxSizeForDesktop: 50 * 1024 * 1024, // 50MB
    maxSize: isMobile ? 45 * 1024 * 1024 : 50 * 1024 * 1024,
    chunkedUploadThreshold: 20 * 1024 * 1024, // 20MB
    largeFileThreshold: 30 * 1024 * 1024, // 30MB
    compressionThreshold: 12 * 1024 * 1024, // 12MB
  };
}

export async function uploadWithProgress(
  formData: FormData,
  onProgress: (progress: number) => void
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
        reject(new Error(`Upload failed: ${xhr.status} - ${xhr.responseText}`));
      }
    });

    xhr.addEventListener("error", () => {
      const errorMessage = `Network error: ${
        xhr.statusText || "Unknown error"
      } (Status: ${xhr.status}, State: ${xhr.readyState})`;
      reject(new Error(errorMessage));
    });

    xhr.addEventListener("timeout", () => {
      reject(new Error("Upload timeout"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload aborted"));
    });

    // Set timeout for mobile networks
    xhr.timeout = isMobile ? 180000 : 120000; // 3 minutes for mobile, 2 for desktop

  try {
      let endpoint: string;
      if (PINATA_JWT) {
        endpoint = "https://api.pinata.cloud/pinning/pinFileToIPFS";
        xhr.open("POST", endpoint);
        xhr.setRequestHeader("Authorization", `Bearer ${PINATA_JWT}`);
      } else {
        endpoint = isMobile ? "/api/pinata-mobile" : "/api/pinata";
        xhr.open("POST", endpoint);
        if (isMobile) {
          xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
          xhr.setRequestHeader("X-Mobile-Upload", "true");
        }
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
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  try {
    const limits = getFileSizeLimits();
    
    if (file.size > limits.maxSize) {
      const sizeMB = Math.round((file.size / 1024 / 1024) * 100) / 100;
      const maxSizeMB = Math.round(limits.maxSize / 1024 / 1024);
      
      return {
        success: false,
        error: `File too large (${sizeMB}MB). Maximum: ${maxSizeMB}MB`
      };
    }

  // Create FormData for upload. Do NOT set Content-Type manually when sending
  // this FormData (fetch/XHR will set it correctly including the boundary).
  const formData = new FormData();
    formData.append("file", file);
    if (username) formData.append("creator", username);
    if (thumbnailUrl) formData.append("thumbnailUrl", thumbnailUrl);

    let responseText: string;

    if (file.size > limits.chunkedUploadThreshold) {
      try {
        responseText = await uploadWithChunks(file, username, thumbnailUrl);
      } catch (chunkError) {
        responseText = await uploadWithProgress(formData, onProgress || (() => {}));
      }
    } else {
      responseText = await uploadWithProgress(formData, onProgress || (() => {}));
    }

    const result = JSON.parse(responseText);
    
    if (!result || !result.IpfsHash) {
      return {
        success: false,
        error: "Failed to upload video - invalid response"
      };
    }

    return {
      success: true,
      url: `https://ipfs.skatehive.app/ipfs/${result.IpfsHash}`,
      IpfsHash: result.IpfsHash
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
