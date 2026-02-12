import { deletePostAsSkatedev } from '../server-actions';

(async function run() {
  console.log('Running deletePostAsSkatedev tests');

  // Ensure posting key missing returns clear error
  delete process.env.HIVE_POSTING_KEY;
  try {
    const res = await deletePostAsSkatedev({ author: 'skatedev', permlink: 'test' });
    if (res.success) {
      console.error('Expected failure when HIVE_POSTING_KEY is not set');
      process.exit(1);
    }
    console.log('✅ missing posting key path OK');
  } catch (e) {
    console.error('deletePostAsSkatedev threw unexpectedly when key missing', e);
    process.exit(1);
  }

  // Now set a dummy posting key and ensure author restriction works
  process.env.HIVE_POSTING_KEY = 'DUMMY_KEY_SHOULD_NOT_BE_VALID';
  try {
    const res = await deletePostAsSkatedev({ author: 'someoneelse', permlink: 'test' });
    if (res.success) {
      console.error('Expected failure when author is not app author');
      process.exit(1);
    }
    console.log('✅ author restriction path OK');
  } catch (e) {
    console.error('deletePostAsSkatedev threw unexpectedly on author restriction check', e);
    process.exit(1);
  }

  console.log('ALL deletePostAsSkatedev tests passed');
  process.exit(0);
})();
