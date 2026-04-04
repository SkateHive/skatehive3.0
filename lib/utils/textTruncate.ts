/**
 * Text Truncation Utilities with Pretext.js
 * 
 * Provides pixel-perfect text truncation without DOM measurement.
 */

import { prepare, layout } from '@chenglou/pretext';

export interface TruncateOptions {
  maxWidth: number;
  maxLines?: number;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  ellipsis?: string;
}

/**
 * Truncate text to fit within maxWidth and maxLines
 * 
 * Returns exact truncated text without DOM measurement.
 */
export function truncateText(
  text: string,
  options: TruncateOptions
): string {
  const {
    maxWidth,
    maxLines = 3,
    fontSize = 16,
    fontFamily = 'Inter, system-ui, sans-serif',
    lineHeight = 1.5,
    ellipsis = '...',
  } = options;

  if (!text) return '';

  const font = `${fontSize}px ${fontFamily}`;
  
  try {
    
    // Simple approach: layout and check line count
    const result = layout(prepare(text, font), maxWidth, fontSize * lineHeight);
    
    if (result.lineCount <= maxLines) {
      return text; // Fits without truncation
    }
    
    // Binary search for truncation point
    let lo = 0;
    let hi = text.length;
    let bestFit = '';
    
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);
      const candidate = text.substring(0, mid).trim() + ellipsis;
      const test = layout(prepare(candidate, font), maxWidth, fontSize * lineHeight);
      
      if (test.lineCount <= maxLines) {
        bestFit = text.substring(0, mid).trim();
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    
    return bestFit + ellipsis;


  } catch (error) {
    // Fallback: character-based truncation
    const avgCharWidth = fontSize * 0.6;
    const charsPerLine = Math.max(1, Math.floor(maxWidth / avgCharWidth));
    const maxChars = charsPerLine * maxLines;
    
    if (text.length > maxChars) {
      const truncateAt = Math.max(0, maxChars - ellipsis.length);
      return text.substring(0, truncateAt).trim() + ellipsis;
    }
    return text;
  }
}

/**
 * Calculate tight-wrap width for text (minimum width that preserves line count)
 * 
 * Used for chat bubbles and dynamic-width containers.
 */
export function getTightWrapWidth(
  text: string,
  maxWidth: number,
  fontSize: number = 16,
  fontFamily: string = 'Inter, system-ui, sans-serif'
): number {
  if (!text) return 0;

  const font = `${fontSize}px ${fontFamily}`;
  const lineHeight = fontSize * 1.5;

  try {
    // Get natural layout at max width
    const prepared = prepare(text, font);
    const natural = layout(prepared, maxWidth, lineHeight);
    const targetLineCount = natural.lineCount;

    // Binary search for minimum width
    let lo = 0;
    let hi = maxWidth;

    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      const test = layout(prepared, mid, lineHeight);

      if (test.lineCount === targetLineCount) {
        hi = mid; // Can go narrower
      } else {
        lo = mid; // Too narrow
      }
    }

    return hi;
  } catch (error) {
    return maxWidth;
  }
}

/**
 * Get optimal font size for text to fit in container
 * 
 * Useful for responsive headings and loading text.
 */
export function getOptimalFontSize(
  text: string,
  containerWidth: number,
  maxLines: number = 2,
  fontFamily: string = 'Inter, system-ui, sans-serif',
  minFontSize: number = 12,
  maxFontSize: number = 40
): number {
  if (!text) return maxFontSize;

  try {
    // Try sizes from largest to smallest
    for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 2) {
      const font = `${fontSize}px ${fontFamily}`;
      const lineHeight = fontSize * 1.5;
      
      const prepared = prepare(text, font);
      const result = layout(prepared, containerWidth, lineHeight);

      if (result.lineCount <= maxLines) {
        return fontSize;
      }
    }

    return minFontSize;
  } catch (error) {
    return maxFontSize;
  }
}

/**
 * Check if text will overflow without rendering
 */
export function willTextOverflow(
  text: string,
  maxWidth: number,
  maxLines: number,
  fontSize: number = 16,
  fontFamily: string = 'Inter, system-ui, sans-serif'
): boolean {
  if (!text) return false;

  const font = `${fontSize}px ${fontFamily}`;
  const lineHeight = fontSize * 1.5;

  try {
    const prepared = prepare(text, font);
    const result = layout(prepared, maxWidth, lineHeight);
    return result.lineCount > maxLines;
  } catch (error) {
    const avgCharWidth = fontSize * 0.6;
    const charsPerLine = Math.max(1, Math.floor(maxWidth / avgCharWidth));
    return text.length > charsPerLine * maxLines;
  }
}
