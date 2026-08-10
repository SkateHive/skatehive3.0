#!/usr/bin/env tsx

import fs from "fs";
import path from "path";
import { Client as PgClient } from "pg";
import { Client as HiveClient, KeyRole, PrivateKey } from "@hiveio/dhive";
import { decryptHivePostingKey, decryptSecret } from "@/lib/userbase/encryption";

type Command = "discover" | "dry-run" | "execute";

interface CliOptions {
  command: Command;
  backupsDir?: string;
  credentialSource: "backups" | "db";
  outputDir: string;
  input?: string;
  usernames?: Set<string>;
  limit?: number;
  inactiveDays: number;
  delayMs: number;
  yes: boolean;
}

interface EligibleUser {
  userId: string;
  email: string | null;
  hiveUsername: string;
  hasPostingKey: boolean;
  postingKeyType: string | null;
  trailOptedIn: boolean;
  lastOrganicActivityAt: string | null;
}

interface BackupCredential {
  sourcePath: string;
  username: string | null;
  activeKey?: string;
  postingKey?: string;
  masterPassword?: string;
}

interface DynamicGlobalProps {
  total_vesting_fund_hive: string;
  total_vesting_shares: string;
}

interface RewardSnapshot {
  hive: string;
  hbd: string;
  vests: string;
  estimatedHp: string;
}

interface UserReportRow {
  userId: string;
  email: string | null;
  hiveUsername: string;
  hasPostingKey: boolean;
  postingKeyType: string | null;
  trailOptedIn: boolean;
  lastOrganicActivityAt: string | null;
  lastOnChainPostAt: string | null;
  status: string;
  reason: string | null;
  rewardHive: string;
  rewardHbd: string;
  rewardVests: string;
  estimatedHp: string;
  backupSource: string | null;
  credentialSource: string | null;
  activePubkey: string | null;
  chainActivePubkeys: string[];
  postingPubkey: string | null;
  chainPostingPubkeys: string[];
  txId?: string | null;
  blockNum?: number | null;
}

const HIVE_NODES = [
  "https://api.hive.blog",
  "https://api.openhive.network",
  "https://api.hivekings.com",
  "https://anyx.io",
];

const ACTIVE_KEY_REGEX = /5[HJK][1-9A-Za-z]{49}/;

function usage(): string {
  return [
    "Skatehive reward claim pipeline",
    "",
    "Usage:",
    "  pnpm rewards:claim discover [--output-dir ./tmp/reward-claims] [--usernames user1,user2]",
    "  pnpm rewards:claim dry-run --backups-dir /path/to/backups [--input ./tmp/reward-claims/discover-*.json]",
    "  pnpm rewards:claim execute --backups-dir /path/to/backups [--input ./tmp/reward-claims/discover-*.json] --yes",
    "  pnpm rewards:claim dry-run --credential-source db [--input ./tmp/reward-claims/discover-*.json]",
    "  pnpm rewards:claim execute --credential-source db [--input ./tmp/reward-claims/discover-*.json] --yes",
    "",
    "Options:",
    "  --credential-source MODE  backups (default) or db",
    "  --backups-dir PATH   Directory with exported backup .json/.txt files",
    "  --input PATH         Optional discover JSON file; defaults to querying DB live",
    "  --output-dir PATH    Where JSON/CSV reports are written",
    "  --usernames LIST     Comma-separated Hive usernames to target",
    "  --limit N            Limit number of users processed",
    "  --inactive-days N    Require no organic activity for N days (default: 30)",
    "  --delay-ms N         Delay between live claims in execute mode (default: 1200)",
    "  --yes                Required confirmation flag for execute mode",
  ].join("\n");
}

