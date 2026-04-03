/**
 * Feature Flags for SkateHive
 * 
 * Allows gradual rollout of performance optimizations and new features.
 */

export const FEATURES = {
  /**
   * Enable Pretext.js virtual scrolling for homepage feed
   * 
   * Benefits:
   * - 500x faster text measurement (no DOM reads)
   * - Smooth 120fps scrolling
   * - Better performance on low-end devices
   * 
   * Set to true to test, false for standard infinite scroll
   */
  PRETEXT_VIRTUAL_SCROLL: process.env.NEXT_PUBLIC_PRETEXT_ENABLED === 'true',

  /**
   * Enable performance monitoring in dev mode
   */
  PERF_MONITORING: process.env.NODE_ENV === 'development',
} as const;

/**
 * Get feature flag value with optional localStorage override
 */
export function getFeature(key: keyof typeof FEATURES): boolean {
  if (typeof window === 'undefined') return FEATURES[key];
  
  const override = localStorage.getItem(`feature_${key}`);
  if (override !== null) {
    return override === 'true';
  }
  
  return FEATURES[key];
}

/**
 * Toggle feature flag in localStorage (dev/testing only)
 */
export function toggleFeature(key: keyof typeof FEATURES): void {
  if (typeof window === 'undefined') return;
  
  const current = getFeature(key);
  localStorage.setItem(`feature_${key}`, String(!current));
  console.log(`Feature ${key} toggled to ${!current}`);
}
