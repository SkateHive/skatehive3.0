#!/usr/bin/env tsx
/**
 * End-to-end upload pipeline test.
 * Tests every upload path against the local dev server.
 *
 * Usage:
 *   npx tsx scripts/test-upload-pipeline.ts
 *   npx tsx scripts/test-upload-pipeline.ts --server=https://skatehive.app  (production)
 *   npx tsx scripts/test-upload-pipeline.ts --verbose
 */

import { config } from 'dotenv';
import { resolve, join } from 'path';
import { readFileSync, existsSync } from 'fs';

config({ path: resolve(process.cwd(), '.env.local') });

// ─── Config ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const serverArg = args.find(a => a.startsWith('--server='));
const BASE_URL = serverArg ? serverArg.replace('--server=', '') : 'http://localhost:3001';
const VERBOSE = args.includes('--verbose');
const PINATA_JWT = process.env.PINATA_JWT!;

// Test files
const TEST_VIDEO_PATH = join(process.cwd(), 'public/test-video.mov');
const TEST_IMAGE_PATH = join(process.cwd(), 'public/skatehive.png');

type Result = 'PASS' | 'FAIL' | 'SKIP';
const results: { name: string; result: Result; detail: string }[] = [];

function log(msg: string) { console.log(msg); }
function dim(msg: string) { if (VERBOSE) console.log(`   ${msg}`); }

function record(name: string, result: Result, detail: string) {
  results.push({ name, result, detail });
  const icon = result === 'PASS' ? '✅' : result === 'SKIP' ? '⏭️' : '❌';
  console.log(`${icon} ${name}`);
  if (result === 'FAIL' || VERBOSE) console.log(`   ${detail}`);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function uploadViaProxy(file: Buffer, fileName: string, mimeType: string): Promise<{ ok: boolean; data: any; status: number }> {
  const formData = new FormData();
  formData.append('file', new Blob([file], { type: mimeType }), fileName);
  formData.append('creator', 'test-script');

  const res = await fetch(`${BASE_URL}/api/pinata`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data, status: res.status };
}

async function getSignedJwt(): Promise<{ ok: boolean; jwt?: string; error?: string }> {
  const res = await fetch(`${BASE_URL}/api/pinata/signed-url`);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, jwt: data.jwt, error: data.error };
}

async function uploadDirectToPinata(file: Buffer, fileName: string, mimeType: string, jwt: string, timeoutMs = 300_000): Promise<{ ok: boolean; data: any }> {
  const formData = new FormData();
  formData.append('file', new Blob([file], { type: mimeType }), fileName);
  formData.append('pinataMetadata', JSON.stringify({
    name: fileName,
    keyvalues: {
      source: 'webapp',
      creator: 'test-script',
      fileType: mimeType,
      uploadDate: new Date().toISOString(),
    }
  }));
  formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: formData,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } finally {
    clearTimeout(timer);
  }
}

async function checkGatewayUrl(url: string): Promise<{ ok: boolean; status: number; contentType?: string }> {
  const res = await fetch(url, { method: 'HEAD' }).catch(() => null);
  if (!res) return { ok: false, status: 0 };
  return { ok: res.ok, status: res.status, contentType: res.headers.get('content-type') ?? undefined };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

async function main() {
log(`\n🛹 Skatehive Upload Pipeline Test`);
log(`   Server: ${BASE_URL}`);
log(`   PINATA_JWT: ${PINATA_JWT ? `${PINATA_JWT.slice(0, 20)}…` : '❌ NOT SET'}\n`);

// ── Test 1: Health check ──────────────────────────────────────────────────
log('── 1. Server health ──');
try {
  const res = await fetch(`${BASE_URL}/api/pinata/signed-url`);
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.jwt) {
    record('Server reachable + signed-url returns JWT', 'PASS', `Status ${res.status}`);
  } else {
    record('Server reachable + signed-url returns JWT', 'FAIL', `Status ${res.status}: ${JSON.stringify(data)}`);
  }
} catch (e: any) {
  record('Server reachable', 'FAIL', `Cannot reach ${BASE_URL}: ${e.message}`);
}

// ── Test 2: Proxy upload (small image) ───────────────────────────────────
log('\n── 2. Proxy upload (≤4MB image) ──');
// Create a minimal 1×1 PNG in memory (89 bytes)
const TINY_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6260000000000200016221bc330000000049454e44ae426082',
  'hex'
);

