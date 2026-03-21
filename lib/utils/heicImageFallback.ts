"use client";

/**
 * Client-side fallback for HEIC images already stored on IPFS/Hive.
 *
 * When the browser can't decode a .heic image, we:
 * 1. Hide the broken <img> and show a "converting..." overlay
 * 2. Fetch the raw HEIC blob
 * 3. Convert it to JPEG via heic2any (lazy-loaded)
 * 4. Replace the broken <img> src with a blob URL
 * 5. Show a "tap to open" fallback if all attempts fail
 *
 * Uses DOM overlays instead of SVG data URIs to avoid browser
 * native loading spinners on <img> elements.
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

/** Create a simple text overlay div positioned over the hidden image */
function createOverlay(img: HTMLImageElement, text: string): HTMLDivElement {
  // Remove any existing overlay
  removeOverlay(img);

  const overlay = document.createElement("div");
  overlay.setAttribute("data-heic-overlay", "true");
  overlay.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 200px;
    background: #0a0a0a;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    color: #a7ff00;
    opacity: 0.6;
  `;
  overlay.textContent = text;

  // Insert overlay right after the image
  img.style.display = "none";
  img.insertAdjacentElement("afterend", overlay);

  return overlay;
}

/** Remove overlay and restore image visibility */
function removeOverlay(img: HTMLImageElement): void {
  const next = img.nextElementSibling;
  if (next?.getAttribute("data-heic-overlay") === "true") {
    next.remove();
  }
  img.style.display = "";
}

/** Show fallback overlay with link to original */
function showFallback(img: HTMLImageElement, originalSrc: string): void {
  const overlay = createOverlay(img, "HEIC — tap to open");
  overlay.style.cursor = "pointer";
  overlay.style.opacity = "0.7";
  overlay.onclick = () => window.open(originalSrc, "_blank");
}

/** Convert a single broken HEIC <img> to a JPEG blob URL with retry */
async function convertHeicImage(img: HTMLImageElement): Promise<void> {
  if (processedImages.has(img)) return;
  processedImages.add(img);

  const originalSrc = img.src;
  if (!originalSrc || !isHeicUrl(originalSrc)) return;

  try {
    // Hide broken image, show text overlay
    createOverlay(img, "converting image...");

    // Fetch with 20s timeout (balanced for large files)
    const response = await fetchWithTimeout(originalSrc, 20000);
    if (!response.ok) {
      showFallback(img, originalSrc);
      return;
    }
    const heicBlob = await response.blob();

    // Lazy-load heic2any
    const heic2any = (await import("heic2any")).default;

    // Retry strategy: balanced timeouts for quality vs UX
    // 3MB HEIC can take 10-15s to convert, so we need reasonable timeouts
    const attempts = [
      { quality: 0.92, timeout: 12000 },  // 12s for high quality
      { quality: 0.7, timeout: 15000 },   // 15s for medium
      { quality: 0.5, timeout: 20000 },   // 20s for low (last resort)
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

        // Success — remove overlay, show converted image
        removeOverlay(img);
        img.src = blobUrl;
        img.alt = "";
        return;
      } catch (err) {
        lastError = err as Error;
        console.warn(
          `HEIC conversion attempt (q=${attempt.quality}) failed:`,
          err
        );
      }
    }

    // All retries failed
    console.warn("All HEIC conversion attempts failed for:", originalSrc, lastError);
    showFallback(img, originalSrc);
  } catch (err) {
    console.warn("Failed to convert HEIC image:", originalSrc, err);
    showFallback(img, originalSrc);
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
