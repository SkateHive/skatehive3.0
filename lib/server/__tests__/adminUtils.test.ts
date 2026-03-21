import { isServerSideAdmin, logSecurityAttempt } from '../adminUtils';

// Simple test runner compatible with existing project patterns (tsx invocations)
(async function run() {
  process.env.ADMIN_USERS = 'alice,bob';

  console.log('Testing isServerSideAdmin...');
  if (!isServerSideAdmin('alice')) {
    console.error('Expected alice to be admin');
    process.exit(1);
  }
  if (!isServerSideAdmin('BOB')) {
    console.error('Expected BOB to be admin (case-insensitive)');
    process.exit(1);
  }
  if (isServerSideAdmin('charlie')) {
    console.error('Did not expect charlie to be admin');
    process.exit(1);
  }

  console.log('isServerSideAdmin tests passed');

  console.log('Testing logSecurityAttempt (no-throw)...');
  try {
    const fakeReq = new Request('http://localhost', { headers: { 'user-agent': 'tester' } });
    logSecurityAttempt('alice', 'test-op', fakeReq, true);
    logSecurityAttempt('mallory', 'test-op', fakeReq, false);
  } catch (e) {
    console.error('logSecurityAttempt threw an error', e);
    process.exit(1);
  }

  console.log('logSecurityAttempt tests passed');
  console.log('ALL TESTS OK');
  process.exit(0);
})();
