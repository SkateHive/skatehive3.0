/**
 * Interactive test script for account linking flow
 * Usage: node scripts/database/test-linking-flow.js <handle>
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
    console.error('Usage: node scripts/database/test-linking-flow.js <handle>');
    console.error('Example: node scripts/database/test-linking-flow.js testuser123');
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

  console.log(`\n🧪 TESTING ACCOUNT LINKING FLOW FOR: ${handle}\n`);
  console.log('═'.repeat(60));

  // Step 1: Check if user exists
  const { rows: users } = await client.query(
    `SELECT id, handle, display_name, avatar_url, status, created_at
     FROM userbase_users
     WHERE LOWER(handle) = LOWER($1)`,
    [handle]
  );

  if (users.length === 0) {
    console.log('\n❌ USER NOT FOUND');
    console.log('\n📝 To create this user:');
    console.log('   1. Go to http://localhost:3000');
    console.log('   2. Click "Create Account"');
    console.log(`   3. Use email: ${handle}@test.com`);
    console.log(`   4. Choose username: ${handle}`);
    console.log('   5. Run this script again\n');
    await client.end();
    return;
  }

  const user = users[0];
  console.log('\n✅ STEP 1: USER EXISTS');
  console.log(`   ID: ${user.id}`);
  console.log(`   Handle: ${user.handle}`);
  console.log(`   Display Name: ${user.display_name || '(not set)'}`);
  console.log(`   Status: ${user.status}`);
  console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);

  // Step 2: Check current identities
  const { rows: identities } = await client.query(
    `SELECT type, handle, address, external_id, is_primary, verified_at, metadata
     FROM userbase_identities
     WHERE user_id = $1
     ORDER BY type, created_at`,
    [user.id]
  );

  console.log('\n✅ STEP 2: CURRENT IDENTITIES');
  if (identities.length === 0) {
    console.log('   ⚠️  No identities linked yet');
    console.log('   📱 This is a pure email account');
  } else {
    const grouped = identities.reduce((acc, id) => {
      if (!acc[id.type]) acc[id.type] = [];
      acc[id.type].push(id);
      return acc;
    }, {});

    if (grouped.hive) {
      console.log(`\n   🔴 HIVE (${grouped.hive.length}):`);
      grouped.hive.forEach(id => {
        console.log(`      • @${id.handle} ${id.is_primary ? '[PRIMARY]' : ''}`);
      });
    }

    if (grouped.evm) {
      console.log(`\n   🔵 EVM (${grouped.evm.length}):`);
      grouped.evm.forEach(id => {
        const meta = id.metadata || {};
        const priority = meta.display_priority || '?';
        const type = meta.is_eth_address ? '[ETH_ADDRESS]' :
                     meta.is_primary_wallet ? '[PRIMARY_WALLET]' :
                     meta.source === 'hive' ? '[FROM_HIVE]' : '[OTHER]';
        console.log(`      • ${id.address} ${type} priority:${priority}`);
      });
    }

    if (grouped.farcaster) {
      console.log(`\n   🟣 FARCASTER (${grouped.farcaster.length}):`);
      grouped.farcaster.forEach(id => {
        const meta = id.metadata || {};
        console.log(`      • @${id.handle} (FID: ${id.external_id})`);
        if (meta.pfp_url) console.log(`        PFP: ${meta.pfp_url.substring(0, 50)}...`);
        if (meta.display_name) console.log(`        Name: ${meta.display_name}`);
      });
    }
  }

  // Step 3: Check what COULD be linked
  console.log('\n✅ STEP 3: POTENTIAL LINKABLE ACCOUNTS');

  const hiveIdentities = identities.filter(i => i.type === 'hive');
  if (hiveIdentities.length > 0) {
    const hiveHandle = hiveIdentities[0].handle;
    console.log(`\n   🔍 Checking Hive metadata for @${hiveHandle}...`);

    const metadata = await fetchHiveMetadata(hiveHandle);
    if (metadata) {
      const extensions = metadata.extensions || {};
      const wallets = extensions.wallets || {};
      const farcaster = extensions.farcaster || {};

      console.log('\n   📊 HIVE PROFILE METADATA:');

      if (extensions.eth_address) {
        console.log(`      • eth_address: ${extensions.eth_address}`);
      } else {
        console.log('      • eth_address: not set');
      }

      if (wallets.primary_wallet) {
        console.log(`      • primary_wallet: ${wallets.primary_wallet}`);
      } else {
        console.log('      • primary_wallet: not set');
      }

      if (Array.isArray(wallets.additional) && wallets.additional.length > 0) {
        console.log(`      • additional wallets: ${wallets.additional.length}`);
        wallets.additional.forEach(w => console.log(`        - ${w}`));
      }

      if (farcaster.fid) {
        console.log(`      • farcaster.fid: ${farcaster.fid}`);
        console.log(`      • farcaster.username: ${farcaster.username || 'not set'}`);
        console.log(`      • farcaster.custody_address: ${farcaster.custody_address || 'not set'}`);
        if (Array.isArray(farcaster.verified_wallets) && farcaster.verified_wallets.length > 0) {
          console.log(`      • farcaster.verified_wallets: ${farcaster.verified_wallets.length}`);
        }
      }
    }
  } else {
    console.log('   ⚠️  No Hive account linked yet');
    console.log('   💡 Link a Hive account to enable cross-chain features');
  }

  // Step 4: Recommendations
  console.log('\n✅ STEP 4: NEXT STEPS');

  const hasHive = identities.some(i => i.type === 'hive');
  const hasEvm = identities.some(i => i.type === 'evm');
  const hasFarcaster = identities.some(i => i.type === 'farcaster');

  if (!hasHive) {
    console.log('\n   📝 TODO: Link Hive Account');
    console.log('      1. Connect with Keychain or Hive Auth in the app');
    console.log('      2. Click "Link Accounts" in the modal');
    console.log('      3. Verify the merge preview modal appears');
    console.log('      4. Confirm linking');
    console.log('      5. Should route to your Hive profile');
    console.log('      6. Run this script again to see new identities');
  } else if (!hasEvm) {
    console.log('\n   📝 TODO: Link EVM Wallet');
    console.log('      1. Connect MetaMask/Rainbow/WalletConnect');
    console.log('      2. Click "Link Accounts" in the modal');
    console.log('      3. Verify the merge preview shows the wallet');
    console.log('      4. Confirm linking');
    console.log('      5. Should route to your Zora profile');
    console.log('      6. Run this script again to verify');
  } else if (!hasFarcaster) {
    console.log('\n   📝 TODO: Link Farcaster Account');
    console.log('      1. Connect with Farcaster Auth');
    console.log('      2. Click "Link Accounts" in the modal');
    console.log('      3. Verify preview shows verified wallets');
    console.log('      4. Confirm linking');
    console.log('      5. Should route to your Farcaster profile');
    console.log('      6. Run this script again to verify');
  } else {
    console.log('\n   🎉 ALL MAJOR IDENTITY TYPES LINKED!');
    console.log('      ✓ Hive account');
    console.log('      ✓ EVM wallet');
    console.log('      ✓ Farcaster profile');
    console.log('\n   💡 Test profile switching:');
    console.log('      - Click Hive logo → should show Hive profile');
    console.log('      - Click Zora logo → should show Zora/tokens');
    console.log('      - Click Farcaster logo → should show Farcaster profile');
  }

  console.log('\n' + '═'.repeat(60));
  console.log('');
  await client.end();
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
