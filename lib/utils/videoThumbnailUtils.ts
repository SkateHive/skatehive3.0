/**
 * Video thumbnail generation utilities
 */

import React from 'react';
import { fetchFile } from '@ffmpeg/util';
import { APP_CONFIG } from "@/config/app.config";
import { uploadToIpfsSmart } from "./ipfsUpload";

export async function generateThumbnailWithCanvas(
  file: File
): Promise<string | null> {
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.crossOrigin = "anonymous";

    const videoUrl = URL.createObjectURL(file);
    video.src = videoUrl;

    // Wait for video metadata with timeout
    await Promise.race([
      new Promise((resolve, reject) => {
        video.onloadedmetadata = () => {
          if (video.videoWidth === 0 || video.videoHeight === 0) {
            reject("Invalid video dimensions");
            return;
          }
          if (video.duration === 0 || isNaN(video.duration)) {
            reject("Invalid video duration");
            return;
          }
          resolve(true);
        };
        video.onerror = (error) => {
          console.error("Video element error:", error);
          reject("Video load error");
        };
        video.load();
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject("Video metadata timeout"), 10000)
      ),
    ]);

    // Seek to a good thumbnail position (10% into video, max 5 seconds)
    const thumbnailTime = Math.min(Math.max(video.duration * 0.1, 1), 5);
    video.currentTime = thumbnailTime;

    // Wait for seek to complete
    await Promise.race([
      new Promise((resolve) => {
        video.onseeked = () => resolve(true);
        setTimeout(() => resolve(true), 500);
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject("Video seek timeout"), 3000)
      ),
    ]);

    // Create canvas with optimized dimensions based on video aspect ratio
    const canvas = document.createElement("canvas");
    
    // Calculate optimal thumbnail size - maintain aspect ratio but optimize for web
    const aspectRatio = video.videoWidth / video.videoHeight;
    const maxWidth = 640; // Reduced for faster loading
    const maxHeight = 640;
    
    if (aspectRatio > 1) {
      // Landscape video
      canvas.width = maxWidth;
      canvas.height = Math.round(maxWidth / aspectRatio);
    } else {
      // Portrait or square video
      canvas.height = maxHeight;
      canvas.width = Math.round(maxHeight * aspectRatio);
    }
    
    const ctx = canvas.getContext("2d");

    if (!ctx) throw new Error("Canvas context unavailable");

    // Fill with black background and draw video centered (no cropping needed since we match aspect ratio)
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Clean up video URL
    URL.revokeObjectURL(videoUrl);

    // Convert to blob with optimized quality for web delivery
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(blob || new Blob());
        },
        "image/webp",
        0.75 // Balanced quality for fast loading
      );
    });

    if (blob.size === 0) throw new Error("Empty thumbnail blob");

    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("Canvas thumbnail generation failed:", error);
    return null;
  }
}

export async function generateThumbnailWithFFmpeg(
  file: File,
  ffmpegRef: React.MutableRefObject<any>
): Promise<string | null> {
  try {
    if (!ffmpegRef.current) {
      ffmpegRef.current = new (await import("@ffmpeg/ffmpeg")).FFmpeg();
      await ffmpegRef.current.load();
    }
    
    const ffmpeg = ffmpegRef.current;

    await ffmpeg.writeFile("input_thumb.mp4", await fetchFile(file));

    // Optimized thumbnail generation with dynamic aspect ratio
    await ffmpeg.exec([
      "-i",
      "input_thumb.mp4",
      "-ss",
      "2", // Seek to 2 seconds
      "-frames:v",
      "1",
      "-vf",
      "scale='min(640,iw)':'min(640,ih)':force_original_aspect_ratio=decrease", // Maintain aspect ratio, max 640px
      "-f",
      "webp",
      "-quality",
      "75", // Reduced quality for faster loading
      "thumbnail.webp",
    ]);

    const thumbnailData = await ffmpeg.readFile("thumbnail.webp");
    const thumbnailBlob = new Blob([thumbnailData.buffer], {
      type: "image/webp",
    });

    // Cleanup
    try {
      await ffmpeg.deleteFile("input_thumb.mp4");
      await ffmpeg.deleteFile("thumbnail.webp");
    } catch {}

    return URL.createObjectURL(thumbnailBlob);
  } catch (error) {
    console.error("FFmpeg thumbnail generation failed:", error);
    return null;
  }
}

export async function uploadThumbnail(
  thumbnailBlob: Blob,
  username?: string
): Promise<string | null> {
  try {
    const result = await uploadToIpfsSmart(thumbnailBlob, {
      fileName: 'thumbnail.webp',
      creator: username,
    });
    return result.url;
  } catch (error) {
    console.error("Thumbnail upload failed:", error);
    return null;
  }
}

export async function generateThumbnail(
  file: File,
  ffmpegRef: React.MutableRefObject<any>,
  username?: string,
  fallback: boolean = false
): Promise<string | null> {
  // Always try Canvas method first for speed
  if (!fallback) {
    const canvasThumbnailUrl = await generateThumbnailWithCanvas(file);
    if (canvasThumbnailUrl) {
      // Convert to blob and upload
      try {
        const blob = await fetch(canvasThumbnailUrl).then(res => res.blob());
        const uploadedUrl = await uploadThumbnail(blob, username);
        URL.revokeObjectURL(canvasThumbnailUrl);
        return uploadedUrl;
      } catch (error) {
        console.error("Failed to upload canvas thumbnail:", error);
        URL.revokeObjectURL(canvasThumbnailUrl);
      }
    }
  }

  // Fallback to FFmpeg for files < 50MB
  if (file.size < 50 * 1024 * 1024) {
    const ffmpegThumbnailUrl = await generateThumbnailWithFFmpeg(file, ffmpegRef);
    if (ffmpegThumbnailUrl) {
      try {
        const blob = await fetch(ffmpegThumbnailUrl).then(res => res.blob());
        const uploadedUrl = await uploadThumbnail(blob, username);
        URL.revokeObjectURL(ffmpegThumbnailUrl);
        return uploadedUrl;
      } catch (error) {
        console.error("Failed to upload FFmpeg thumbnail:", error);
        URL.revokeObjectURL(ffmpegThumbnailUrl);
      }
    }
  }

  return null;
}
