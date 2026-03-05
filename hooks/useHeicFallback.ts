"use client";

import { useState, useCallback } from "react";

const HEIC_PATTERN = /\.hei[cf](\?.*)?$/i;

/**
 * Hook that provides an onError handler for <Image>/<img> tags.
 * When a HEIC image fails to load, it fetches the blob, converts
 * to JPEG via heic2any, and returns a blob URL as the new src.
 *
 * Usage:
 *   const { src, onError } = useHeicFallback(originalUrl);
 *   <Image src={src} onError={onError} />
 */
export function useHeicFallback(originalSrc: string) {
  const [src, setSrc] = useState(originalSrc);
  const [converting, setConverting] = useState(false);

  const onError = useCallback(async () => {
    // Only attempt conversion for HEIC URLs, and only once
    if (!HEIC_PATTERN.test(originalSrc) || converting) return;

    setConverting(true);
    try {
      const response = await fetch(originalSrc);
      if (!response.ok) return;

      const heicBlob = await response.blob();
      const heic2any = (await import("heic2any")).default;
      const jpegBlob = await heic2any({
        blob: heicBlob,
        toType: "image/jpeg",
        quality: 0.92,
      });

      const result = Array.isArray(jpegBlob) ? jpegBlob[0] : jpegBlob;
      setSrc(URL.createObjectURL(result));
    } catch (err) {
      console.warn("HEIC fallback failed for:", originalSrc, err);
    }
  }, [originalSrc, converting]);

  return { src, onError, isConverting: converting };
}
