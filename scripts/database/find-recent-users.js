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
  } catch {
    return {};
  }
}

async function main() {
  const env = {
    ...process.env,
    ...parseEnvFile(path.join(process.cwd(), '.env.local')),
  };

  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();

  const { rows } = await client.query(`
    SELECT id, handle, display_name, avatar_url, status, created_at
    FROM userbase_users
    WHERE created_at > NOW() - INTERVAL '2 hours'
    ORDER BY created_at DESC
    LIMIT 10
  `);

  console.log('\n📊 Users created in last 2 hours:\n');

  if (rows.length === 0) {
    console.log('   No users found');
  } else {
    rows.forEach((user, idx) => {
      console.log(`[${idx + 1}] ${user.handle}`);
      console.log(`    Display Name: ${user.display_name || '(not set)'}`);
      console.log(`    Created: ${new Date(user.created_at).toLocaleString()}`);
      console.log(`    ID: ${user.id}`);
      console.log('');
    });
  }

  await client.end();
}

main().catch(console.error);
