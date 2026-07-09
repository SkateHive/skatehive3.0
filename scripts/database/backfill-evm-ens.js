#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function loadEnvLocal() {
  const envPath = path.resolve(__dirname, "../../.env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function sqlString(value) {
  if (value == null) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function psql(sql) {
  return execFileSync(
    "psql",
    [process.env.DATABASE_URL, "-At", "-F", "\t", "-c", sql],
    {
      encoding: "utf8",
      env: process.env,
    }
  ).trim();
}

function isPlaceholderDisplayName(value) {
  return !value || value === "Skater" || /^Wallet 0x/i.test(value);
}

function isPlaceholderAvatar(value) {
  return !value || value.startsWith("https://api.dicebear.com/");
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function toHiveSafeBaseHandle(value) {
  const sanitized = slugify(value) || "skater";
  return sanitized.slice(0, 16).replace(/(^-|-$)+/g, "") || "skater";
}

async function hiveHandleExists(handle) {
  const response = await fetch("https://api.hive.blog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "condenser_api.get_accounts",
      params: [[handle]],
      id: 1,
    }),
  });
  if (!response.ok) {
    throw new Error(`Hive lookup failed ${response.status}`);
  }
  const data = await response.json();
  return Array.isArray(data?.result) && data.result.length > 0;
}

function getUniqueUserbaseHandle(candidate) {
  const sql = `
    select count(*)
    from public.userbase_users
    where lower(handle) = lower(${sqlString(candidate)});
  `;
  return Number(psql(sql) || "0") === 0;
}

async function findAvailableHandle(base) {
  const candidate = toHiveSafeBaseHandle(base);
  if (!candidate) return null;
  if (getUniqueUserbaseHandle(candidate) && !(await hiveHandleExists(candidate))) {
    return candidate;
  }
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const suffix = Math.random().toString(16).slice(2, 6);
    const alt = `${candidate.slice(0, 11).replace(/-$/g, "")}-${suffix}`;
    if (getUniqueUserbaseHandle(alt) && !(await hiveHandleExists(alt))) {
      return alt;
    }
  }
  return null;
}

async function resolveEns(address) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  const response = await fetch(
    `https://api.ensideas.com/ens/resolve/${address}`,
    { signal: controller.signal }
  );
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`ENS lookup failed ${response.status}`);
  }

  const data = await response.json();
  return {
    name: typeof data?.name === "string" && data.name.trim() ? data.name.trim() : null,
    avatar:
      typeof data?.avatar === "string" && data.avatar.trim()
        ? data.avatar.trim()
        : null,
  };
}

async function main() {
  loadEnvLocal();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL missing");
  }

  const candidateSql = `
    select
      u.id,
      coalesce(u.handle, ''),
      coalesce(u.display_name, ''),
      coalesce(u.avatar_url, ''),
      i.id,
      lower(i.address)
    from public.userbase_users u
    join public.userbase_identities i
      on i.user_id = u.id
    where i.type = 'evm'
      and i.address is not null
      and u.status = 'active'
      and (
        u.handle like 'wallet-%'
        or u.display_name like 'Wallet 0x%'
        or u.avatar_url is null
        or u.avatar_url = ''
        or u.avatar_url like 'https://api.dicebear.com/%'
        or coalesce(i.metadata->>'ens_name', '') = ''
        or coalesce(i.metadata->>'ens_avatar', '') = ''
      )
    order by u.created_at asc;
  `;

  const rows = psql(candidateSql)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [userId, handle, displayName, avatarUrl, identityId, address] =
        line.split("\t");
      return { userId, handle, displayName, avatarUrl, identityId, address };
    });

  let lookedUp = 0;
  let updatedUsers = 0;
  let updatedIdentities = 0;
  let skipped = 0;
  let resolved = 0;
  let updatedHandles = 0;

  for (const row of rows) {
    lookedUp += 1;

    try {
      const ens = await resolveEns(row.address);

      if (!ens.name && !ens.avatar) {
        skipped += 1;
        continue;
      }

      resolved += 1;

      const metadataSql = `
        update public.userbase_identities
        set metadata = jsonb_strip_nulls(
          coalesce(metadata, '{}'::jsonb) ||
          jsonb_build_object(
            'ens_name', ${sqlString(ens.name)},
            'ens_avatar', ${sqlString(ens.avatar)}
          )
        )
        where id = ${sqlString(row.identityId)};
      `;
      psql(metadataSql);
      updatedIdentities += 1;

      const updates = [];
      if (ens.name && isPlaceholderDisplayName(row.displayName)) {
        updates.push(`display_name = ${sqlString(ens.name)}`);
      }
      if (ens.avatar && isPlaceholderAvatar(row.avatarUrl)) {
        updates.push(`avatar_url = ${sqlString(ens.avatar)}`);
      }
      if (row.handle && row.handle.startsWith("wallet-") && ens.name) {
        const nextHandle = await findAvailableHandle(ens.name);
        if (nextHandle) {
          updates.push(`handle = ${sqlString(nextHandle)}`);
          updatedHandles += 1;
        }
      }

      if (updates.length > 0) {
        const userSql = `
          update public.userbase_users
          set ${updates.join(", ")}
          where id = ${sqlString(row.userId)};
        `;
        psql(userSql);
        updatedUsers += 1;
      }
    } catch (error) {
      console.error(
        `[backfill-evm-ens] ${row.address}: ${error.name === "AbortError" ? "timeout" : error.message}`
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        candidates: rows.length,
        looked_up: lookedUp,
        resolved,
        updated_users: updatedUsers,
        updated_identities: updatedIdentities,
        updated_handles: updatedHandles,
        skipped,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