try {
  const { ok, data, status } = await uploadViaProxy(TINY_PNG, 'test-1x1.png', 'image/png');
  if (ok && data.IpfsHash) {
    record('Proxy upload returns IpfsHash', 'PASS', `CID: ${data.IpfsHash}`);
    dim(`PinSize: ${data.PinSize}`);

    // ── Test 3: Gateway accessibility ──────────────────────────────────
    log('\n── 3. Gateway accessibility ──');
    const GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'ipfs.skatehive.app';
    const rawUrl = `https://${GATEWAY}/ipfs/${data.IpfsHash}`;
    const optimizedUrl = `https://${GATEWAY}/ipfs/${data.IpfsHash}?img-width=200&img-format=webp&img-quality=75&img-fit=scale-down&img-onerror=redirect`;

    const rawCheck = await checkGatewayUrl(rawUrl);
    if (rawCheck.ok) {
      record('Raw IPFS URL accessible', 'PASS', `${rawUrl} → ${rawCheck.status} ${rawCheck.contentType}`);
    } else {
      record('Raw IPFS URL accessible', 'FAIL', `${rawUrl} → ${rawCheck.status}`);
    }

    const optCheck = await checkGatewayUrl(optimizedUrl);
    if (optCheck.ok) {
      record('Pinata img-* optimization works', 'PASS', `Content-Type: ${optCheck.contentType}`);
      if (optCheck.contentType?.includes('webp')) {
        record('Response is WebP (optimization active)', 'PASS', optCheck.contentType!);
      } else {
        record('Response is WebP (optimization active)', 'FAIL', `Got: ${optCheck.contentType} — img-* feature may not be enabled on gateway`);
      }
    } else {
      record('Pinata img-* optimization endpoint', 'FAIL', `${optimizedUrl} → ${optCheck.status}`);
    }

    // ── Test 4: Keyvalue metadata ────────────────────────────────────────
    log('\n── 4. Keyvalue metadata ──');
    await new Promise(r => setTimeout(r, 2000)); // Pinata indexing delay
    const metaRes = await fetch(`${BASE_URL}/api/pinata/metadata/${data.IpfsHash}`);
    const meta = await metaRes.json().catch(() => ({}));
    dim(`Metadata response: ${JSON.stringify(meta)}`);

    if (metaRes.ok && meta.keyvalues) {
      const kv = meta.keyvalues;
      record('Metadata endpoint returns keyvalues', 'PASS', JSON.stringify(kv));
      record('source=webapp keyvalue set', kv.source === 'webapp' ? 'PASS' : 'FAIL',
        kv.source === 'webapp' ? 'source: webapp' : `source was: "${kv.source}"`);
      record('creator keyvalue set', kv.creator ? 'PASS' : 'FAIL',
        kv.creator ? `creator: ${kv.creator}` : 'creator missing');
      record('fileType keyvalue set', kv.fileType ? 'PASS' : 'FAIL',
        kv.fileType ? `fileType: ${kv.fileType}` : 'fileType missing');
    } else {
      record('Metadata endpoint', 'FAIL', `Status ${metaRes.status}: ${JSON.stringify(meta)}`);
    }
  } else {
    record('Proxy upload returns IpfsHash', 'FAIL', `Status ${status}: ${JSON.stringify(data)}`);
  }
} catch (e: any) {
  record('Proxy upload', 'FAIL', e.message);
}

