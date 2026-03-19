/**
 * Shared IPFS upload utility that handles Vercel's ~4.5MB payload limit.
 *
 * For files <= 4MB: proxies through /api/pinata (server-side logging, rate limiting)
 * For files > 4MB:  uploads directly to Pinata's API using a temporary signed JWT
 *
 * This should be the ONLY way files are uploaded to IPFS from the client.
 */

import { APP_CONFIG } from "@/config/app.config";
import { groupIdForMimeType } from "@/lib/pinata/groups";

const DIRECT_UPLOAD_THRESHOLD = 4 * 1024 * 1024; // 4MB

/**
 * Get a temporary signed JWT for direct client-to-Pinata uploads
 */
async function getSignedJwt(): Promise<string> {
  const res = await fetch('/api/pinata/signed-url');
  if (!res.ok) throw new Error('Failed to get upload credentials');
  const data = await res.json();
  if (!data.jwt) throw new Error('No JWT returned from signed-url');
  return data.jwt;
}

export interface IpfsUploadResult {
  IpfsHash: string;
  PinSize?: number;
  Timestamp?: string;
  url: string;
}

/**
 * Upload a file/blob to IPFS with automatic direct-upload for large files.
 * Includes XHR-based progress tracking and 413 fallback.
 */
export async function uploadToIpfsSmart(
  fileOrBlob: File | Blob,
  options?: {
    fileName?: string;
    creator?: string;
    onProgress?: (progress: number) => void;
    metadata?: Record<string, string>;
  }
): Promise<IpfsUploadResult> {
  const { fileName, creator, onProgress, metadata } = options || {};
  const name = fileName || (fileOrBlob instanceof File ? fileOrBlob.name : 'upload');
  const fileType = fileOrBlob.type || 'application/octet-stream';
  const size = fileOrBlob.size;

  console.log(`📤 IPFS upload: ${name} (${(size / 1024 / 1024).toFixed(1)}MB)`);

  // Try proxy first for small files, direct for large
  let useDirectUpload = size > DIRECT_UPLOAD_THRESHOLD;

  const doUpload = async (direct: boolean): Promise<IpfsUploadResult> => {
    const formData = new FormData();
    formData.append('file', fileOrBlob, name);

    let endpoint: string;
    let headers: Record<string, string> = {};

    if (direct) {
      console.log('📡 Direct-to-Pinata upload (bypassing Vercel)');
      const groupId = groupIdForMimeType(fileType);
      const pinataMetadata = JSON.stringify({
        name,
        keyvalues: {
          source: 'webapp',
          creator: creator || 'anonymous',
          fileType,
          uploadDate: new Date().toISOString(),
          ...metadata,
        }
      });
      formData.append('pinataMetadata', pinataMetadata);
      formData.append('pinataOptions', JSON.stringify({
        cidVersion: 1,
        ...(groupId && { groupId }),
      }));

      const jwt = await getSignedJwt();
      endpoint = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
      headers = { 'Authorization': `Bearer ${jwt}` };
    } else {
      formData.append('creator', creator || 'anonymous');
      endpoint = '/api/pinata';
    }

    return new Promise<IpfsUploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            if (!result.IpfsHash) {
              reject(new Error('No IPFS hash returned'));
              return;
            }
            resolve({
              IpfsHash: result.IpfsHash,
              PinSize: result.PinSize,
              Timestamp: result.Timestamp,
              url: `https://${APP_CONFIG.IPFS_GATEWAY}/ipfs/${result.IpfsHash}`,
            });
          } catch {
            reject(new Error('Invalid response from upload server'));
          }
        } else if (xhr.status === 413 && !direct) {
          // Proxy rejected as too large — retry directly to Pinata
          console.log('⚠️ Proxy returned 413, retrying with direct upload...');
          doUpload(true).then(resolve, reject);
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error(`Network error: ${xhr.statusText || 'Unknown'}`));
      });

      xhr.addEventListener('timeout', () => {
        reject(new Error('Upload timeout'));
      });

      xhr.timeout = 600000; // 10 minutes

      xhr.open('POST', endpoint);
      for (const [k, v] of Object.entries(headers)) {
        xhr.setRequestHeader(k, v);
      }
      xhr.send(formData);
    });
  };

  return doUpload(useDirectUpload);
}
