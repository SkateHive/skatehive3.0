/**
 * Simple test for editPostWithKeychainInstance
 * Run with: npx tsx lib/hive/__tests__/editPostWithKeychain.test.ts
 */

import { editPostWithKeychainInstance } from '../client-functions';

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

function assertEqual(actual: any, expected: any, message?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
  }
}

// Tests
describe('editPostWithKeychainInstance', () => {
  it('should call keychain.post and return its result', async () => {
    const mockKeychain = {
      post: async (data: any) => {
        // Basic verification of expected fields
        if (!data.author || !data.permlink) {
          throw new Error('Missing author or permlink');
        }
        return { success: true, publicKey: 'TESTPUB' };
      }
    } as any;

    const params = {
      username: 'alice',
      author: 'alice',
      permlink: 'test-post',
      title: 'Test',
      body: 'Edited body',
      json_metadata: { image: ['https://example.com/img.png'] }
    };

    const result = await editPostWithKeychainInstance(mockKeychain, params as any);
    assertEqual(result, { success: true, publicKey: 'TESTPUB' });
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
    console.log('\n✨ All tests passed!\n');
  }
})();
