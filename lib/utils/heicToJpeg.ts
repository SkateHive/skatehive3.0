"use client";

/**
 * Convert HEIC/HEIF images to JPEG using heic2any.
 *
 * Browsers (except Safari macOS) cannot render HEIC natively.
 * This utility detects HEIC files and converts them to JPEG blobs
 * that can be processed by browser-image-compression and displayed
 * in <img> tags.
 */

const HEIC_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

const HEIC_EXTENSIONS = new Set(["heic", "heif"]);

/** Check whether a File is HEIC/HEIF (by MIME or extension). */
export function isHeicFile(file: File): boolean {
  if (HEIC_TYPES.has(file.type.toLowerCase())) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return HEIC_EXTENSIONS.has(ext);
}

/**
 * If the file is HEIC/HEIF, convert it to JPEG and return a new File.
 * Otherwise return the original file unchanged.
 */
export async function convertHeicIfNeeded(file: File): Promise<File> {
  if (!isHeicFile(file)) return file;

  // Dynamic import so the 200 KB wasm bundle is only loaded when needed
  const heic2any = (await import("heic2any")).default;

  const blob = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  });

  // heic2any may return a single Blob or an array (for sequences)
  const resultBlob = Array.isArray(blob) ? blob[0] : blob;

  // Build a new File with a .jpg name so downstream code recognises it
  const newName = file.name.replace(/\.hei[cf]$/i, ".jpg");
  return new File([resultBlob], newName, { type: "image/jpeg" });
}
