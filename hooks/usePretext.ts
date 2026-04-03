/**
 * usePretext - High-performance text measurement hook using Pretext.js
 * 
 * Replaces DOM measurements (getBoundingClientRect) with pure JS arithmetic
 * for 500x faster text height calculations - ideal for virtual scrolling.
 * 
 * @see https://pretextjs.dev
 */

import { useMemo, useCallback } from 'react';
import { prepare, layout, type PreparedText } from '@chenglou/pretext';

export interface TextMeasureOptions {
  width: number;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
}

export interface TextMeasurement {
  height: number;
  lineCount: number;
  width: number;
}

/**
 * Hook for measuring text dimensions without touching the DOM
 * 
 * @example
 * ```tsx
 * const { measureTextHeight } = usePretext();
 * const height = measureTextHeight("Long text...", { width: 600, fontSize: 16 });
 * ```
 */
export function usePretext() {
  /**
   * Measure text height without DOM reflow
   * 
   * @param text - Text content to measure
   * @param options - Measurement options (width required)
   * @returns Text measurement with height, width, and line count
   */
  const measureTextHeight = useCallback(
    (text: string, options: TextMeasureOptions): TextMeasurement => {
      if (!text || options.width <= 0) {
        return { height: 0, width: 0, lineCount: 0 };
      }

      const fontSize = options.fontSize || 16;
      const lineHeight = options.lineHeight || 1.5;
      const fontFamily = options.fontFamily || 'Inter, system-ui, -apple-system, sans-serif';
      
      // Pretext.js font string format: "16px Inter, system-ui"
      const font = `${fontSize}px ${fontFamily}`;

      try {
        // Step 1: Prepare text (analyzes + caches metrics)
        const prepared: PreparedText = prepare(text, font);
        
        // Step 2: Layout (calculates line wrapping + height)
        const result = layout(prepared, options.width, fontSize * lineHeight);

        return {
          height: result.height,
          lineCount: result.lineCount,
          width: options.width,
        };
      } catch (error) {
        // Fallback to rough estimate on error
        console.warn('Pretext measurement failed, using fallback:', error);
        const charWidth = fontSize * 0.6; // Rough estimate
        const charsPerLine = Math.floor(options.width / charWidth);
        const estimatedLines = Math.max(1, Math.ceil(text.length / charsPerLine));
        return {
          height: estimatedLines * fontSize * lineHeight,
          lineCount: estimatedLines,
          width: options.width,
        };
      }
    },
    []
  );

  /**
   * Measure multiple texts in batch (more efficient than individual calls)
   */
  const measureBatch = useCallback(
    (
      texts: string[],
      options: TextMeasureOptions
    ): TextMeasurement[] => {
      return texts.map((text) => measureTextHeight(text, options));
    },
    [measureTextHeight]
  );

  return {
    measureTextHeight,
    measureBatch,
  };
}

/**
 * Utility: Extract text content from Hive post body (strips markdown)
 */
export function extractPlainText(markdown: string): string {
  if (!markdown) return '';
  
  return markdown
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // Convert links to text
    .replace(/[#*_~`]/g, '') // Remove markdown symbols
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();
}
