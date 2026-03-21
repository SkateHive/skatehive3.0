'use client';

import { useEffect } from 'react';
import sdk from '@farcaster/miniapp-sdk';

/**
 * Component to initialize Farcaster Frame SDK globally.
 * Hides splash screen when app is ready.
 */
export function FarcasterFrameInit() {
  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    // Check if running in Farcaster context (iframe or Farcaster user agent)
    const isFarcaster = 
      window.location !== window.parent.location || 
      navigator.userAgent.toLowerCase().includes('farcaster');

    if (!isFarcaster) {
      return;
    }

    // Initialize SDK and hide splash screen
    sdk.actions.ready().catch((err) => {
      console.error('[Farcaster] Failed to initialize SDK:', err);
    });

    // Log context for debugging (optional)
    sdk.context.then(ctx => {
      console.log('[Farcaster] Context:', ctx);
    }).catch(() => {
      // Silently ignore context errors (not in frame)
    });
  }, []);

  return null; // No UI, just side effects
}
