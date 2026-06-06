#!/usr/bin/env node
/**
 * Run a single SQL migration file against the Supabase Postgres instance.
 *
 * Usage:
 *   node scripts/database/run-migration.js sql/migrations/0022_spotmap_spots.sql
 *
 * Reads DATABASE_URL from .env.local (parsed inline so this script has no
 * runtime deps other than the already-installed `pg`). The whole file runs
 * inside a single transaction — anything that fails rolls back.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnvLocal() {
  const envPath = path.resolve(__dirname, '../../.env.local');
  if (!fs.existsSync(envPath)) return;
  const src = fs.readFileSync(envPath, 'utf8');
  for (const line of src.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // Strip wrapping quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

async function main() {
  loadEnvLocal();

  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/database/run-migration.js <path-to-sql-file>');
    process.exit(2);
  }

  const sqlPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(sqlPath)) {
    console.error(`Migration file not found: ${sqlPath}`);
    process.exit(2);
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    console.error('DATABASE_URL is not set');
    process.exit(2);
  }

  const client = new Client({
    connectionString: connStr,
    // Supabase requires SSL; node-postgres is happy with a relaxed check
    // against the cert provided by the pooler.
    ssl: { rejectUnauthorized: false },
  });

  console.log(`▶ Running migration: ${path.basename(sqlPath)}`);
  console.log(`  Target: ${new URL(connStr.replace('postgres://', 'postgresql://')).hostname}`);

  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration applied');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // already closed
    }
    console.error('❌ Migration failed:', err.message);
    if (err.position) console.error('   position:', err.position);
    if (err.detail) console.error('   detail:', err.detail);
    if (err.hint) console.error('   hint:', err.hint);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
