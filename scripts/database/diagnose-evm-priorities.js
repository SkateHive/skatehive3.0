/**
 * Diagnostic script to show EVM identity priority issues
 * Usage: node scripts/database/diagnose-evm-priorities.js <handle>
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

async function fetchHiveMetadata(handle) {
  try {
    const response = await fetch('https://api.hive.blog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'condenser_api.get_accounts',
        params: [[handle]],
        id: 1,
      }),
    });

    const data = await response.json();
    if (!data.result || !data.result[0]) return null;

    const account = data.result[0];
    let metadata = {};
    try {
      metadata = JSON.parse(account.json_metadata || '{}');
    } catch {
      metadata = {};
    }

    return metadata;
  } catch (error) {
    console.error('Failed to fetch Hive metadata:', error.message);
    return null;
  }
}

async function main() {
  const handle = process.argv[2];

  if (!handle) {
    console.error('Usage: node scripts/database/diagnose-evm-priorities.js <handle>');
    console.error('Example: node scripts/database/diagnose-evm-priorities.js vladtest33');
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

  console.log(`\n🔍 Diagnosing EVM identity priorities for: ${handle}\n`);

  // Find user
  const { rows: users } = await client.query(
    `SELECT id, handle FROM userbase_users WHERE LOWER(handle) = LOWER($1)`,
    [handle]
  );

  if (users.length === 0) {
    console.log('❌ No user found with that handle');
    await client.end();
    return;
  }

  const user = users[0];

  // Get Hive identity
  const { rows: hiveIdentities } = await client.query(
    `SELECT handle FROM userbase_identities WHERE user_id = $1 AND type = 'hive' LIMIT 1`,
    [user.id]
  );

  const hiveHandle = hiveIdentities[0]?.handle;

  // Get Farcaster identity
  const { rows: farcasterIdentities } = await client.query(
    `SELECT address, metadata FROM userbase_identities WHERE user_id = $1 AND type = 'farcaster' LIMIT 1`,
    [user.id]
  );

  const farcasterCustody = farcasterIdentities[0]?.address?.toLowerCase() || null;

  // Get all EVM identities
  const { rows: evmIdentities } = await client.query(
    `SELECT id, address, is_primary, metadata, created_at
     FROM userbase_identities
     WHERE user_id = $1 AND type = 'evm'
     ORDER BY created_at ASC`,
    [user.id]
  );

  console.log(`📊 Found ${evmIdentities.length} EVM identities\n`);

  // Fetch Hive metadata
  let hiveMetadata = null;
  let ethAddress = null;
  let primaryWallet = null;

  if (hiveHandle) {
    console.log(`🔗 Fetching Hive metadata for @${hiveHandle}...\n`);
    hiveMetadata = await fetchHiveMetadata(hiveHandle);

    if (hiveMetadata) {
      ethAddress = hiveMetadata.extensions?.eth_address?.toLowerCase();
      primaryWallet = hiveMetadata.extensions?.wallets?.primary_wallet?.toLowerCase();

      console.log(`📝 Hive Profile Metadata:`);
      console.log(`   eth_address: ${ethAddress || 'not set'}`);
      console.log(`   primary_wallet: ${primaryWallet || 'not set'}`);
      if (farcasterCustody) {
        console.log(`   farcaster_custody: ${farcasterCustody}`);
      }
      console.log('');
    }
  }

  console.log(`📋 Current EVM Identities (in database):\n`);

  evmIdentities.forEach((identity, idx) => {
    const addr = identity.address.toLowerCase();
    const meta = identity.metadata || {};

    console.log(`[${idx + 1}] ${identity.address}`);
    console.log(`    Primary: ${identity.is_primary ? 'YES' : 'no'}`);
    console.log(`    Source: ${meta.source || meta.verified_via || 'unknown'}`);
    console.log(`    Display Priority: ${meta.display_priority || 'not set'}`);

    // Diagnose issues
    const issues = [];

    if (addr === ethAddress) {
      if (!meta.is_eth_address) {
        issues.push('⚠️  Should be marked as eth_address');
      }
      if (meta.display_priority !== 1) {
        issues.push('⚠️  Should have display_priority = 1');
      }
      console.log(`    Type: 🟢 ETH_ADDRESS (for Zora)`);
    } else if (addr === primaryWallet) {
      if (!meta.is_primary_wallet) {
        issues.push('⚠️  Should be marked as primary_wallet');
      }
      if (meta.display_priority !== 2) {
        issues.push('⚠️  Should have display_priority = 2');
      }
      console.log(`    Type: 🟡 PRIMARY_WALLET`);
    } else if (addr === farcasterCustody) {
      console.log(`    Type: 🔵 FARCASTER_CUSTODY (lowest priority)`);
      if (meta.display_priority && meta.display_priority < 10) {
        issues.push('⚠️  Custody should have lowest priority');
      }
    } else if (meta.source === 'hive') {
      console.log(`    Type: 🟠 HIVE_ADDITIONAL`);
    } else {
      console.log(`    Type: ⚪ OTHER`);
    }

    if (issues.length > 0) {
      issues.forEach(issue => console.log(`    ${issue}`));
    }

    console.log('');
  });

  // Summary
  const hasEthAddress = evmIdentities.some(id => id.address.toLowerCase() === ethAddress);
  const hasPrimaryWallet = evmIdentities.some(id => id.address.toLowerCase() === primaryWallet);

  console.log(`\n📊 Summary:`);
  console.log(`   Total EVM identities: ${evmIdentities.length}`);
  console.log(`   Has eth_address in DB: ${hasEthAddress ? '✅' : '❌ MISSING'}`);
  console.log(`   Has primary_wallet in DB: ${hasPrimaryWallet ? '✅' : (primaryWallet ? '❌ MISSING' : 'N/A')}`);

  if (!hasEthAddress && ethAddress) {
    console.log(`\n⚠️  ISSUE: Hive eth_address (${ethAddress}) is NOT in the database!`);
    console.log(`   This is the address that should be used for Zora profile.`);
    console.log(`   You need to re-link your Hive account to add this address.`);
  }

  const needsMetadataUpdate = evmIdentities.some(id => {
    const meta = id.metadata || {};
    return !meta.display_priority;
  });

  if (needsMetadataUpdate) {
    console.log(`\n⚠️  Some EVM identities are missing display_priority metadata.`);
    console.log(`   Run the update script to fix this.`);
  }

  console.log('');
  await client.end();
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
