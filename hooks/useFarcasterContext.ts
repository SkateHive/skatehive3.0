'use client';

/**
 * Stub for Farcaster frame context — miniapp SDK coupling removed.
 * composeCast falls back to opening Warpcast compose URL.
 */
export const useFarcasterContext = () => {
  const composeCast = async (text: string, embeds?: string[]) => {
    const params = new URLSearchParams({ text });
    if (embeds?.[0]) params.set('embeds[]', embeds[0]);
    if (embeds?.[1]) params.set('embeds[]', embeds[1]);
    window.open(`https://warpcast.com/~/compose?${params.toString()}`, '_blank');
  };

  return {
    isInFrame: false,
    isReady: true,
    composeCast,
  };
};