// ── Test 5: Signed JWT + direct upload ───────────────────────────────────
log('\n── 5. Signed JWT + direct upload (simulates large file path) ──');
try {
  const { ok: jwtOk, jwt, error } = await getSignedJwt();
  if (!jwtOk || !jwt) {
    record('Get signed JWT', 'FAIL', error ?? 'No JWT returned');
  } else {
    record('Get signed JWT', 'PASS', `JWT: ${jwt.slice(0, 30)}…`);

    const { ok, data } = await uploadDirectToPinata(TINY_PNG, 'test-direct.png', 'image/png', jwt);
    if (ok && data.IpfsHash) {
      record('Direct-to-Pinata upload', 'PASS', `CID: ${data.IpfsHash}`);
    } else {
      record('Direct-to-Pinata upload', 'FAIL', JSON.stringify(data));
    }
  }
} catch (e: any) {
  record('Signed JWT flow', 'FAIL', e.message);
}

// ── Test 6: Video upload (test-video.mov) ────────────────────────────────
log('\n── 6. Test video upload (proxy route) ──');
if (!existsSync(TEST_VIDEO_PATH)) {
  record('Video upload (test-video.mov)', 'SKIP', 'File not found at public/test-video.mov');
} else {
  const videoFile = readFileSync(TEST_VIDEO_PATH);
  const sizeMb = (videoFile.length / 1024 / 1024).toFixed(1);
  log(`   File: public/test-video.mov (${sizeMb} MB)`);

  try {
    if (videoFile.length > 4 * 1024 * 1024) {
      log(`   > 4MB — testing signed JWT direct upload path`);
      const { ok: jwtOk, jwt } = await getSignedJwt();
      if (!jwtOk || !jwt) {
        record('Video upload (signed JWT path)', 'FAIL', 'Could not get JWT');
      } else {
        const { ok, data } = await uploadDirectToPinata(videoFile, 'test-video.mov', 'video/quicktime', jwt);
        if (ok && data.IpfsHash) {
          record('Video upload (signed JWT path)', 'PASS', `CID: ${data.IpfsHash} (${sizeMb} MB)`);
        } else {
          record('Video upload (signed JWT path)', 'FAIL', JSON.stringify(data));
        }
      }
    } else {
      const { ok, data, status } = await uploadViaProxy(videoFile, 'test-video.mov', 'video/quicktime');
      if (ok && data.IpfsHash) {
        record('Video upload (proxy path)', 'PASS', `CID: ${data.IpfsHash} (${sizeMb} MB)`);
      } else {
        record('Video upload (proxy path)', 'FAIL', `Status ${status}: ${JSON.stringify(data)}`);
      }
    }
  } catch (e: any) {
    record('Video upload', 'FAIL', e.message);
  }
}

// ── Test 7: Analytics endpoint ───────────────────────────────────────────
log('\n── 7. Analytics endpoint ──');
try {
  const res = await fetch(`${BASE_URL}/api/pinata/analytics?days=7&limit=3`);
  const data = await res.json().catch(() => ({}));
  if (res.ok && Array.isArray(data.analytics)) {
    record('Analytics endpoint', 'PASS', `Returned ${data.analytics.length} items`);
    dim(JSON.stringify(data.analytics.slice(0, 2)));
  } else {
    record('Analytics endpoint', 'FAIL', `Status ${res.status}: ${JSON.stringify(data)}`);
  }
} catch (e: any) {
  record('Analytics endpoint', 'FAIL', e.message);
}

// ─── Summary ────────────────────────────────────────────────────────────────

const pass = results.filter(r => r.result === 'PASS').length;
const fail = results.filter(r => r.result === 'FAIL').length;
const skip = results.filter(r => r.result === 'SKIP').length;

log(`\n${'─'.repeat(50)}`);
log(`Results: ${pass} passed, ${fail} failed, ${skip} skipped`);

if (fail === 0) {
  log('🎉 All tests passed!');
} else {
  log('\n❌ Failed tests:');
  results.filter(r => r.result === 'FAIL').forEach(r => {
    log(`   • ${r.name}`);
    log(`     ${r.detail}`);
  });
  process.exit(1);
}
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
