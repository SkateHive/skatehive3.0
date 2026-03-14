/**
 * Centralized upload logger for Skatehive.
 *
 * Every upload (image or video) gets a structured log entry with the prefix
 * [UPLOAD] so you can filter Vercel logs with that keyword.
 *
 * Usage in API routes:
 *   import { logUpload } from '@/lib/utils/upload-logger';
 *   logUpload({ ... });
 */

export type UploadType = 'image' | 'video' | 'gif' | 'unknown';
export type UploadStatus = 'started' | 'success' | 'failed' | 'rate-limited';
export type UploadRoute = 'pinata' | 'pinata-mobile' | 'pinata-chunked' | 'pinata-direct' | 'hive-images' | 'upload-image' | 'signed-url';

export interface UploadLogEntry {
  status: UploadStatus;
  route: UploadRoute;
  /** File name */
  fileName?: string;
  /** File size in bytes */
  fileSize?: number;
  /** MIME type */
  fileType?: string;
  /** Hive username or wallet */
  creator?: string;
  /** Client IP */
  ip?: string;
  /** mobile / desktop */
  platform?: string;
  /** User agent (truncated) */
  userAgent?: string;
  /** IPFS hash on success */
  ipfsHash?: string;
  /** Hive image URL on success */
  imageUrl?: string;
  /** Error message on failure */
  error?: string;
  /** HTTP status code on failure */
  httpStatus?: number;
  /** How long the upload took in ms */
  durationMs?: number;
  /** Extra context */
  meta?: Record<string, string | number | boolean>;
}

/**
 * Logs an upload event with a searchable [UPLOAD] prefix.
 * All fields are optional except status and route.
 */
export function logUpload(entry: UploadLogEntry): void {
  const sizeMB = entry.fileSize ? (entry.fileSize / (1024 * 1024)).toFixed(2) + 'MB' : 'unknown';
  const timestamp = new Date().toISOString();

  const logData = {
    timestamp,
    status: entry.status,
    route: entry.route,
    fileName: entry.fileName || 'unknown',
    fileSize: sizeMB,
    fileSizeBytes: entry.fileSize,
    fileType: entry.fileType || 'unknown',
    creator: entry.creator || 'anonymous',
    ip: entry.ip || 'unknown',
    platform: entry.platform || 'unknown',
    userAgent: entry.userAgent ? entry.userAgent.substring(0, 120) : undefined,
    ipfsHash: entry.ipfsHash,
    imageUrl: entry.imageUrl,
    error: entry.error,
    httpStatus: entry.httpStatus,
    durationMs: entry.durationMs,
    ...entry.meta,
  };

  // Use different log levels based on status
  switch (entry.status) {
    case 'success':
      console.log(`[UPLOAD] ✅ ${entry.route} | ${entry.fileName || 'unknown'} (${sizeMB}) | ${entry.creator || 'anon'}`, JSON.stringify(logData));
      break;
    case 'failed':
      console.error(`[UPLOAD] ❌ ${entry.route} | ${entry.fileName || 'unknown'} (${sizeMB}) | ${entry.error || 'unknown error'}`, JSON.stringify(logData));
      break;
    case 'rate-limited':
      console.warn(`[UPLOAD] 🚫 ${entry.route} | rate-limited | ip=${entry.ip}`, JSON.stringify(logData));
      break;
    case 'started':
      console.log(`[UPLOAD] 📤 ${entry.route} | ${entry.fileName || 'unknown'} (${sizeMB}) | ${entry.creator || 'anon'}`, JSON.stringify(logData));
      break;
  }
}
