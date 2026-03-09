// Analytics event tracking for SEO metrics
// Tracks internal link clicks, engagement, and conversions

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Track internal link click
 * Use this to measure effectiveness of internal linking strategy
 */
export function trackInternalLinkClick(params: {
  linkType: 'related_post' | 'author_posts' | 'hub_nav' | 'trick_crosslink';
  sourceUrl: string;
  targetUrl: string;
  position?: number; // Position in list (1-indexed)
}) {
  if (typeof window === 'undefined') return;

  // Google Analytics 4
  if (window.gtag) {
    window.gtag('event', 'internal_link_click', {
      link_type: params.linkType,
      source_url: params.sourceUrl,
      target_url: params.targetUrl,
      position: params.position,
    });
  }

  // Console log for debugging (remove in production)
  if (process.env.NODE_ENV === 'development') {
    console.log('📊 Internal link clicked:', params);
  }
}

/**
 * Track time spent on page
 * Measures engagement improvement from internal linking
 */
export function trackTimeOnPage(params: {
  pageUrl: string;
  timeSeconds: number;
  hadInternalLinkClick: boolean;
}) {
  if (typeof window === 'undefined') return;

  if (window.gtag) {
    window.gtag('event', 'page_engagement', {
      page_url: params.pageUrl,
      time_seconds: params.timeSeconds,
      had_internal_link_click: params.hadInternalLinkClick,
    });
  }
}

/**
 * Track new landing page visit
 * Measures traffic to /skateshops, /videos, etc.
 */
export function trackLandingPageVisit(params: {
  page: 'skateshops' | 'videos' | 'map' | 'tricks';
  referrer?: string;
}) {
  if (typeof window === 'undefined') return;

  if (window.gtag) {
    window.gtag('event', 'landing_page_visit', {
      page_type: params.page,
      referrer: params.referrer || document.referrer,
    });
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('📊 Landing page visit:', params);
  }
}

/**
 * Track scroll depth on SEO-optimized pages
 * Helps measure content engagement
 */
export function trackScrollDepth(params: {
  pageUrl: string;
  depthPercent: number; // 25, 50, 75, 100
}) {
  if (typeof window === 'undefined') return;

  if (window.gtag) {
    window.gtag('event', 'scroll_depth', {
      page_url: params.pageUrl,
      depth_percent: params.depthPercent,
    });
  }
}
