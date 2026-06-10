"use client";

/**
 * Client-side fallback for broken content images (dead/unpinned IPFS CIDs,
 * 404/400 from gateways, etc.) rendered inside markdown post bodies.
 *
 * Markdown content is injected via dangerouslySetInnerHTML as raw <img> tags
 * with no React onError, so a single dead CID would spam the console with
 * "GET .../ipfs/Qm... 400 (Bad Request)" and render the browser's broken-image
 * glyph. This swaps any failed <img> to an inline SVG placeholder (a data URI,
 * so the fallback itself can never make a network request or fail).
 *
 * HEIC/HEIF images are intentionally skipped — those are handled by
 * heicImageFallback.ts, which converts them client-side rather than replacing.
 */

const HEIC_PATTERN = /\.hei[cf](\?.*)?$/i;

const PLACEHOLDER_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'>" +
  "<rect width='100%' height='100%' fill='#0a0a0a'/>" +
  "<text x='50%' y='50%' fill='#555' font-family='monospace' font-size='14' " +
  "text-anchor='middle' dominant-baseline='middle'>image unavailable</text>" +
  "</svg>";

/** Inline placeholder — a data URI, so it never hits the network. */
export const BROKEN_IMAGE_PLACEHOLDER =
  "data:image/svg+xml;utf8," + encodeURIComponent(PLACEHOLDER_SVG);

const handled = new WeakSet<HTMLImageElement>();

function isHeicUrl(src: string): boolean {
  try {
    return HEIC_PATTERN.test(new URL(src, window.location.origin).pathname);
  } catch {
    return HEIC_PATTERN.test(src);
  }
}

function handleImageError(event: Event): void {
  const img = event.target;
  if (!(img instanceof HTMLImageElement)) return;
  if (handled.has(img)) return;
  // Already the placeholder, or a HEIC image that heicImageFallback owns.
  if (img.src.startsWith("data:image/svg")) return;
  if (isHeicUrl(img.src)) return;

  handled.add(img);
  img.removeAttribute("srcset");
  img.src = BROKEN_IMAGE_PLACEHOLDER;
  img.style.objectFit = "contain";
  img.setAttribute("data-broken-image", "true");
}

/**
 * Attach a capture-phase error listener to a container so any descendant <img>
 * that fails to load is swapped to the placeholder. Capture phase is required
 * because the `error` event does not bubble. Returns a cleanup function.
 */
export function observeBrokenImages(container: HTMLElement): () => void {
  container.addEventListener("error", handleImageError, true);
  return () => container.removeEventListener("error", handleImageError, true);
}
