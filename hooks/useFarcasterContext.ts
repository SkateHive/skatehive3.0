'use client';

import { useCallback, useEffect, useState } from 'react';
import sdk from '@farcaster/miniapp-sdk';

import {
  limitCastEmbeds,
  resolveChannelKey,
} from '@/lib/farcaster/channels';

/**
 * Farcaster miniapp compose context.
 *
 * History worth knowing before changing this: the miniapp layer was stubbed
 * out in 1b1e8c9c (17/03/2026) as part of a bundle-size purge, which also
 * deleted the manifest and the SDK. The manifest came back three days later
 * (cecea715) and the SDK the day after (34810336) — but this hook stayed a
 * stub returning `isInFrame: false`, which made every SDK-gated branch dead
 * code. So the app has been installable and running as a miniapp while being
 * unable to detect that it was one.
 *
 * Detection uses `sdk.isInMiniApp()` rather than the hand-rolled
 * `window.parent` / user-agent check used elsewhere: it short-circuits false
 * outside an iframe, then confirms by actually talking to the host, so a
 * non-Farcaster iframe no longer reads as a miniapp.
 */

export interface ComposeCastOptions {
  /** Channel to post into. Validated against the allowlist; an unknown or
   *  absent channel composes into the user's own feed rather than failing. */
  channel?: string | null;
  /** Reply target, when the cast should be a reply to an existing cast. */
  parentCastHash?: string;
}

export interface ComposeCastOutcome {
  /** Hash of the created cast, when the host reported one. */
  hash: string | null;
  /** True when the host composer handled it; false when we fell back to web. */
  viaMiniapp: boolean;
}

/** Legacy web compose URL. `warpcast.com` still redirects, but the canonical
 *  host is `farcaster.xyz` and the redirect is a wasted round trip. */
const WEB_COMPOSE_URL = 'https://farcaster.xyz/~/compose';

export const useFarcasterContext = () => {
  const [isInFrame, setIsInFrame] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // isInMiniApp resolves within ~1s (it races the host handshake against an
    // internal timeout) and never rejects on its own, but the catch keeps a
    // throwing host from leaving isReady stuck at false forever.
    sdk
      .isInMiniApp()
      .then((inMiniApp) => {
        if (!cancelled) setIsInFrame(inMiniApp);
      })
      .catch(() => {
        if (!cancelled) setIsInFrame(false);
      })
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const composeCast = useCallback(
    async (
      text: string,
      embeds?: string[],
      options?: ComposeCastOptions
    ): Promise<ComposeCastOutcome> => {
      const trimmedEmbeds = limitCastEmbeds(embeds ?? []);
      const channelKey = resolveChannelKey(options?.channel);

      if (isInFrame) {
        // close: false (the default) keeps the miniapp open AND resolves with
        // the created cast — that hash is what makes attribution possible on
        // this path, since the cast is published by the host and never passes
        // through our server.
        const result = await sdk.actions.composeCast({
          text,
          embeds: trimmedEmbeds as [] | [string] | [string, string],
          ...(channelKey ? { channelKey } : {}),
          ...(options?.parentCastHash
            ? { parent: { type: 'cast' as const, hash: options.parentCastHash } }
            : {}),
        });

        // The user can dismiss the composer without casting; the host then
        // resolves with `cast: null`. That is a cancel, not a failure.
        return { hash: result?.cast?.hash ?? null, viaMiniapp: true };
      }

      // Outside a miniapp: hand off to the web composer. The channel cannot be
      // pre-filled through this URL, so the user picks it there.
      const params = new URLSearchParams({ text });
      for (const embed of trimmedEmbeds) {
        params.append('embeds[]', embed);
      }
      window.open(`${WEB_COMPOSE_URL}?${params.toString()}`, '_blank');
      return { hash: null, viaMiniapp: false };
    },
    [isInFrame]
  );

  return {
    isInFrame,
    isReady,
    composeCast,
  };
};
