/**
 * Unit tests for the SSRF host guard used by /api/opengraph.
 * Run with: npx tsx lib/utils/__tests__/publicUrlGuard.test.ts
 *
 * Private-range cases use literal IPs (not hostnames) so the test doesn't
 * depend on DNS/network access being available in CI.
 */

import { assertPublicHttpsUrl, isBlockedIp } from '../publicUrlGuard';

const tests: Array<() => void | Promise<void>> = [];
let hasFailures = false;

function describe(name: string, fn: () => void) {
  console.log(`\n📦 ${name}`);
  fn();
}

function it(name: string, fn: () => void | Promise<void>) {
  tests.push(async () => {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
    } catch (error) {
      console.error(`  ❌ ${name}`);
      console.error(`     ${error}`);
      hasFailures = true;
    }
  });
}

async function assertAllowed(url: string) {
  await assertPublicHttpsUrl(url);
}

async function assertRejected(url: string) {
  try {
    await assertPublicHttpsUrl(url);
  } catch {
    return;
  }
  throw new Error(`Expected ${url} to be rejected, but it was allowed`);
}

describe('assertPublicHttpsUrl — public host', () => {
  it('allows a public IPv4 address', async () => {
    await assertAllowed('https://8.8.8.8/og');
  });

  it('allows a public hostname', async () => {
    // No DNS lookup needed to reach the "allowed" branch here — the guard
    // only calls out to DNS for non-literal, non-blocked hostnames, and the
    // hostname check doesn't reject this one; the real network call (if
    // any) happens in dns.lookup, which we don't assert on beyond "does not
    // throw for an obviously-public name".
    await assertAllowed('https://example.com/og').catch((err) => {
      // If the sandbox has no DNS/network access at all, dns.lookup itself
      // fails — that's an environment limitation, not a guard bug. Only
      // fail the test if the guard rejected it for being non-public.
      if (String(err).includes('Host is not allowed')) throw err;
    });
  });
});

describe('assertPublicHttpsUrl — protocol', () => {
  it('rejects non-https protocols', async () => {
    await assertRejected('http://8.8.8.8/og');
  });

  it('rejects unparseable URLs', async () => {
    await assertRejected('not a url');
  });
});

describe('assertPublicHttpsUrl — blocked hostnames', () => {
  it('rejects localhost', async () => {
    await assertRejected('https://localhost/og');
  });

  it('rejects .internal hostnames', async () => {
    await assertRejected('https://service.internal/og');
  });

  it('rejects .local hostnames', async () => {
    await assertRejected('https://printer.local/og');
  });
});

describe('assertPublicHttpsUrl — private IPv4 ranges', () => {
  it('rejects 127.0.0.0/8 (loopback)', async () => {
    await assertRejected('https://127.0.0.1/og');
  });

  it('rejects 10.0.0.0/8', async () => {
    await assertRejected('https://10.1.2.3/og');
  });

  it('rejects 172.16.0.0/12', async () => {
    await assertRejected('https://172.16.0.1/og');
    await assertRejected('https://172.31.255.254/og');
  });

  it('rejects 192.168.0.0/16', async () => {
    await assertRejected('https://192.168.1.1/og');
  });

  it('rejects 169.254.0.0/16 (link-local / cloud metadata)', async () => {
    await assertRejected('https://169.254.169.254/og');
  });

  it('rejects 100.64.0.0/10 (carrier-grade NAT)', async () => {
    await assertRejected('https://100.64.0.1/og');
  });
});

describe('assertPublicHttpsUrl — private IPv6 ranges', () => {
  it('rejects ::1 (loopback)', async () => {
    await assertRejected('https://[::1]/og');
  });

  it('rejects fc00::/7 (unique local)', async () => {
    await assertRejected('https://[fc00::1]/og');
    await assertRejected('https://[fd12:3456:789a::1]/og');
  });
});

describe('isBlockedIp', () => {
  it('treats a public IPv4 address as not blocked', () => {
    if (isBlockedIp('1.1.1.1')) throw new Error('1.1.1.1 should not be blocked');
  });

  it('treats an IPv4-mapped private address as blocked', () => {
    if (!isBlockedIp('::ffff:127.0.0.1')) {
      throw new Error('::ffff:127.0.0.1 should be blocked');
    }
  });
});

(async () => {
  for (const test of tests) {
    await test();
  }
  if (hasFailures) {
    console.log('\n❌ Some tests failed!\n');
    process.exit(1);
  } else {
    console.log('\n✨ All public URL guard tests passed!\n');
  }
})();
