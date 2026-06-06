#!/usr/bin/env node
/**
 * Run an ad-hoc SELECT (or other read-only query) against Supabase.
 * For inspection / verification, not production use.
 *
 * Usage:
 *   node scripts/database/query-sql.js <path-to-sql-file>
 *   echo "select 1" | node scripts/database/query-sql.js -
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnvLocal() {
  const envPath = path.resolve(__dirname, '../../.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

async function main() {
  loadEnvLocal();
  const file = process.argv[2];
  let sql;
  if (file === '-') {
    sql = fs.readFileSync(0, 'utf8');
  } else if (file) {
    sql = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
  } else {
    console.error('Usage: node scripts/database/query-sql.js <file|->');
    process.exit(2);
  }
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const res = await client.query(sql);
    if (Array.isArray(res)) {
      for (const r of res) {
        console.log(JSON.stringify(r.rows, null, 2));
      }
    } else {
      console.log(JSON.stringify(res.rows, null, 2));
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('error:', err.message);
  process.exit(1);
});
