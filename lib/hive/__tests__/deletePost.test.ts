/**
 * Unit tests for deletePostAsSkatedev
 * Run with: pnpm exec tsx lib/hive/__tests__/deletePost.test.ts
 */

import { deletePostAsSkatedev } from '../server-actions';
import HiveClient from '../hiveclient';

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

function assertTrue(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || 'Expected condition to be true');
  }
}

async function withMockedHive(mockDb: any, mockBroadcast: any, run: () => Promise<void>) {
  const originalDbCall = (HiveClient as any).database.call;
  const originalBroadcast = (HiveClient as any).broadcast;
  (HiveClient as any).database = { call: mockDb };
  (HiveClient as any).broadcast = mockBroadcast;
  try {
    await run();
  } finally {
    (HiveClient as any).database.call = originalDbCall;
    (HiveClient as any).broadcast = originalBroadcast;
  }
}

describe('deletePostAsSkatedev', () => {
  it('deletes a post when authored by app account', async () => {
    process.env.HIVE_POSTING_KEY = 'fake_key';
    const called: any = { ops: null };

    await withMockedHive(
      async (api: string, method: string, payload: any) => {
        // get_content should return a content-like object
        return { author: 'skatedev', permlink: 'p1' };
      },
      {
        sendOperations: async (ops: any[], key: any) => {
          called.ops = ops;
          return true;
        }
      },
      async () => {
        const result = await deletePostAsSkatedev({ author: 'skatedev', permlink: 'p1' });
        assertTrue(result.success, 'Expected success');
        assertTrue(Array.isArray(called.ops), 'Expected operations to be sent');
        const op = called.ops[0];
        if (!op) throw new Error('No operation recorded');
        if (op[0] !== 'delete_comment') throw new Error('Expected delete_comment op');
        if (op[1].author !== 'skatedev' || op[1].permlink !== 'p1') throw new Error('Operation payload mismatch');
      }
    );
  });

  it('rejects deletion for non-app authors', async () => {
    process.env.HIVE_POSTING_KEY = 'fake_key';
    await withMockedHive(async () => ({ author: 'alice' }), { sendOperations: async () => true }, async () => {
      const result = await deletePostAsSkatedev({ author: 'alice', permlink: 'p1' });
      if (result.success) throw new Error('Should not succeed');
    });
  });
});

// Run tests
(async () => {
  for (const test of tests) {
    await test();
  }
  if (hasFailures) {
    console.log('\n❌ Some tests failed!\n');
    process.exit(1);
  } else {
    console.log('\n✨ All deletePost tests completed!\n');
  }
})();
