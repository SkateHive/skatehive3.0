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
      // Strip surrounding quotes
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

function redactRow(row) {
  const redacted = { ...row };
  const redactKeys = [
    'refresh_token_hash',
    'token_hash',
    'ciphertext',
    'dek_wrapped',
    'secret_hash',
    'ip_hash',
  ];
  for (const key of redactKeys) {
    if (key in redacted && redacted[key] != null) {
      redacted[key] = '[redacted]';
    }
  }
  return redacted;
}

async function main() {
  const handle = process.argv[2];

  if (!handle) {
    console.error('Usage: pnpm db:snapshot-username <handle>');
    console.error('Example: pnpm db:snapshot-username vladtest33');
    process.exit(1);
  }

  const env = {
    ...process.env,
    ...parseEnvFile(path.join(process.cwd(), '.env.local')),
  };

  if (!env.DATABASE_URL) {
    console.error('DATABASE_URL missing in .env.local');
    process.exit(1);
  }

  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();

  console.log(`\n🔍 Searching for user with handle: "${handle}"\n`);

  // Find user by handle
  const { rows: users } = await client.query(
    `SELECT * FROM userbase_users WHERE LOWER(handle) = LOWER($1)`,
    [handle]
  );

  if (users.length === 0) {
    console.log('❌ No user found with that handle');

    // Search for similar handles
    const { rows: similarUsers } = await client.query(
      `SELECT handle, display_name, id FROM userbase_users
       WHERE handle ILIKE $1
       ORDER BY created_at DESC LIMIT 5`,
      [`%${handle}%`]
    );

    if (similarUsers.length > 0) {
      console.log('\n📝 Similar handles found:');
      similarUsers.forEach(u => console.log(`  - ${u.handle} (${u.display_name || 'no name'}) [${u.id}]`));
    }

    await client.end();
    return;
  }

  const user = users[0];
  console.log('== USERBASE USER ==');
  console.log(redactRow(user));
  console.log('');

  // Get all identities for this user
  const { rows: identities } = await client.query(
    `SELECT * FROM userbase_identities WHERE user_id = $1 ORDER BY created_at ASC`,
    [user.id]
  );

  console.log(`== LINKED IDENTITIES (${identities.length}) ==`);
  if (identities.length === 0) {
    console.log('  (none)');
  } else {
    identities.map(redactRow).forEach((identity, idx) => {
      console.log(`\n[${idx + 1}] ${identity.type.toUpperCase()}`);
      console.log(identity);
    });
  }

  // Get sessions
  const { rows: sessions } = await client.query(
    `SELECT * FROM userbase_sessions WHERE user_id = $1 ORDER BY created_at DESC`,
    [user.id]
  );

  console.log(`\n== ACTIVE SESSIONS (${sessions.length}) ==`);
  if (sessions.length === 0) {
    console.log('  (none)');
  } else {
    sessions.map(redactRow).forEach((session, idx) => {
      console.log(`\n[${idx + 1}] Session ${session.id}`);
      console.log(`  Created: ${session.created_at}`);
      console.log(`  Expires: ${session.expires_at}`);
      console.log(`  IP Hash: ${session.ip_hash || '(none)'}`);
    });
  }

  // Get soft posts for this user (if table exists)
  try {
    const { rows: softPosts } = await client.query(
      `SELECT id, author, permlink, title, created, overlay_metadata
       FROM hive_posts_cache
       WHERE overlay_metadata->>'safe_user' = $1
       ORDER BY created DESC
       LIMIT 5`,
      [user.id]
    );

    console.log(`\n== SOFT POSTS (showing up to 5) ==`);
    if (softPosts.length === 0) {
      console.log('  (none)');
    } else {
      softPosts.forEach((post, idx) => {
        console.log(`\n[${idx + 1}] ${post.title || '(untitled)'}`);
        console.log(`  Author/Permlink: ${post.author}/${post.permlink}`);
        console.log(`  Created: ${post.created}`);
        console.log(`  Metadata: ${JSON.stringify(post.overlay_metadata)}`);
      });
    }
  } catch (error) {
    if (error.code === '42P01') {
      console.log(`\n== SOFT POSTS ==`);
      console.log('  (table not found - skipping)');
    } else {
      throw error;
    }
  }

  console.log('\n✅ Snapshot complete\n');
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
