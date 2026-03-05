"use client";

/**
 * Client-side fallback for HEIC images already stored on IPFS/Hive.
 *
 * When the browser can't decode a .heic image, we:
 * 1. Fetch the raw HEIC blob
 * 2. Convert it to JPEG via heic2any (lazy-loaded)
 * 3. Replace the broken <img> src with a blob URL
 *
 * This runs as a MutationObserver on markdown-body containers so it
 * catches images rendered via dangerouslySetInnerHTML.
 */

const HEIC_PATTERN = /\.hei[cf](\?.*)?$/i;
const processedImages = new WeakSet<HTMLImageElement>();

/** Check if a URL points to a HEIC/HEIF file */
function isHeicUrl(src: string): boolean {
  try {
    const pathname = new URL(src, window.location.origin).pathname;
    return HEIC_PATTERN.test(pathname);
  } catch {
    return HEIC_PATTERN.test(src);
  }
}

/** Convert a single broken HEIC <img> to a JPEG blob URL */
async function convertHeicImage(img: HTMLImageElement): Promise<void> {
  if (processedImages.has(img)) return;
  processedImages.add(img);

  const src = img.src;
  if (!src || !isHeicUrl(src)) return;

  try {
    // Show a loading state
    img.style.opacity = "0.5";
    img.alt = "Converting HEIC image...";

    // Fetch the raw HEIC file
    const response = await fetch(src);
    if (!response.ok) return;
    const heicBlob = await response.blob();

    // Lazy-load heic2any
    const heic2any = (await import("heic2any")).default;
    const jpegBlob = await heic2any({
      blob: heicBlob,
      toType: "image/jpeg",
      quality: 0.92,
    });

    const result = Array.isArray(jpegBlob) ? jpegBlob[0] : jpegBlob;
    const blobUrl = URL.createObjectURL(result);

    // Replace the src
    img.src = blobUrl;
    img.style.opacity = "1";
    img.alt = "";
  } catch (err) {
    console.warn("Failed to convert HEIC image:", src, err);
    img.style.opacity = "1";
    img.alt = "Image format not supported";
  }
}

/**
 * Scan a container for HEIC <img> elements and convert them.
 * Attaches error listeners + processes already-failed images.
 */
export function processHeicImages(container: HTMLElement): void {
  const images = container.querySelectorAll<HTMLImageElement>("img");
  images.forEach((img) => {
    if (processedImages.has(img)) return;

    if (isHeicUrl(img.src)) {
      // If image already failed to load (naturalWidth === 0 and complete)
      if (img.complete && img.naturalWidth === 0) {
        convertHeicImage(img);
      } else {
        // Attach error handler for when it fails
        img.addEventListener(
          "error",
          () => convertHeicImage(img),
          { once: true }
        );
      }
    }
  });
}

/**
 * Observe a container for dynamically inserted HEIC images.
 * Returns a cleanup function.
 */
export function observeHeicImages(container: HTMLElement): () => void {
  // Process existing images immediately
  processHeicImages(container);

  // Watch for new images added to the DOM
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLImageElement && isHeicUrl(node.src)) {
          node.addEventListener("error", () => convertHeicImage(node), {
            once: true,
          });
          // Also try immediately in case it already errored
          if (node.complete && node.naturalWidth === 0) {
            convertHeicImage(node);
          }
        }
        if (node instanceof HTMLElement) {
          processHeicImages(node);
        }
      });
    }
  });

  observer.observe(container, { childList: true, subtree: true });

  return () => observer.disconnect();
}
