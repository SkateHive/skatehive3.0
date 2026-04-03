/**
 * OptimizedLoadingText - Responsive loading text with Pretext.js
 * 
 * Automatically adjusts font size to fit container width,
 * preventing text overflow on mobile.
 */

'use client';

import { useMemo } from 'react';
import { Text } from '@chakra-ui/react';
import { usePretext } from '@/hooks/usePretext';
import { useBreakpointValue } from '@chakra-ui/react';

interface OptimizedLoadingTextProps {
  text: string;
  color: string;
  isVisible: boolean;
}

export default function OptimizedLoadingText({
  text,
  color,
  isVisible,
}: OptimizedLoadingTextProps) {
  const { measureTextHeight } = usePretext();

  // Get container widths per breakpoint
  const containerWidth = useBreakpointValue({
    base: typeof window !== 'undefined' ? window.innerWidth * 0.9 : 350, // 90vw
    sm: typeof window !== 'undefined' ? window.innerWidth * 0.8 : 600,   // 80vw
    md: typeof window !== 'undefined' ? window.innerWidth * 0.5 : 800,   // 50vw
    lg: typeof window !== 'undefined' ? window.innerWidth * 0.4 : 900,   // 40vw
  }) || 350;

  // Calculate optimal font size
  const optimalFontSize = useMemo(() => {
    if (!text || !containerWidth) return { base: '20px', sm: '28px', md: '40px', lg: '40px' };

    // Try different font sizes and pick the largest that fits
    const baseSizes = [20, 18, 16, 14, 12]; // Mobile
    const mdSizes = [40, 36, 32, 28, 24];   // Desktop

    // Find optimal base size (mobile)
    let optimalBase = 20;
    for (const fontSize of baseSizes) {
      const measurement = measureTextHeight(text, {
        width: containerWidth * 0.9, // Account for padding
        fontSize,
        fontFamily: 'Joystix, monospace',
        lineHeight: 1.2,
      });
      
      // If text fits in ~3 lines or less, use this size
      if (measurement.lineCount <= 3) {
        optimalBase = fontSize;
        break;
      }
    }

    // Find optimal desktop size
    let optimalMd = 40;
    const desktopWidth = typeof window !== 'undefined' ? window.innerWidth * 0.5 : 800;
    for (const fontSize of mdSizes) {
      const measurement = measureTextHeight(text, {
        width: desktopWidth * 0.9,
        fontSize,
        fontFamily: 'Joystix, monospace',
        lineHeight: 1.2,
      });
      
      if (measurement.lineCount <= 2) {
        optimalMd = fontSize;
        break;
      }
    }

    return {
      base: `${optimalBase}px`,
      sm: `${Math.min(optimalBase + 8, 28)}px`,
      md: `${optimalMd}px`,
      lg: `${optimalMd}px`,
    };
  }, [text, containerWidth, measureTextHeight]);

  return (
    <Text
      position="relative"
      zIndex={1}
      color={color}
      fontSize={optimalFontSize}
      textAlign="center"
      fontFamily="'Joystix', monospace"
      p={[2, 3, 4]}
      borderRadius="none"
      opacity={isVisible ? 1 : 0}
      transition="opacity 0.4s"
      maxW={['90vw', '80vw', '50vw', '40vw']}
      mx="auto"
      lineHeight="1.2"
      wordBreak="break-word" // Prevent overflow
    >
      {text}
    </Text>
  );
}
