import * as dhive from '@hiveio/dhive';
import HiveClient from '@/lib/hive/hiveclient';

/**
 * Proof that the caller of /api/invite created the account it is mailing.
 *
 * The route used to mail whatever it was handed: any recipient, any subject,
 * any `createdby` and `keys`, all of it interpolated into HTML. With no session
 * check that made it an open relay on Skatehive's SMTP reputation.
 *
 * A session check cannot fix it — by the time the route runs the fee is spent,
 * and refusing then strands the keys. What only the real inviter holds is the
 * master password, generated in their browser. Deriving the owner key from it
 * and finding that key on chain proves the caller made this account, without
 * asking the inviter for anything new. Everything the mail then says (creator,
 * keys) is read from the chain or derived here, never taken from the request.
 */

/** A fresh account is mailed once, right after creation. Older ones are not. */
export const INVITE_MAIL_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ChainAccount = {
  name: string;
  created: string;
  recovery_account: string;
  owner: { key_auths: Array<[string | dhive.PublicKey, number]> };
};

export type InviteClaimVerdict =
  | { ok: true; createdBy: string; keys: Record<string, string> }
  | { ok: false; reason: 'not_found' | 'key_mismatch' | 'too_old' };

/** Hive returns `created` as UTC without a zone marker. */
function parseChainTime(value: string): number {
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
}

/** Pure: decides from an account already fetched. Exported for tests. */
export function assessInviteClaim(
  account: ChainAccount | null | undefined,
  username: string,
  masterPassword: string,
  now: number = Date.now()
): InviteClaimVerdict {
  if (!account || account.name !== username) {
    return { ok: false, reason: 'not_found' };
  }

  // Age before key: checked the other way round, an old account answered
  // key_mismatch or too_old depending on whether the guess was right.
  const createdAt = parseChainTime(account.created);
  if (!Number.isFinite(createdAt) || now - createdAt > INVITE_MAIL_WINDOW_MS) {
    return { ok: false, reason: 'too_old' };
  }

  const ownerPubkey = dhive.PrivateKey.fromLogin(username, masterPassword, 'owner')
    .createPublic()
    .toString();
  const holdsOwner = account.owner.key_auths.some(
    ([key]) => String(key) === ownerPubkey
  );
  if (!holdsOwner) return { ok: false, reason: 'key_mismatch' };

  const keys: Record<string, string> = {};
  for (const role of ['owner', 'active', 'posting', 'memo'] as const) {
    const key = dhive.PrivateKey.fromLogin(username, masterPassword, role);
    keys[role] = key.toString();
    keys[`${role}Pubkey`] = key.createPublic().toString();
  }

  // account_create and create_claimed_account both set the recovery account to
  // the creator, so this is who paid — unlike the client's `createdby`.
  return { ok: true, createdBy: account.recovery_account, keys };
}

/**
 * The client calls the route straight after Keychain broadcasts, which can be
 * a block or two before the API node has the account. Poll briefly rather than
 * reporting "not found" for an account that is about to exist.
 */
export async function verifyInviteClaim(
  username: string,
  masterPassword: string,
  { attempts = 5, delayMs = 3000 } = {}
): Promise<InviteClaimVerdict> {
  let verdict: InviteClaimVerdict = { ok: false, reason: 'not_found' };
  for (let i = 0; i < attempts; i++) {
    const [account] = await HiveClient.database.getAccounts([username]);
    verdict = assessInviteClaim(account as unknown as ChainAccount, username, masterPassword);
    if (verdict.ok || verdict.reason !== 'not_found') return verdict;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return verdict;
}
