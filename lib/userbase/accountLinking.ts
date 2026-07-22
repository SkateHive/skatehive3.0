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
 * The Hive account that owns the userbase session, lowercased.
 *
 * Prefers the identity flagged primary, falling back to the first Hive
 * identity so a session whose rows predate the primary flag still resolves.
 * Returns null when the session has no Hive identity at all (email- or
 * wallet-only users), which callers treat as "nothing to compare against".
 */
export function resolveSessionHiveHandle(
  identities: readonly LinkableIdentity[] | null | undefined
): string | null {
  if (!identities?.length) return null;

  const hives = identities.filter(
    (identity) => identity.type === "hive" && !!identity.handle
  );
  const owner = hives.find((identity) => identity.is_primary) || hives[0];

  return owner?.handle?.toLowerCase() || null;
}

/**
 * Whether aioha's active account is an *additional* Hive login rather than the
 * account this session belongs to.
 *
 * True only when the session already owns a Hive identity and the active
 * account is a different one — a deliberate second login, not an account we
 * just discovered. When the session owns no Hive identity yet, this is false so
 * the genuine "you connected Hive, want to link it?" flow still runs.
 */
export function isAdditionalHiveLogin(
  sessionHiveHandle: string | null,
  activeHiveUser: string | null | undefined
): boolean {
  if (!sessionHiveHandle || !activeHiveUser) return false;
  return sessionHiveHandle !== activeHiveUser.toLowerCase();
}

/**
 * Which Hive account's on-chain profile metadata may be mined for linkable
 * addresses, or null when no account can be safely attributed to this session.
 *
 * The session's own Hive identity always wins. Without one, the active account
 * is only trustworthy when it is the *sole* account aioha holds — if several are
 * logged in and none is linked to the session, there is no way to tell which one
 * the session belongs to, and mining the active one would offer a stranger's
 * wallet for linking.
 */
export function resolveMetadataSourceHandle(
  sessionHiveHandle: string | null,
  activeHiveUser: string | null | undefined,
  otherUsers: Readonly<Record<string, unknown>> | null | undefined
): string | null {
  if (sessionHiveHandle) return sessionHiveHandle;
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
