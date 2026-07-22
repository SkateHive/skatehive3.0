/**
 * Resolution of the SIWE `domain` and `uri` fields for Farcaster auth-kit.
 *
 * SIWE binds a signature to the origin that requested it, so these have to
 * match wherever the app is actually being served from. This used to be a
 * hardcoded skatehive.app with a special case for the literal hostname
 * "localhost", which silently broke sign-in on 127.0.0.1, on a LAN IP (how a
 * phone reaches a dev server), and on every preview deployment — the signed
 * domain did not match the serving origin, so the signature was rejected.
 *
 * Kept free of `window` and of app config so the environment matrix is
 * testable — those are exactly the cases nobody can reproduce by hand.
 */

export interface SiweConfig {
  /** Full origin including scheme — the `uri` field of the SIWE message. */
  siweUri: string;
  /** Authority: host plus port when non-default — the `domain` field. */
  domain: string;
}

export interface SiweFallback {
  origin: string;
  domain: string;
}

/**
 * @param location - `window.location` (or any object exposing origin/host).
 *                   Null/undefined outside the browser.
 * @param fallback - Values to use when there is no location to read.
 */
export function resolveSiweConfig(
  location: Pick<Location, "origin" | "host"> | null | undefined,
  fallback: SiweFallback
): SiweConfig {
  if (!location?.origin || !location?.host) {
    return { siweUri: fallback.origin, domain: fallback.domain };
  }

  return {
    siweUri: location.origin,
    domain: location.host,
  };
}
