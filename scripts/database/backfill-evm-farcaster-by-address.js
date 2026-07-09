#!/usr/bin/env node
/**
 * Backfill Farcaster data for EVM-only placeholder users via Neynar.
 *
 * What it does:
 * - finds EVM users with placeholder profile and no linked Farcaster identity
 * - resolves Farcaster profile by wallet address using Neynar bulk-by-address
 * - stores farcaster_* fields in the EVM identity metadata
 * - promotes display_name/avatar_url on placeholder users
 * - creates a Farcaster identity when the FID is not already linked elsewhere
 *
 * This script is intentionally conservative:
 * - it does not auto-merge users
 * - it skips Farcaster identity creation when the resolved FID belongs to
 *   another user already present in the database
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function parseEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const env = {};
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
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

const env = {
  ...process.env,
  ...parseEnvFile(path.join(process.cwd(), ".env.local")),
};

const DATABASE_URL = env.DATABASE_URL || env.POSTGRES_URL;
const NEYNAR_API_KEY = env.NEYNAR_API_KEY;
const BATCH_SIZE = 50;

function sqlString(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function runSql(sql) {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL/POSTGRES_URL missing");
  }
  return execFileSync("psql", [DATABASE_URL, "-Atc", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function queryJson(sql) {
  const wrapped = `
    select coalesce(json_agg(row_to_json(t)), '[]'::json)::text
    from (
      ${sql}
    ) t;
  `;
  const output = runSql(wrapped);
  return output ? JSON.parse(output) : [];
}

function normalizeAddress(address) {
  return typeof address === "string" ? address.toLowerCase() : null;
}

function normalizeAddressList(values) {
  if (!Array.isArray(values)) return [];
  const normalized = values
    .map(normalizeAddress)
    .filter((value) => value && /^0x[a-f0-9]{40}$/.test(value));
  return [...new Set(normalized)];
}

function isPlaceholderDisplayName(value) {
  if (!value) return true;
  return value === "Skater" || /^Wallet 0x/i.test(value);
}

function isPlaceholderAvatar(value) {
  if (!value) return true;
  return value.startsWith("https://api.dicebear.com/");
}

async function fetchProfilesByAddresses(addresses) {
  if (addresses.length === 0) return {};

  const url = `https://api.neynar.com/v2/farcaster/user/bulk-by-address/?addresses=${encodeURIComponent(
    addresses.join(",")
  )}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      api_key: NEYNAR_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Neynar error ${response.status}: ${response.statusText}`);
  }

  const payload = await response.json();
  const result = {};

  for (const address of addresses) {
    const matches = Array.isArray(payload[address]) ? payload[address] : [];
    const user = matches[0];
    if (!user || !user.fid) continue;

    const verifications = normalizeAddressList([
      ...(Array.isArray(user.verifications) ? user.verifications : []),
      ...(Array.isArray(user.verified_addresses?.eth_addresses)
        ? user.verified_addresses.eth_addresses
        : []),
    ]);

    result[address] = {
      fid: String(user.fid),
      username: typeof user.username === "string" ? user.username : null,
      displayName:
        typeof user.display_name === "string" ? user.display_name : null,
      pfpUrl: typeof user.pfp_url === "string" ? user.pfp_url : null,
      bio:
        typeof user.profile?.bio?.text === "string"
          ? user.profile.bio.text
          : null,
      custodyAddress: normalizeAddress(user.custody_address),
      verifications,
    };
  }

  return result;
}

function buildEvmMetadata(existing, profile) {
  return {
    ...(existing || {}),
    farcaster_fid: profile.fid,
    farcaster_username: profile.username,
    farcaster_display_name: profile.displayName,
    farcaster_pfp_url: profile.pfpUrl,
    farcaster_bio: profile.bio,
    farcaster_custody_address: profile.custodyAddress,
    farcaster_verifications: profile.verifications,
    resolved_via: "neynar",
    farcaster_profile_backfilled_at: new Date().toISOString(),
  };
}

function buildFarcasterMetadata(profile) {
  return {
    pfp_url: profile.pfpUrl,
    display_name: profile.displayName,
    bio: profile.bio,
    verifications: profile.verifications,
    resolved_via: "neynar_wallet_backfill",
    auto_linked_from_wallet: true,
  };
}

async function main() {
  if (!NEYNAR_API_KEY) {
    throw new Error("NEYNAR_API_KEY missing");
  }

  console.log("\n🔍 Finding EVM placeholder users without Farcaster identity...\n");

  const candidates = queryJson(`
    with fc_users as (
      select distinct user_id
      from userbase_identities
      where type = 'farcaster'
    )
    select
      u.id as user_id,
      u.handle as user_handle,
      u.display_name,
      u.avatar_url,
      i.id as evm_identity_id,
      lower(i.address) as address,
      coalesce(i.metadata, '{}'::jsonb) as metadata
    from userbase_users u
    join userbase_identities i
      on i.user_id = u.id
     and i.type = 'evm'
    left join fc_users fc
      on fc.user_id = u.id
    where fc.user_id is null
      and i.address is not null
      and (
        u.display_name ~ '^Wallet 0x'
        or u.handle ~ '^wallet-'
        or coalesce(u.avatar_url, '') like 'https://api.dicebear.com/%'
      )
    order by u.created_at desc
  `);

  console.log(`Found ${candidates.length} candidates.`);
  if (candidates.length === 0) return;

  const allResolved = new Map();

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const addresses = batch.map((item) => item.address);
    const resolved = await fetchProfilesByAddresses(addresses);
    for (const [address, profile] of Object.entries(resolved)) {
      allResolved.set(address, profile);
    }
    console.log(
      `  • batch ${Math.floor(i / BATCH_SIZE) + 1}: ${Object.keys(resolved).length}/${batch.length} resolved`
    );
  }

  const resolvedFids = [...new Set(
    [...allResolved.values()].map((profile) => profile.fid).filter(Boolean)
  )];

  const existingFarcasterIdentities =
    resolvedFids.length > 0
      ? queryJson(`
          select user_id, external_id, handle
          from userbase_identities
          where type = 'farcaster'
            and external_id = any(array[${resolvedFids.map(sqlString).join(",")}])
        `)
      : [];

  const farcasterByFid = new Map(
    existingFarcasterIdentities.map((item) => [String(item.external_id), item])
  );

  let resolvedCount = 0;
  let userProfileUpdates = 0;
  let evmMetadataUpdates = 0;
  let insertedFarcasterIdentities = 0;
  let updatedSameUserFarcasterIdentities = 0;
  let conflictingFids = 0;

  for (const candidate of candidates) {
    const profile = allResolved.get(candidate.address);
    if (!profile) continue;
    resolvedCount++;

    const nextMetadata = buildEvmMetadata(candidate.metadata, profile);
    runSql(`
      update userbase_identities
      set metadata = ${sqlJson(nextMetadata)}
      where id = ${sqlString(candidate.evm_identity_id)}
    `);
    evmMetadataUpdates++;

    const userUpdates = [];
    if (
      isPlaceholderDisplayName(candidate.display_name) &&
      (profile.displayName || profile.username)
    ) {
      userUpdates.push(
        `display_name = ${sqlString(profile.displayName || profile.username)}`
      );
    }
    if (isPlaceholderAvatar(candidate.avatar_url) && profile.pfpUrl) {
      userUpdates.push(`avatar_url = ${sqlString(profile.pfpUrl)}`);
    }
    if (userUpdates.length > 0) {
      runSql(`
        update userbase_users
        set ${userUpdates.join(", ")}
        where id = ${sqlString(candidate.user_id)}
      `);
      userProfileUpdates++;
    }

    const existingFarcaster = farcasterByFid.get(profile.fid);
    if (existingFarcaster && existingFarcaster.user_id !== candidate.user_id) {
      conflictingFids++;
      continue;
    }

    const farcasterMetadata = buildFarcasterMetadata(profile);
    if (existingFarcaster && existingFarcaster.user_id === candidate.user_id) {
      runSql(`
        update userbase_identities
        set
          handle = coalesce(handle, ${sqlString(profile.username)}),
          address = coalesce(address, ${sqlString(profile.custodyAddress)}),
          metadata = ${sqlJson(farcasterMetadata)}
        where type = 'farcaster'
          and external_id = ${sqlString(profile.fid)}
          and user_id = ${sqlString(candidate.user_id)}
      `);
      updatedSameUserFarcasterIdentities++;
      continue;
    }

    runSql(`
      insert into userbase_identities (
        user_id,
        type,
        handle,
        address,
        external_id,
        is_primary,
        verified_at,
        metadata
      ) values (
        ${sqlString(candidate.user_id)},
        'farcaster',
        ${sqlString(profile.username)},
        ${sqlString(profile.custodyAddress)},
        ${sqlString(profile.fid)},
        false,
        now(),
        ${sqlJson(farcasterMetadata)}
      )
    `);
    farcasterByFid.set(profile.fid, {
      user_id: candidate.user_id,
      external_id: profile.fid,
      handle: profile.username,
    });
    insertedFarcasterIdentities++;
  }

  console.log("\n📊 Backfill summary:");
  console.log(`   candidates: ${candidates.length}`);
  console.log(`   resolved via Neynar: ${resolvedCount}`);
  console.log(`   evm metadata updated: ${evmMetadataUpdates}`);
  console.log(`   user profiles promoted: ${userProfileUpdates}`);
  console.log(`   farcaster identities inserted: ${insertedFarcasterIdentities}`);
  console.log(
    `   farcaster identities updated on same user: ${updatedSameUserFarcasterIdentities}`
  );
  console.log(`   conflicting existing FIDs skipped: ${conflictingFids}\n`);
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Backfill failed:", error.message);
  process.exit(1);
});
