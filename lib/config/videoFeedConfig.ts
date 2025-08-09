/**
 * Video Feed Configuration
 * Centralized settings for video feed performance and behavior
 */

export const VIDEO_FEED_CONFIG = {
  // Performance settings based on environment
  PRODUCTION: {
    maxConcurrentPreloads: 2,
    lookaheadCount: 2,
    preloadStrategy: 'metadata' as const,
    debugMode: false,
    enableConsoleLogging: false
  },
  
  DEVELOPMENT: {
    maxConcurrentPreloads: 3,
    lookaheadCount: 3,
    preloadStrategy: 'metadata' as const,
    debugMode: true,
    enableConsoleLogging: true
  },

  // UI/UX settings
  CONTROLS: {
    autoHideTimeout: 3000, // ms
    transitionDuration: 200, // ms
    swipeThreshold: 50, // pixels
    tapTimeout: 300, // ms
    vibrateOnSwipe: 50 // ms (mobile only)
  },

  // Video settings
  VIDEO: {
    defaultMuted: true,
    autoplay: true,
    loop: true,
    playsInline: true,
    crossOrigin: 'anonymous' as const,
    preload: 'metadata' as const
  },

  // Memory management
  MEMORY: {
    cleanupThreshold: 2, // videos to keep behind current
    maxVideoElements: 5, // total video elements in DOM
    gcInterval: 30000 // garbage collection interval (ms)
  },

  // Feature flags
  FEATURES: {
    enableVideoPreloading: true,
    enableLazyLoading: true,
    enableSmartControls: true,
    enableVideoTransitions: true,
    enablePerformanceMonitoring: process.env.NODE_ENV === 'development'
  }
};

// Helper function to get current environment config
export const getVideoFeedConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction ? VIDEO_FEED_CONFIG.PRODUCTION : VIDEO_FEED_CONFIG.DEVELOPMENT;
};

// Performance monitoring helpers
export const VideoFeedPerformance = {
  mark: (name: string) => {
    if (VIDEO_FEED_CONFIG.FEATURES.enablePerformanceMonitoring) {
      performance.mark(name);
    }
  },
  
  measure: (name: string, startMark: string, endMark?: string) => {
    if (VIDEO_FEED_CONFIG.FEATURES.enablePerformanceMonitoring) {
      try {
        performance.measure(name, startMark, endMark);
        const measure = performance.getEntriesByName(name, 'measure')[0];
        console.log(`⚡ ${name}: ${measure.duration.toFixed(2)}ms`);
        return measure.duration;
      } catch (error) {
        console.warn('Performance measurement failed:', error);
      }
    }
    return 0;
  },

  clearMarks: () => {
    if (VIDEO_FEED_CONFIG.FEATURES.enablePerformanceMonitoring) {
      performance.clearMarks();
      performance.clearMeasures();
    }
  }
};

export type VideoFeedConfig = typeof VIDEO_FEED_CONFIG;
