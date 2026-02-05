/**
 * Quick tests for server-actions
 * Run with: npx tsx lib/hive/__tests__/server-actions.test.ts
 */

import { editPostAsSkatedev, updatePostWithCoinInfo } from '../server-actions';

const tests: Array<() => void | Promise<void>> = [];
let hasFailures = false;

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

it('rejects edits for non-app authors', async () => {
  // Provide a dummy posting key so the function advances past the posting key check
  process.env.HIVE_POSTING_KEY = 'DUMMY_KEY';

  const res = await editPostAsSkatedev({
    author: 'someuser',
    permlink: 'test-permlink',
    title: 'New title'
  });

  if (res.success) throw new Error('Expected failure when editing non-app author post');
  if (!res.error || !res.error.includes('Can only update posts')) throw new Error(`Unexpected error message: ${res.error}`);
});

it('updatePostWithCoinInfo wrapper rejects non-app author', async () => {
  process.env.HIVE_POSTING_KEY = 'DUMMY_KEY';
  const res = await updatePostWithCoinInfo({ author: 'someoneelse', permlink: 'p', coinAddress: '0x0', coinUrl: 'https://example.com' });
  if (res.success) throw new Error('Expected failure when updating non-app author post');
});

(async () => {
  for (const t of tests) await t();
  if (hasFailures) {
    console.error('\n❌ Some server-action tests failed');
    process.exit(1);
  }
  console.log('\n✨ Server-action tests passed');
})();