function parseArgs(argv: string[]): CliOptions {
  const [commandArg, ...rest] = argv;

  if (!commandArg || commandArg === "help" || commandArg === "--help" || commandArg === "-h") {
    console.log(usage());
    process.exit(0);
  }

  if (!["discover", "dry-run", "execute"].includes(commandArg)) {
    throw new Error(`Unknown command: ${commandArg}`);
  }

  const options: CliOptions = {
    command: commandArg as Command,
    credentialSource: "backups",
    outputDir: path.join(process.cwd(), "tmp", "reward-claims"),
    inactiveDays: 30,
    delayMs: 1200,
    yes: false,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === "--yes") {
      options.yes = true;
      continue;
    }

    const next = rest[index + 1];
    if (!next) {
      throw new Error(`Missing value for ${arg}`);
    }

    switch (arg) {
      case "--credential-source":
        if (next !== "backups" && next !== "db") {
          throw new Error(`Unknown credential source: ${next}`);
        }
        options.credentialSource = next;
        index += 1;
        break;
      case "--backups-dir":
        options.backupsDir = next;
        index += 1;
        break;
      case "--output-dir":
        options.outputDir = next;
        index += 1;
        break;
      case "--input":
        options.input = next;
        index += 1;
        break;
      case "--usernames":
        options.usernames = new Set(
          next
            .split(",")
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean)
        );
        index += 1;
        break;
      case "--limit":
        options.limit = Number.parseInt(next, 10);
        index += 1;
        break;
      case "--inactive-days":
        options.inactiveDays = Number.parseInt(next, 10);
        index += 1;
        break;
      case "--delay-ms":
        options.delayMs = Number.parseInt(next, 10);
        index += 1;
        break;
      default:
        throw new Error(`Unknown flag: ${arg}`);
    }
  }

  if (
    options.credentialSource === "backups" &&
    (options.command === "dry-run" || options.command === "execute") &&
    !options.backupsDir
  ) {
    throw new Error(`${options.command} requires --backups-dir`);
  }

  if (options.command === "execute" && !options.yes) {
    throw new Error("execute requires --yes");
  }

  if (!Number.isInteger(options.inactiveDays) || options.inactiveDays < 1) {
    throw new Error("--inactive-days must be a positive integer");
  }

  return options;
}

function parseEnvFile(filePath: string): Record<string, string> {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const env: Record<string, string> = {};

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }

    return env;
  } catch {
    return {};
  }
}

function loadEnv(): Record<string, string> {
  const envLocal = parseEnvFile(path.join(process.cwd(), ".env.local"));
  return {
    ...envLocal,
    ...Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string")
    ),
  };
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function normalizeUsername(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/^@/, "").toLowerCase();
  return normalized || null;
}

function extractStringNumber(asset: string): number {
  return Number.parseFloat(asset.split(" ")[0] || "0");
}

function formatFixed(value: number, digits = 3): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "0.000";
}

function isPositiveAsset(asset: string): boolean {
  return extractStringNumber(asset) > 0;
}

