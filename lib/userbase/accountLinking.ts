/**
 * Pure helpers for deciding which Hive account the account-linking prompts
 * should reason about.
 *
 * Background: multi-account Hive login lets several accounts be logged in
 * within the same browser session. That decoupled two things which used to
 * move together — the account aioha has *active* (who signs broadcasts) and
 * the account that owns the *userbase session* (whose linked identities,
 * settings and stored keys we hold). Linking suggestions must key off the
 * latter; reading the former made the app offer to link, or even merge,
 * accounts that may belong to different people.
 *
 * These are split out of the React hooks so the decisions can be unit tested
 * without a renderer.
 */

/** Minimal shape needed here — the full row lives in LinkedIdentityContext. */
export interface LinkableIdentity {
  type: string;
  handle: string | null;
  is_primary?: boolean;
}

/**
 * Who owns the userbase session, on the Hive side.
 *
 * The two failure modes must stay distinguishable, because they authorise
 * opposite things downstream:
 *
 * - `none` — the session holds no Hive identity (email- or wallet-only user).
 *   There is nothing to compare against, and aioha's sole account may legitimately
 *   be the one the user is connecting right now.
 * - `ambiguous` — the session holds Hive identities but no single one can be
 *   named as the owner. Something *is* attributed to this session, we just can't
 *   tell what, so no account may stand in for it.
 *
 * Collapsing both to `null` would let an ambiguous session take the `none` path
 * and mine an unrelated account's profile for linkable addresses.
 */
export type SessionHiveOwnership =
  | { status: "resolved"; handle: string }
  | { status: "none"; handle: null }
  | { status: "ambiguous"; handle: null };

/**
 * Resolve which Hive account owns the userbase session.
 *
 * A single Hive identity is the owner even without the primary flag set — rows
 * can predate it. With several (e.g. after a merge), exactly one must be marked
 * primary. Zero primaries among several is genuine ambiguity; multiple primaries
 * of a type can't occur (the DB has a unique index on `(user_id, type) where
 * is_primary`), but is handled the same way rather than trusted.
 *
 * Because the resolved handle feeds linking suggestions, an arbitrary pick could
 * offer the wrong account's wallet or prompt a merge of unrelated accounts, so
 * this fails closed rather than guessing.
 */
export function resolveSessionHiveOwnership(
  identities: readonly LinkableIdentity[] | null | undefined
): SessionHiveOwnership {
  const hives = (identities ?? []).filter(
    (identity) => identity.type === "hive" && !!identity.handle
  );
  if (hives.length === 0) return { status: "none", handle: null };

  const resolved = (identity: LinkableIdentity): SessionHiveOwnership => {
    const handle = identity.handle?.toLowerCase();
    // Unreachable via the filter above; keeps the return type honest.
    return handle
      ? { status: "resolved", handle }
      : { status: "ambiguous", handle: null };
  };

  if (hives.length === 1) return resolved(hives[0]);

  const primaries = hives.filter((identity) => identity.is_primary);
  if (primaries.length === 1) return resolved(primaries[0]);
  return { status: "ambiguous", handle: null };
}

/**
 * The Hive account that owns the session, lowercased, or null when it can't be
 * named — either because there is none or because it's ambiguous.
 *
 * Convenience for callers that only need the handle to compare against (the
 * distinction doesn't change a comparison). Anything that *acts* on the absence
 * must use {@link resolveSessionHiveOwnership} instead.
 */
export function resolveSessionHiveHandle(
  identities: readonly LinkableIdentity[] | null | undefined
): string | null {
  return resolveSessionHiveOwnership(identities).handle;
}

/**
 * Whether aioha's active account is an *additional* Hive login rather than the
 * account this session belongs to — i.e. one that must not be offered for
 * linking.
 *
 * When the session owns a Hive identity, the active account is additional if it
 * differs from it: a deliberate second login, not an account we just discovered.
 *
 * When the session owns no Hive identity yet, the active account is the one to
 * link only while it's the *sole* account aioha holds — the genuine "you
 * connected Hive, want to link it?" flow. Once other logins are present none of
 * them can be attributed to the session, so the active one is treated as
 * additional too (same ambiguity rule as resolveMetadataSourceHandle).
 *
 * When session ownership is ambiguous the active account is always additional,
 * whatever aioha holds: the session does own a Hive identity, we just can't name
 * it, so nothing may stand in for it.
 */
export function isAdditionalHiveLogin(
  ownership: SessionHiveOwnership,
  activeHiveUser: string | null | undefined,
  otherUsers?: Readonly<Record<string, unknown>> | null
): boolean {
  if (!activeHiveUser) return false;
  if (ownership.status === "resolved") {
    return ownership.handle !== activeHiveUser.toLowerCase();
  }
  if (ownership.status === "ambiguous") return true;
  return !!otherUsers && Object.keys(otherUsers).length > 0;
}

/**
 * Which Hive account's on-chain profile metadata may be mined for linkable
 * addresses, or null when no account can be safely attributed to this session.
 *
 * The session's own Hive identity always wins. With *no* Hive identity, the
 * active account is trustworthy only when it is the sole account aioha holds —
 * if several are logged in and none is linked to the session, there is no way to
 * tell which one the session belongs to, and mining the active one would offer a
 * stranger's wallet for linking.
 *
 * Ambiguous ownership never falls back, not even to a sole aioha account: the
 * session is known to own Hive identities that aren't the active one, so the
 * active account is a stranger to it by construction.
 */
export function resolveMetadataSourceHandle(
  ownership: SessionHiveOwnership,
  activeHiveUser: string | null | undefined,
  otherUsers: Readonly<Record<string, unknown>> | null | undefined
): string | null {
  if (ownership.status === "resolved") return ownership.handle;
  if (ownership.status === "ambiguous") return null;
  if (!activeHiveUser) return null;
  if (otherUsers && Object.keys(otherUsers).length > 0) return null;
  return activeHiveUser.toLowerCase();
}

/**
 * Whether a change of aioha's active account came from multi-account activity
 * (switching between accounts, or adding one) rather than a fresh connection.
 *
 * Both switching and adding keep the previously active account as an aioha
 * "other login", so its presence there is the signal. A plain logout/login
 * cycle drops it, which stays correctly classified as a new connection.
 *
 * Needed on top of {@link isAdditionalHiveLogin} to cover sessions that own no
 * Hive identity yet — there is no session handle to compare against, but the
 * accounts aioha is holding still tell us what happened.
 */
export function isMultiAccountTransition(
  previousHiveUser: string | null | undefined,
  otherUsers: Readonly<Record<string, unknown>> | null | undefined
): boolean {
  if (!previousHiveUser || !otherUsers) return false;
  return Object.prototype.hasOwnProperty.call(otherUsers, previousHiveUser);
}
