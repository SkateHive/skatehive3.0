"use client";

/**
 * Client-side fallback for HEIC images already stored on IPFS/Hive.
 *
 * When the browser can't decode a .heic image, we:
 * 1. Fetch the raw HEIC blob
 * 2. Convert it to JPEG via heic2any (lazy-loaded)
 * 3. Replace the broken <img> src with a blob URL
 * 4. Retry up to 2 times with lower quality for large files
 * 5. Show a placeholder if all attempts fail
 *
 * This runs as a MutationObserver on markdown-body containers so it
 * catches images rendered via dangerouslySetInnerHTML.
 */

const HEIC_PATTERN = /\.hei[cf](\?.*)?$/i;
const processedImages = new WeakSet<HTMLImageElement>();

// Fallback placeholder for when conversion completely fails
const FALLBACK_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23202020' width='400' height='300'/%3E%3Ctext x='200' y='140' text-anchor='middle' fill='%23666' font-family='monospace' font-size='14'%3E📷 HEIC image%3C/text%3E%3Ctext x='200' y='165' text-anchor='middle' fill='%23555' font-family='monospace' font-size='11'%3ETap to open original%3C/text%3E%3C/svg%3E";

/** Check if a URL points to a HEIC/HEIF file */
function isHeicUrl(src: string): boolean {
  try {
    const pathname = new URL(src, window.location.origin).pathname;
    return HEIC_PATTERN.test(pathname);
  } catch {
    return HEIC_PATTERN.test(src);
  }
}

/** Fetch with timeout */
function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Fetch timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    fetch(url, { signal: controller.signal })
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/** Convert with timeout wrapper */
function convertWithTimeout(
  heic2any: any,
  blob: Blob,
  quality: number,
  timeoutMs: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Conversion timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    heic2any({ blob, toType: "image/jpeg", quality })
      .then((result: Blob | Blob[]) => {
        clearTimeout(timer);
        resolve(Array.isArray(result) ? result[0] : result);
      })
      .catch((err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/** Show fallback placeholder with link to original */
function showFallback(img: HTMLImageElement, originalSrc: string): void {
  img.src = FALLBACK_PLACEHOLDER;
  img.style.opacity = "1";
  img.style.cursor = "pointer";
  img.alt = "HEIC image — tap to open";
  img.title = "Open original HEIC image";
  img.onclick = () => window.open(originalSrc, "_blank");
}

/** Convert a single broken HEIC <img> to a JPEG blob URL with retry */
async function convertHeicImage(img: HTMLImageElement): Promise<void> {
  if (processedImages.has(img)) return;
  processedImages.add(img);

  const src = img.src;
  if (!src || !isHeicUrl(src)) return;

  try {
    // Show loading state
    img.style.opacity = "0.5";
    img.alt = "Converting HEIC image...";

    // Fetch with 30s timeout (large files need time)
    const response = await fetchWithTimeout(src, 30000);
    if (!response.ok) {
      showFallback(img, src);
      return;
    }
    const heicBlob = await response.blob();

    // Lazy-load heic2any
    const heic2any = (await import("heic2any")).default;

    // Retry strategy: try high quality first, then lower quality, then even lower
    const attempts = [
      { quality: 0.92, timeout: 20000 },
      { quality: 0.7, timeout: 30000 },
      { quality: 0.5, timeout: 45000 },
    ];

    let lastError: Error | null = null;

    for (const attempt of attempts) {
      try {
        const jpegBlob = await convertWithTimeout(
          heic2any,
          heicBlob,
          attempt.quality,
          attempt.timeout
        );
        const blobUrl = URL.createObjectURL(jpegBlob);

        // Success!
        img.src = blobUrl;
        img.style.opacity = "1";
        img.alt = "";
        img.style.cursor = "";
        img.onclick = null;
        return;
      } catch (err) {
        lastError = err as Error;
        console.warn(
          `HEIC conversion attempt (q=${attempt.quality}) failed:`,
          err
        );
      }
    }

    // All retries failed — show fallback
    console.warn("All HEIC conversion attempts failed for:", src, lastError);
    showFallback(img, src);
  } catch (err) {
    console.warn("Failed to convert HEIC image:", src, err);
    showFallback(img, src);
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
        img.addEventListener("error", () => convertHeicImage(img), {
          once: true,
        });
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