function parseHiveTimestamp(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const normalized = value.endsWith("Z") ? value : `${value}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithinInactiveWindow(value: unknown, inactiveDays: number): boolean {
  const timestamp = parseHiveTimestamp(value);
  if (!timestamp) return false;
  const cutoff = Date.now() - inactiveDays * 24 * 60 * 60 * 1000;
  return timestamp.getTime() > cutoff;
}

function vestsToHp(vests: string, globals: DynamicGlobalProps): string {
  const totalFund = extractStringNumber(globals.total_vesting_fund_hive);
  const totalShares = extractStringNumber(globals.total_vesting_shares);
  const rewardVests = extractStringNumber(vests);

  if (!totalFund || !totalShares || !rewardVests) {
    return "0.000";
  }

  return formatFixed((rewardVests * totalFund) / totalShares);
}

function collectFiles(rootDir: string): string[] {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }

    if (entry.isFile() && [".json", ".txt"].includes(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

function parseJsonBackup(filePath: string, rawContent: string): BackupCredential | null {
  try {
    const parsed = JSON.parse(rawContent);
    const username = normalizeUsername(parsed.username ?? parsed.hive_username ?? parsed.account);
    const activeKey =
      parsed?.keys?.active?.private ??
      parsed?.keys?.active ??
      parsed?.active_key ??
      parsed?.activeKey;
    const postingKey =
      parsed?.keys?.posting?.private ??
      parsed?.keys?.posting ??
      parsed?.posting_key ??
      parsed?.postingKey;
    const masterPassword = parsed.master_password ?? parsed.masterPassword;

    return {
      sourcePath: filePath,
      username,
      activeKey: typeof activeKey === "string" ? activeKey.trim() : undefined,
      postingKey: typeof postingKey === "string" ? postingKey.trim() : undefined,
      masterPassword: typeof masterPassword === "string" ? masterPassword.trim() : undefined,
    };
  } catch {
    return null;
  }
}

function parseTextBackup(filePath: string, rawContent: string): BackupCredential {
  const usernameMatch = rawContent.match(
    /(?:Username|Nome de usu[aá]rio):\s*@?([a-z0-9.-]+)/i
  );
  const activeKeyMatch = rawContent.match(/Active:\s*(5[HJK][1-9A-Za-z]{49})/i);
  const postingKeyMatch = rawContent.match(/Posting:\s*(5[HJK][1-9A-Za-z]{49})/i);
  const masterPasswordMatch = rawContent.match(
    /(?:Master Password|Senha Mestra):\s*(\S+)/i
  );

  let username = normalizeUsername(usernameMatch?.[1]);
  if (!username) {
    const filenameMatch = path.basename(filePath).match(/hive-keys-([a-z0-9.-]+)/i);
    username = normalizeUsername(filenameMatch?.[1]);
  }

  return {
    sourcePath: filePath,
    username,
    activeKey: activeKeyMatch?.[1],
    postingKey: postingKeyMatch?.[1],
    masterPassword: masterPasswordMatch?.[1],
  };
}

function loadBackupCredentials(backupsDir: string): Map<string, BackupCredential> {
  const credentials = new Map<string, BackupCredential>();

  for (const filePath of collectFiles(backupsDir)) {
    const rawContent = fs.readFileSync(filePath, "utf8");
    const parsed =
      path.extname(filePath).toLowerCase() === ".json"
        ? parseJsonBackup(filePath, rawContent) ?? parseTextBackup(filePath, rawContent)
        : parseTextBackup(filePath, rawContent);

    if (!parsed.username) continue;
    if (!parsed.activeKey && !parsed.masterPassword) continue;
    if (!credentials.has(parsed.username)) {
      credentials.set(parsed.username, parsed);
    }
  }

  return credentials;
}

function deriveActiveKey(username: string, credential: BackupCredential): string | null {
  if (credential.activeKey) {
    return credential.activeKey;
  }
  if (credential.masterPassword) {
    return PrivateKey.fromLogin(username, credential.masterPassword, "active" as KeyRole).toString();
  }
  return null;
}

function derivePostingKey(username: string, credential: BackupCredential): string | null {
  if (credential.postingKey) {
    return credential.postingKey;
  }
  if (credential.masterPassword) {
    return PrivateKey.fromLogin(username, credential.masterPassword, "posting" as KeyRole).toString();
  }
  return null;
}

function chainActivePubkeys(account: any): string[] {
  const keyAuths = account?.active?.key_auths;
  if (!Array.isArray(keyAuths)) {
    return [];
  }

  return keyAuths
    .map((entry: unknown) => (Array.isArray(entry) ? entry[0] : null))
    .filter((value): value is string => typeof value === "string");
}

function chainPostingPubkeys(account: any): string[] {
  const keyAuths = account?.posting?.key_auths;
  if (!Array.isArray(keyAuths)) {
    return [];
  }

  return keyAuths
    .map((entry: unknown) => (Array.isArray(entry) ? entry[0] : null))
    .filter((value): value is string => typeof value === "string");
}

function toCsv(rows: UserReportRow[]): string {
  const headers = [
    "userId",
    "email",
    "hiveUsername",
    "hasPostingKey",
    "postingKeyType",
    "trailOptedIn",
    "lastOrganicActivityAt",
    "lastOnChainPostAt",
    "status",
    "reason",
    "rewardHive",
    "rewardHbd",
    "rewardVests",
    "estimatedHp",
    "backupSource",
    "credentialSource",
    "activePubkey",
    "chainActivePubkeys",
    "postingPubkey",
    "chainPostingPubkeys",
    "txId",
    "blockNum",
  ];

  const escapeValue = (value: unknown) => {
    const stringValue =
      value == null
        ? ""
        : Array.isArray(value)
          ? value.join("|")
          : String(value);
    return `"${stringValue.replace(/"/g, '""')}"`;
  };

  return [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => escapeValue((row as unknown as Record<string, unknown>)[header]))
        .join(",")
    ),
  ].join("\n");
}

