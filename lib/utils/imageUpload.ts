/**
 * Image upload utilities for Hive Images service
 */

export interface ImageUploadResult {
  url: string;
  filename?: string;
}

export function dataURLtoBlob(dataURL: string): Blob {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new Blob([u8arr], { type: mime });
}

export function blobToFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: blob.type });
}

export async function uploadToHiveImages(imageDataUrl: string, filename?: string): Promise<ImageUploadResult> {
  try {
    const blob = dataURLtoBlob(imageDataUrl);
    const finalFilename = filename || `airdrop-network-${Date.now()}.png`;
    const file = blobToFile(blob, finalFilename);

    const { getFileSignature, uploadImage } = await import('@/lib/hive/client-functions');
    const signature = await getFileSignature(file);
    const uploadedUrl = await uploadImage(file, signature);

    return {
      url: uploadedUrl,
      filename: finalFilename,
    };
  } catch (error) {
    console.error('Hive Images upload failed:', error);
    throw new Error(`Image upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function uploadToIPFSFallback(imageDataUrl: string, filename?: string): Promise<ImageUploadResult> {
  try {
    const blob = dataURLtoBlob(imageDataUrl);
    const finalFilename = filename || `airdrop-network-${Date.now()}.png`;

    const { uploadToIpfs } = await import('@/lib/markdown/composeUtils');
    const ipfsUrl = await uploadToIpfs(blob, finalFilename);

    return {
      url: ipfsUrl,
      filename: finalFilename,
    };
  } catch (error) {
    console.error('IPFS upload failed:', error);
    throw new Error(`IPFS upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function uploadToHiveImagesWithRetry(
  imageDataUrl: string,
  filename?: string,
  maxRetries: number = 2
): Promise<ImageUploadResult> {
  let lastHiveError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await uploadToHiveImages(imageDataUrl, filename);
    } catch (error) {
      lastHiveError = error as Error;
      console.warn(`Hive Images upload attempt ${i + 1} failed:`, error);

      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }

  try {
    return await uploadToIPFSFallback(imageDataUrl, filename);
  } catch (ipfsError) {
    console.error('Both Hive Images and IPFS uploads failed');
    throw new Error(
      `Upload failed on both services. Hive Images: ${lastHiveError?.message}. IPFS: ${ipfsError instanceof Error ? ipfsError.message : 'Unknown error'}`
    );
  }
}
