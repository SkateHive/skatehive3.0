/**
 * Backfill script to fetch missing Farcaster profile data for existing identities
 * Usage: pnpm db:backfill-farcaster
 */

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

async function fetchFarcasterProfile(fid, apiKey) {
  try {
    const url = `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'api_key': apiKey,
      },
    });

    if (!response.ok) {
      console.error(`  ❌ Neynar API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    if (!data.users || data.users.length === 0) {
      console.warn(`  ⚠️  No user found for FID: ${fid}`);
      return null;
    }

    const user = data.users[0];

    const verifications = [];
    if (user.verifications) {
      verifications.push(...user.verifications);
    }
    if (user.verified_addresses?.eth_addresses) {
      verifications.push(...user.verified_addresses.eth_addresses);
    }

    return {
      fid: user.fid,
      username: user.username,
      displayName: user.display_name,
      pfpUrl: user.pfp_url,
      bio: user.profile?.bio?.text,
      custodyAddress: user.custody_address,
      verifications: [...new Set(verifications)],
    };
  } catch (error) {
    console.error(`  ❌ Failed to fetch profile for FID ${fid}:`, error.message);
    return null;
  }
}

async function main() {
  const env = {
    ...process.env,
    ...parseEnvFile(path.join(process.cwd(), '.env.local')),
  };

  if (!env.DATABASE_URL) {
    console.error('❌ DATABASE_URL missing in .env.local');
    process.exit(1);
  }

  if (!env.NEYNAR_API_KEY) {
    console.error('❌ NEYNAR_API_KEY missing in .env.local');
    console.error('Please add your Neynar API key to .env.local');
    process.exit(1);
  }

  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();

  console.log('\n🔍 Finding Farcaster identities with incomplete profile data...\n');

  // Find Farcaster identities that are missing pfp_url, display_name, or bio
  const { rows: identities } = await client.query(`
    SELECT id, user_id, handle, address, external_id, metadata
    FROM userbase_identities
    WHERE type = 'farcaster'
      AND external_id IS NOT NULL
      AND (
        metadata->>'pfp_url' IS NULL
        OR metadata->>'display_name' IS NULL
        OR metadata->>'bio' IS NULL
      )
    ORDER BY created_at DESC
  `);

  if (identities.length === 0) {
    console.log('✅ All Farcaster identities already have complete profile data!');
    await client.end();
    return;
  }

  console.log(`Found ${identities.length} Farcaster identities to backfill:\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const identity of identities) {
    const fid = identity.external_id;
    const currentMetadata = identity.metadata || {};

    console.log(`📝 FID ${fid} (@${identity.handle || 'unknown'})`);
    console.log(`   Current data: pfp=${!!currentMetadata.pfp_url}, name=${!!currentMetadata.display_name}, bio=${!!currentMetadata.bio}`);

    // Fetch from Neynar
    const profile = await fetchFarcasterProfile(fid, env.NEYNAR_API_KEY);

    if (!profile) {
      console.log(`   ⏭️  Skipped\n`);
      skipCount++;
      continue;
    }

    // Merge new data with existing metadata (preserve existing fields)
    const updatedMetadata = { ...currentMetadata };
    let hasUpdates = false;

    if (profile.pfpUrl && !currentMetadata.pfp_url) {
      updatedMetadata.pfp_url = profile.pfpUrl;
      hasUpdates = true;
    }

    if (profile.displayName && !currentMetadata.display_name) {
      updatedMetadata.display_name = profile.displayName;
      hasUpdates = true;
    }

    if (profile.bio && !currentMetadata.bio) {
      updatedMetadata.bio = profile.bio;
      hasUpdates = true;
    }

    if (profile.verifications && profile.verifications.length > 0) {
      updatedMetadata.verifications = profile.verifications;
      hasUpdates = true;
    }

    if (!hasUpdates) {
      console.log(`   ℹ️  No new data to add\n`);
      skipCount++;
      continue;
    }

    // Update database
    try {
      await client.query(
        `UPDATE userbase_identities
         SET metadata = $1,
             handle = COALESCE(handle, $2),
             address = COALESCE(address, $3)
         WHERE id = $4`,
        [
          JSON.stringify(updatedMetadata),
          profile.username,
          profile.custodyAddress,
          identity.id,
        ]
      );

      console.log(`   ✅ Updated with: pfp=${!!updatedMetadata.pfp_url}, name=${!!updatedMetadata.display_name}, bio=${!!updatedMetadata.bio}\n`);
      successCount++;
    } catch (error) {
      console.error(`   ❌ Database update failed:`, error.message, '\n');
      errorCount++;
    }

    // Rate limiting - wait 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n📊 Backfill Summary:`);
  console.log(`   ✅ Successfully updated: ${successCount}`);
  console.log(`   ⏭️  Skipped: ${skipCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📝 Total processed: ${identities.length}\n`);

  await client.end();
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
