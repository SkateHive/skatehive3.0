/**
 * Redaction for `userbase_identities.metadata` on its way to the browser.
 *
 * `GET /api/userbase/identities` selects the metadata blob whole and returns
 * it, and `contexts/LinkedIdentityContext` puts those rows straight into a
 * React context. So every key ever written into that column is published to
 * the client by default. This module inverts that for the keys that must not
 * travel, and is deliberately a pure function so the rule can be tested
 * without a database, a session, or a network call.
 */

/**
 * Keys stripped from identity metadata before it leaves the server.
 *
 * `signer_uuid` is the Neynar capability identifier for a user's approved
 * signer. Every route that casts (`/api/farcaster/{cast,reply,reaction}` and
 * `lib/crosspost/publishQueueItem`) re-derives it server-side from the session
 * cookie and none of them accepts one from the client, so it has no consumer
 * in the browser — it was only ever travelling because the metadata blob is
 * returned whole.
 *
 * `signer_status` is NOT in this list and must not be added to it:
 * `components/homepage/SnapComposer.tsx` and
 * `components/userbase/AppAccountSetupChecklist.tsx` both read it to decide
 * whether cross-posting is available to the user. Dropping it would leave the
 * composer unable to tell an approved signer from a missing one.
 */
const PRIVATE_IDENTITY_METADATA_KEYS: readonly string[] = ["signer_uuid"];

/**
 * Return a copy of `metadata` without the server-only keys.
 *
 * Non-object input (null, undefined, or a scalar left by an older write) is
 * passed through untouched rather than coerced: the column is `jsonb` and
 * nothing guarantees an object, and turning a null into a `{}` here would
 * change what existing clients see for reasons unrelated to redaction.
 */
export function redactIdentityMetadata(metadata: unknown): unknown {
  if (metadata === null || typeof metadata !== "object") {
    return metadata;
  }
  if (Array.isArray(metadata)) {
    return metadata;
  }

  const source = metadata as Record<string, unknown>;
  const redacted: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    if (PRIVATE_IDENTITY_METADATA_KEYS.includes(key)) {
      continue;
    }
    redacted[key] = source[key];
  }
  return redacted;
}

/** Apply {@link redactIdentityMetadata} to every row's `metadata` field. */
export function redactIdentityRows<T extends { metadata?: unknown }>(
  rows: readonly T[]
): T[] {
  return rows.map((row) => ({
    ...row,
    metadata: redactIdentityMetadata(row.metadata),
  }));
}

export { PRIVATE_IDENTITY_METADATA_KEYS };
