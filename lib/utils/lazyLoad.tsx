import dynamic from "next/dynamic";
import { ComponentType, ReactElement } from "react";

/**
 * Lazy load a component with loading fallback
 * Use for heavy components (modals, games, video players, maps)
 */
export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  options?: {
    loading?: () => ReactElement | null;
    ssr?: boolean;
  }
) {
  return dynamic(importFunc, {
    loading: options?.loading,
    ssr: options?.ssr ?? false,
  });
}

/**
 * Lazy load with skeleton fallback
 */
export function lazyLoadWithSkeleton<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  SkeletonComponent: () => ReactElement
) {
  return dynamic(importFunc, {
    loading: SkeletonComponent,
    ssr: false,
  });
}
