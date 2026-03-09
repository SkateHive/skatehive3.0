"use client";

import Image, { ImageProps } from "next/image";
import { useState } from "react";

interface OptimizedImageProps extends Omit<ImageProps, "src"> {
  src: string;
  fallback?: string;
}

/**
 * Optimized Image component that:
 * - Uses Next.js Image optimization for all external URLs
 * - Automatically converts to WebP/AVIF
 * - Handles loading errors with fallback
 * - Maintains aspect ratio
 */
export default function OptimizedImage({
  src,
  alt,
  fallback = "/images/placeholder.png",
  className,
  width,
  height,
  ...props
}: OptimizedImageProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [error, setError] = useState(false);

  const handleError = () => {
    if (!error) {
      setError(true);
      setImgSrc(fallback);
    }
  };

  // If no dimensions provided, use fill layout
  const shouldFill = !width && !height;

  if (shouldFill) {
    return (
      <div className={`relative ${className || ""}`} style={{ width: "100%", height: "100%" }}>
        <Image
          src={imgSrc}
          alt={alt}
          fill
          onError={handleError}
          className="object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          {...props}
        />
      </div>
    );
  }

  return (
    <Image
      src={imgSrc}
      alt={alt}
      width={width}
      height={height}
      onError={handleError}
      className={className}
      {...props}
    />
  );
}
