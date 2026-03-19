#!/usr/bin/env tsx
/**
 * One-time script to create Pinata groups for Skatehive content organization.
 *
 * Run with:  npx tsx scripts/setup-pinata-groups.ts
 *
 * Requires PINATA_JWT in your environment (or .env.local).
 * After running, copy the printed env vars into your .env.local and Vercel dashboard.
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const PINATA_JWT = process.env.PINATA_JWT;

if (!PINATA_JWT) {
  console.error('❌ PINATA_JWT not set in environment or .env.local');
  process.exit(1);
}

async function createGroup(name: string): Promise<string> {
  const res = await fetch('https://api.pinata.cloud/v3/groups/public', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create group "${name}": ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.data?.id ?? data.id;
}

async function listExistingGroups(): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch('https://api.pinata.cloud/v3/groups/public', {
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data?.groups ?? data.groups ?? [];
}

async function main() {
  console.log('🛹 Skatehive — Pinata Group Setup\n');

  const existing = await listExistingGroups();
  console.log(`Found ${existing.length} existing groups`);

  const groups: Record<string, string> = {};

  const targets = [
    { key: 'PINATA_GROUP_VIDEOS', name: 'skatehive-videos' },
    { key: 'PINATA_GROUP_IMAGES', name: 'skatehive-images' },
    { key: 'PINATA_GROUP_AVATARS', name: 'skatehive-avatars' },
  ];

  for (const { key, name } of targets) {
    // Check if already exists
    const found = existing.find((g) => g.name === name);
    if (found) {
      console.log(`✅ "${name}" already exists (${found.id})`);
      groups[key] = found.id;
    } else {
      console.log(`📁 Creating "${name}"...`);
      const id = await createGroup(name);
      console.log(`   ✅ Created: ${id}`);
      groups[key] = id;
    }
  }

  console.log('\n📋 Add these to your .env.local and Vercel dashboard:\n');
  for (const [key, id] of Object.entries(groups)) {
    console.log(`${key}=${id}`);
  }
  console.log('\n✅ Done!');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