function writeReport(outputDir: string, prefix: string, payload: unknown, csvRows?: UserReportRow[]): string {
  ensureDir(outputDir);
  const baseName = `${prefix}-${timestamp()}`;
  const jsonPath = path.join(outputDir, `${baseName}.json`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  if (csvRows) {
    const csvPath = path.join(outputDir, `${baseName}.csv`);
    fs.writeFileSync(csvPath, `${toCsv(csvRows)}\n`, "utf8");
  }

  return jsonPath;
}

function readEligibleUsersFromFile(filePath: string): EligibleUser[] {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (Array.isArray(parsed)) {
    return parsed as EligibleUser[];
  }
  if (Array.isArray(parsed.users)) {
    return parsed.users as EligibleUser[];
  }
  throw new Error(`Unsupported input format: ${filePath}`);
}

async function createDbClient(env: Record<string, string>): Promise<PgClient> {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required in .env.local or environment");
  }

  const client = new PgClient({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

async function loadDbCredentials(
  db: PgClient,
  users: EligibleUser[]
): Promise<Map<string, BackupCredential>> {
  if (users.length === 0) {
    return new Map();
  }

  const result = await db.query(
    `
      select
        user_id as "userId",
        lower(hive_username) as "hiveUsername",
        encrypted_posting_key as "encryptedPostingKey",
        encryption_iv as "encryptionIv",
        encryption_auth_tag as "encryptionAuthTag"
      from userbase_hive_keys
      where user_id = any($1)
    `,
    [users.map((user) => user.userId)]
  );

  const credentials = new Map<string, BackupCredential>();
  for (const row of result.rows as Array<{
    userId: string;
    hiveUsername: string;
    encryptedPostingKey: string;
    encryptionIv: string;
    encryptionAuthTag: string;
  }>) {
    try {
      let postingKey: string;
      try {
        postingKey = decryptHivePostingKey(
          {
            encryptedKey: row.encryptedPostingKey,
            iv: row.encryptionIv,
            authTag: row.encryptionAuthTag,
          },
          row.userId
        );
      } catch {
        postingKey = decryptSecret(
          JSON.stringify({
            v: 1,
            iv: row.encryptionIv,
            tag: row.encryptionAuthTag,
            data: row.encryptedPostingKey,
          })
        );
      }

      credentials.set(row.hiveUsername, {
        sourcePath: "userbase_hive_keys",
        username: row.hiveUsername,
        postingKey,
      });
    } catch {
      credentials.set(row.hiveUsername, {
        sourcePath: "userbase_hive_keys",
        username: row.hiveUsername,
      });
    }
  }

  return credentials;
}

async function discoverEligibleUsers(db: PgClient, options: CliOptions): Promise<EligibleUser[]> {
  const values: unknown[] = ["active", options.inactiveDays];
  let whereClause = `
    where u.status = $1
      and i.type = 'hive'
      and hk.user_id is not null
      and coalesce(hk.trail_opt_out, false) = false
      and activity.last_organic_activity_at <= now() - make_interval(days => $2)
  `;

  if (options.usernames?.size) {
    values.push([...options.usernames]);
    whereClause += ` and lower(i.handle) = any($${values.length})`;
  }

  if (options.limit) {
    values.push(options.limit);
  }

  const query = `
    select
      u.id as "userId",
      lower(i.handle) as "hiveUsername",
      am.identifier as email,
      (hk.user_id is not null) as "hasPostingKey",
      hk.key_type as "postingKeyType",
      (coalesce(hk.trail_opt_out, false) = false) as "trailOptedIn",
      activity.last_organic_activity_at::text as "lastOrganicActivityAt"
    from userbase_users u
    join userbase_identities i
      on i.user_id = u.id
    left join lateral (
      select auth.identifier
      from userbase_auth_methods auth
      where auth.user_id = u.id and auth.type = 'email_magic'
      order by auth.last_used_at desc nulls last, auth.created_at desc
      limit 1
    ) am on true
    left join userbase_hive_keys hk
      on hk.user_id = u.id
    cross join lateral (
      select greatest(
        u.created_at,
        u.updated_at,
        (select max(auth.last_used_at) from userbase_auth_methods auth where auth.user_id = u.id),
        (select max(session.created_at) from userbase_sessions session where session.user_id = u.id),
        (select max(post.created_at) from userbase_soft_posts post where post.user_id = u.id),
        (select max(vote.created_at) from userbase_soft_votes vote where vote.user_id = u.id)
      ) as last_organic_activity_at
    ) activity
    ${whereClause}
    order by lower(i.handle) asc
    ${options.limit ? `limit $${values.length}` : ""}
  `;

  const result = await db.query(query, values);
  return result.rows as EligibleUser[];
}

async function fetchRewardSnapshot(
  hiveClient: HiveClient,
  hiveUsername: string,
  globals: DynamicGlobalProps
): Promise<{ account: any | null; rewards: RewardSnapshot }> {
  const [account] = await hiveClient.database.getAccounts([hiveUsername]);

  if (!account) {
    return {
      account: null,
      rewards: {
        hive: "0.000 HIVE",
        hbd: "0.000 HBD",
        vests: "0.000000 VESTS",
        estimatedHp: "0.000",
      },
    };
  }

  const rewardHive = String(account.reward_hive_balance ?? "0.000 HIVE");
  const rewardHbd = String(account.reward_hbd_balance ?? "0.000 HBD");
  const rewardVests = String(account.reward_vesting_balance ?? "0.000000 VESTS");

  const rewards = {
    hive: rewardHive,
    hbd: rewardHbd,
    vests: rewardVests,
    estimatedHp: vestsToHp(rewardVests, globals),
  };

  return { account, rewards };
}

async function buildUserReport(
  users: EligibleUser[],
  hiveClient: HiveClient,
  options: CliOptions,
  db?: PgClient | null
): Promise<UserReportRow[]> {
  const credentials =
    options.credentialSource === "db"
      ? await loadDbCredentials(db as PgClient, users)
      : loadBackupCredentials(options.backupsDir as string);
  const globals = (await hiveClient.database.getDynamicGlobalProperties()) as DynamicGlobalProps;
  const rows: UserReportRow[] = [];

  for (const user of users) {
    const credential = credentials.get(user.hiveUsername);
    const { account, rewards } = await fetchRewardSnapshot(hiveClient, user.hiveUsername, globals);

    const row: UserReportRow = {
      userId: user.userId,
      email: user.email,
      hiveUsername: user.hiveUsername,
      hasPostingKey: user.hasPostingKey,
      postingKeyType: user.postingKeyType,
      trailOptedIn: user.trailOptedIn === true,
      lastOrganicActivityAt: user.lastOrganicActivityAt ?? null,
      lastOnChainPostAt:
        typeof account?.last_post === "string" ? account.last_post : null,
      status: "unknown",
      reason: null,
      rewardHive: rewards.hive,
      rewardHbd: rewards.hbd,
      rewardVests: rewards.vests,
      estimatedHp: rewards.estimatedHp,
      backupSource: credential?.sourcePath ?? null,
      credentialSource: credential?.activeKey
        ? "active_key"
        : credential?.masterPassword
          ? "master_password"
          : credential?.postingKey
            ? options.credentialSource === "db"
              ? "db_posting_key"
              : "posting_key"
          : null,
      activePubkey: null,
      chainActivePubkeys: chainActivePubkeys(account),
      postingPubkey: null,
      chainPostingPubkeys: chainPostingPubkeys(account),
      txId: null,
      blockNum: null,
    };

    if (!account) {
      row.status = "missing_on_chain_account";
      row.reason = "Hive account not found on chain";
      rows.push(row);
      continue;
    }

    if (!row.trailOptedIn) {
      row.status = "trail_opted_out";
      row.reason = "User is not opted into the SkateHive curation trail";
      rows.push(row);
      continue;
    }

    if (isWithinInactiveWindow(row.lastOnChainPostAt, options.inactiveDays)) {
      row.status = "recent_onchain_activity";
      row.reason = `Account posted or commented within the last ${options.inactiveDays} days`;
      rows.push(row);
      continue;
    }

    if (!credential) {
      row.status = "missing_backup";
      row.reason = "No backup file with active key or master password was found";
      rows.push(row);
      continue;
    }

    const postingKey = derivePostingKey(user.hiveUsername, credential);
    if (!postingKey) {
      row.status = "invalid_credential";
      row.reason =
        options.credentialSource === "db"
          ? "Stored posting key could not be decrypted"
          : "Backup found but posting credential could not be derived";
      rows.push(row);
      continue;
    }

    const postingPubkey = PrivateKey.fromString(postingKey).createPublic().toString();
    row.postingPubkey = postingPubkey;

    if (!row.chainPostingPubkeys.includes(postingPubkey)) {
      row.status = "posting_mismatch";
      row.reason = "Derived posting pubkey does not match chain authority";
      rows.push(row);
      continue;
    }

    if (options.credentialSource !== "db") {
      const activeKey = deriveActiveKey(user.hiveUsername, credential);
      if (!activeKey || !ACTIVE_KEY_REGEX.test(activeKey)) {
        row.status = "invalid_credential";
        row.reason = "Backup found but active credential could not be derived";
        rows.push(row);
        continue;
      }

      const activePubkey = PrivateKey.fromString(activeKey).createPublic().toString();
      row.activePubkey = activePubkey;

      if (!row.chainActivePubkeys.includes(activePubkey)) {
        row.status = "active_mismatch";
        row.reason = "Derived active pubkey does not match chain authority";
        rows.push(row);
        continue;
      }
    }

    const hasRewards =
      isPositiveAsset(rewards.hive) ||
      isPositiveAsset(rewards.hbd) ||
      isPositiveAsset(rewards.vests);

    if (!hasRewards) {
      row.status = "no_rewards";
      row.reason = "Account has no pending rewards";
      rows.push(row);
      continue;
    }

    row.status = "ready";
    row.reason = null;
    rows.push(row);
  }

  return rows;
}

async function executeClaims(
  rows: UserReportRow[],
  users: EligibleUser[],
  hiveClient: HiveClient,
  options: CliOptions,
  db?: PgClient | null
): Promise<UserReportRow[]> {
  const credentials =
    options.credentialSource === "db"
      ? await loadDbCredentials(db as PgClient, users)
      : loadBackupCredentials(options.backupsDir as string);
  const globals = (await hiveClient.database.getDynamicGlobalProperties()) as DynamicGlobalProps;
  const executedRows: UserReportRow[] = [];

  for (const row of rows) {
    if (row.status !== "ready") {
      executedRows.push(row);
      continue;
    }

    const credential = credentials.get(row.hiveUsername);
    if (!credential) {
      executedRows.push({
        ...row,
        status: "missing_backup",
        reason: "Backup disappeared before execute phase",
      });
      continue;
    }

    const postingKey = derivePostingKey(row.hiveUsername, credential);
    if (!postingKey) {
      executedRows.push({
        ...row,
        status: "invalid_credential",
        reason: "Posting key could not be derived at execute time",
      });
      continue;
    }

    const { account, rewards } = await fetchRewardSnapshot(hiveClient, row.hiveUsername, globals);
    if (!account) {
      executedRows.push({
        ...row,
        status: "missing_on_chain_account",
        reason: "Hive account not found during execute",
      });
      continue;
    }


    if (isWithinInactiveWindow(account.last_post, options.inactiveDays)) {
      executedRows.push({
        ...row,
        status: "recent_onchain_activity",
        reason: `Account posted or commented within the last ${options.inactiveDays} days`,
        lastOnChainPostAt: String(account.last_post),
      });
      continue;
    }

    const hasRewards =
      isPositiveAsset(rewards.hive) ||
      isPositiveAsset(rewards.hbd) ||
      isPositiveAsset(rewards.vests);

    if (!hasRewards) {
      executedRows.push({
        ...row,
        status: "already_claimed",
        reason: "No rewards remained at execute time",
        rewardHive: rewards.hive,
        rewardHbd: rewards.hbd,
        rewardVests: rewards.vests,
        estimatedHp: rewards.estimatedHp,
      });
      continue;
    }

    try {
      const result = await hiveClient.broadcast.sendOperations(
        [
          [
            "claim_reward_balance",
            {
              account: row.hiveUsername,
              reward_hive: rewards.hive,
              reward_hbd: rewards.hbd,
              reward_vests: rewards.vests,
            },
          ],
        ],
        PrivateKey.fromString(postingKey)
      );

      executedRows.push({
        ...row,
        status: "claimed",
        reason: null,
        rewardHive: rewards.hive,
        rewardHbd: rewards.hbd,
        rewardVests: rewards.vests,
        estimatedHp: rewards.estimatedHp,
        txId: result.id,
        blockNum: result.block_num,
      });
    } catch (error) {
      executedRows.push({
        ...row,
        status: "claim_failed",
        reason: error instanceof Error ? error.message : "Unknown broadcast error",
        rewardHive: rewards.hive,
        rewardHbd: rewards.hbd,
        rewardVests: rewards.vests,
        estimatedHp: rewards.estimatedHp,
      });
    }

    if (options.credentialSource === "db") {
      await db
        ?.query(`update userbase_hive_keys set last_used_at = now() where lower(hive_username) = $1`, [
          row.hiveUsername,
        ])
        .catch(() => undefined);
    }

    if (options.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
  }

  return executedRows;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  Object.assign(process.env, env);
  const hiveClient = new HiveClient(HIVE_NODES);
  const needsDb = !options.input || options.credentialSource === "db";
  const db = needsDb ? await createDbClient(env) : null;

  try {
    if (options.command === "discover") {
      const users = db
        ? await discoverEligibleUsers(db, options)
        : readEligibleUsersFromFile(options.input as string);

      const outputPath = writeReport(
        options.outputDir,
        "reward-discover",
        {
          createdAt: new Date().toISOString(),
          inactiveDays: options.inactiveDays,
          totalUsers: users.length,
          users,
        }
      );

      console.log(`Discovered ${users.length} eligible users`);
      console.log(`Report written to ${outputPath}`);
      return;
    }

    const users = options.input
      ? readEligibleUsersFromFile(options.input)
      : await discoverEligibleUsers(db as PgClient, options);

    const dryRunRows = await buildUserReport(users, hiveClient, options, db);
    const readyCount = dryRunRows.filter((row) => row.status === "ready").length;

    const dryRunReport = {
      createdAt: new Date().toISOString(),
      inactiveDays: options.inactiveDays,
      totalUsers: dryRunRows.length,
      readyCount,
      rows: dryRunRows,
    };

    const dryRunPath = writeReport(options.outputDir, "reward-dry-run", dryRunReport, dryRunRows);
    console.log(`Dry-run ready: ${readyCount}/${dryRunRows.length}`);
    console.log(`Report written to ${dryRunPath}`);

    if (options.command === "dry-run") {
      return;
    }

    const executedRows = await executeClaims(
      dryRunRows,
      users,
      hiveClient,
      options,
      db
    );
    const claimedCount = executedRows.filter((row) => row.status === "claimed").length;

    const executeReport = {
      createdAt: new Date().toISOString(),
      inactiveDays: options.inactiveDays,
      totalUsers: executedRows.length,
      claimedCount,
      rows: executedRows,
    };

    const executePath = writeReport(options.outputDir, "reward-execute", executeReport, executedRows);
    console.log(`Claims executed: ${claimedCount}/${executedRows.length}`);
    console.log(`Report written to ${executePath}`);
  } finally {
    await db?.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
