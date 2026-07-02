import { Operation, PrivateKey, TransactionConfirmation } from "@hiveio/dhive";
import HiveClient from "@/lib/hive/hiveclient";

export class PostingAuthorityError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_GRANTED" | "CONFIG_MISSING" | "CONFIG_INVALID" | "BROADCAST_FAILED"
  ) {
    super(message);
    this.name = "PostingAuthorityError";
  }
}

function getServiceConfig(): { account: string; key: string } | null {
  const account = process.env.DEFAULT_HIVE_POSTING_ACCOUNT?.trim();
  const key = process.env.DEFAULT_HIVE_POSTING_KEY?.trim();
  if (!account || !key) return null;
  return { account, key };
}

// Pure authority check — no config validation, accepts explicit service account name.
// Used internally by both public exports to avoid redundant config reads.
async function checkAuthority(
  hiveUsername: string,
  serviceAccount: string
): Promise<boolean> {
  const accounts = await HiveClient.database.getAccounts([hiveUsername]);
  const account = accounts[0];
  if (!account) return false;
  const { account_auths, weight_threshold } = account.posting;
  const entry = account_auths.find(([name]) => name === serviceAccount);
  return entry !== undefined && entry[1] >= weight_threshold;
}

/**
 * Returns true when hiveUsername has granted posting authority to
 * DEFAULT_HIVE_POSTING_ACCOUNT with weight >= the account's posting threshold.
 * Reused by the scheduled-post cron (commit 2) as a pre-flight check and by
 * the settings page (commit 4) to reflect current on-chain state.
 */
export async function hasGrantedPostingAuthority(
  hiveUsername: string
): Promise<boolean> {
  const service = getServiceConfig();
  if (!service) {
    throw new PostingAuthorityError(
      "DEFAULT_HIVE_POSTING_ACCOUNT or DEFAULT_HIVE_POSTING_KEY is not configured",
      "CONFIG_MISSING"
    );
  }
  return checkAuthority(hiveUsername, service.account);
}

/**
 * Broadcasts ops to Hive signed by DEFAULT_HIVE_POSTING_KEY on behalf of
 * hiveUsername. Ops MUST already have author = hiveUsername — this function
 * only signs and broadcasts; it does not modify the operations.
 *
 * Throws PostingAuthorityError with:
 *   code "NOT_GRANTED"      — authority not present on-chain; nothing was broadcast
 *   code "CONFIG_MISSING"   — env vars absent; nothing was broadcast
 *   code "CONFIG_INVALID"   — env var present but key is malformed; nothing was broadcast
 *   code "BROADCAST_FAILED" — dhive rejected the transaction
 */
export async function broadcastAsUserViaAuthority(
  hiveUsername: string,
  ops: Operation[]
): Promise<TransactionConfirmation> {
  const service = getServiceConfig();
  if (!service) {
    throw new PostingAuthorityError(
      "DEFAULT_HIVE_POSTING_ACCOUNT or DEFAULT_HIVE_POSTING_KEY is not configured",
      "CONFIG_MISSING"
    );
  }

  const granted = await checkAuthority(hiveUsername, service.account);
  if (!granted) {
    throw new PostingAuthorityError(
      `${hiveUsername} has not granted posting authority to ${service.account}`,
      "NOT_GRANTED"
    );
  }

  let privateKey;
  try {
    privateKey = PrivateKey.fromString(service.key);
  } catch (error: any) {
    throw new PostingAuthorityError(
      `DEFAULT_HIVE_POSTING_KEY is malformed: ${error?.message ?? "invalid key"}`,
      "CONFIG_INVALID"
    );
  }

  try {
    return await HiveClient.broadcast.sendOperations(ops, privateKey);
  } catch (error: any) {
    throw new PostingAuthorityError(
      error?.message || "Failed to broadcast operations",
      "BROADCAST_FAILED"
    );
  }
}
