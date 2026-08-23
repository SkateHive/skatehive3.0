/**
 * Unit tests for BTC address validation
 * Run with: npx tsx lib/utils/__tests__/validateBtcAddress.test.ts
 */

import { validateBtcAddress, normalizeBtcAddress } from '../validateBtcAddress';

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

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, but got ${actual}`);
  }
}

describe('validateBtcAddress', () => {
  it('accepts legacy P2PKH addresses (starts with 1)', () => {
    assertEqual(validateBtcAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'), true);
  });

  it('accepts P2SH addresses (starts with 3)', () => {
    assertEqual(validateBtcAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy'), true);
  });

  it('accepts bech32 segwit addresses (bc1)', () => {
    assertEqual(
      validateBtcAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'),
      true
    );
  });

  it('accepts taproot addresses (bc1p)', () => {
    assertEqual(
      validateBtcAddress(
        'bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr'
      ),
      true
    );
  });

  it('accepts uppercase bech32 by normalizing', () => {
    assertEqual(
      validateBtcAddress('BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4'),
      true
    );
  });

  it('trims surrounding whitespace', () => {
    assertEqual(
      validateBtcAddress('  1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa  '),
      true
    );
  });

  it('rejects empty / whitespace-only input', () => {
    assertEqual(validateBtcAddress(''), false);
    assertEqual(validateBtcAddress('   '), false);
  });

  it('rejects EVM addresses', () => {
    assertEqual(
      validateBtcAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F'),
      false
    );
  });

  it('rejects malformed bech32', () => {
    assertEqual(validateBtcAddress('bc1!nope'), false);
  });

  it('rejects arbitrary strings', () => {
    assertEqual(validateBtcAddress('hello world'), false);
    assertEqual(validateBtcAddress('not-an-address'), false);
  });

  it('normalizeBtcAddress lowercases only bech32', () => {
    assertEqual(
      normalizeBtcAddress('BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4'),
      'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
    );
    // base58 is case-sensitive — must be left untouched
    assertEqual(
      normalizeBtcAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'),
      '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
    );
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
    console.log('\n✨ All BTC address validation tests passed!\n');
  }
})();
