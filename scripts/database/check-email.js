const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function parseEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const env = {};
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
    return env;
  } catch (error) {
    console.error(`Failed to read .env.local: ${error.message}`);
    return {};
  }
}

const envPath = path.join(__dirname, '../../.env.local');
const env = parseEnvFile(envPath);
const DATABASE_URL = env.DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env.local');
  process.exit(1);
}

async function main() {
  const userId = process.argv[2];

  if (!userId) {
    console.error("Usage: node check-email.js <user_id>");
    process.exit(1);
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    const result = await client.query(
      `SELECT identifier FROM userbase_auth_methods WHERE user_id = $1 AND type = 'email_magic'`,
      [userId]
    );

    if (result.rows.length === 0) {
      console.log("No email auth method found for this user");
    } else {
      console.log("Email:", result.rows[0].identifier);
    }
  } finally {
    await client.end();
  }
}

main().catch(console.error);
