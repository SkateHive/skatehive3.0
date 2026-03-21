'use client';

import { useEffect, useState } from 'react';
import sdk from '@farcaster/frame-sdk';

/**
 * Hook to initialize Farcaster Frame SDK and hide splash screen.
 * Only runs in Farcaster miniapp context.
 */
export function useFarcasterFrame() {
  const [isReady, setIsReady] = useState(false);
  const [context, setContext] = useState<any>(null);

  useEffect(() => {
    // Check if running in Farcaster context
    const isFarcaster = typeof window !== 'undefined' && 
                        (window.location !== window.parent.location || 
                         navigator.userAgent.includes('Farcaster'));

    if (!isFarcaster) {
      return;
    }

    // Initialize SDK
    sdk.actions.ready().then(() => {
      setIsReady(true);
      // Get context (user info, etc.)
      sdk.context.then(ctx => {
        setContext(ctx);
      });
    }).catch(err => {
      console.error('Farcaster SDK init failed:', err);
    });
  }, []);

  return {
    isReady,
    context,
    isFarcaster: context !== null,
  };
}
