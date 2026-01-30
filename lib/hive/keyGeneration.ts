import { PrivateKey } from '@hiveio/dhive';
import crypto from 'crypto';

/**
 * Full set of Hive account keys (private and public)
 */
export interface HiveAccountKeys {
  owner: string;
  ownerPublic: string;
  active: string;
  activePublic: string;
  posting: string;
  postingPublic: string;
  memo: string;
  memoPublic: string;
}

/**
 * Generates a cryptographically secure random seed
 * Used as base material for key derivation
 */
function generateSecureRandomSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generates a complete set of Hive keys for a new account
 * Creates owner, active, posting, and memo keys from a secure random seed
 *
 * @param username - The Hive username for the new account
 * @returns Complete set of private and public keys in WIF format
 *
 * @example
 * const keys = generateHiveKeys('newusername');
 * console.log(keys.posting); // 5JqJKx...
 * console.log(keys.postingPublic); // STM7...
 */
export function generateHiveKeys(username: string): HiveAccountKeys {
  // Generate a cryptographically secure random seed
  const seed = generateSecureRandomSeed();

  // Derive each key type from the seed with role-specific suffixes
  // This ensures each key is different while maintaining derivability
  const owner = PrivateKey.fromSeed(`${username}owner${seed}`);
  const active = PrivateKey.fromSeed(`${username}active${seed}`);
  const posting = PrivateKey.fromSeed(`${username}posting${seed}`);
  const memo = PrivateKey.fromSeed(`${username}memo${seed}`);

  return {
    // Private keys (WIF format - starts with '5')
    owner: owner.toString(),
    active: active.toString(),
    posting: posting.toString(),
    memo: memo.toString(),

    // Public keys (STM format)
    ownerPublic: owner.createPublic().toString(),
    activePublic: active.createPublic().toString(),
    postingPublic: posting.createPublic().toString(),
    memoPublic: memo.createPublic().toString(),
  };
}

/**
 * Generates keys from a specific seed (for testing or recovery)
 *
 * @param username - The Hive username
 * @param seed - Specific seed to use (for deterministic generation)
 * @returns Complete set of keys
 *
 * @internal Use generateHiveKeys() in production - this is for testing only
 */
export function generateHiveKeysFromSeed(
  username: string,
  seed: string
): HiveAccountKeys {
  const owner = PrivateKey.fromSeed(`${username}owner${seed}`);
  const active = PrivateKey.fromSeed(`${username}active${seed}`);
  const posting = PrivateKey.fromSeed(`${username}posting${seed}`);
  const memo = PrivateKey.fromSeed(`${username}memo${seed}`);

  return {
    owner: owner.toString(),
    active: active.toString(),
    posting: posting.toString(),
    memo: memo.toString(),
    ownerPublic: owner.createPublic().toString(),
    activePublic: active.createPublic().toString(),
    postingPublic: posting.createPublic().toString(),
    memoPublic: memo.createPublic().toString(),
  };
}

/**
 * Validates a Hive username format
 *
 * Hive username rules:
 * - 3-16 characters
 * - Lowercase letters and numbers only
 * - Can contain hyphens (but not at start or end)
 * - Cannot contain consecutive hyphens
 *
 * @param username - Username to validate
 * @returns true if valid Hive username format
 *
 * @example
 * isValidHiveUsername('skatehive'); // true
 * isValidHiveUsername('skate-hive'); // true
 * isValidHiveUsername('Skatehive'); // false (uppercase)
 * isValidHiveUsername('sk'); // false (too short)
 * isValidHiveUsername('-skatehive'); // false (starts with hyphen)
 */
export function isValidHiveUsername(username: string): boolean {
  // Must be 3-16 characters
  if (username.length < 3 || username.length > 16) {
    return false;
  }

  // Must start and end with lowercase letter or number
  if (!/^[a-z0-9].*[a-z0-9]$/.test(username)) {
    return false;
  }

  // Can only contain lowercase letters, numbers, and hyphens
  if (!/^[a-z0-9-]+$/.test(username)) {
    return false;
  }

  // Cannot contain consecutive hyphens
  if (username.includes('--')) {
    return false;
  }

  return true;
}

/**
 * Converts a display name to a valid Hive username
 * Useful for suggesting usernames during sponsorship
 *
 * @param displayName - The user's display name
 * @returns A valid Hive username (or null if can't convert)
 *
 * @example
 * suggestHiveUsername('Skate Hive'); // 'skate-hive'
 * suggestHiveUsername('John Doe 123'); // 'john-doe-123'
 * suggestHiveUsername('!!!'); // null (no valid characters)
 */
export function suggestHiveUsername(displayName: string): string | null {
  // Convert to lowercase and replace spaces/special chars with hyphens
  let suggested = displayName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphen
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .replace(/--+/g, '-'); // Replace multiple hyphens with single

  // Truncate to 16 characters if needed
  if (suggested.length > 16) {
    suggested = suggested.substring(0, 16).replace(/-+$/, '');
  }

  // Check if valid
  if (isValidHiveUsername(suggested)) {
    return suggested;
  }

  return null;
}

/**
 * Generates a unique username by appending a random suffix
 * Used when the desired username is already taken
 *
 * @param baseUsername - The desired username
 * @param maxAttempts - Maximum number of unique suffixes to try (default: 10)
 * @returns Username with random suffix, or null if all attempts failed
 *
 * @example
 * generateUniqueUsername('skatehive'); // 'skatehive-a3f'
 * generateUniqueUsername('john-doe'); // 'john-doe-7k2'
 */
export function generateUniqueUsername(
  baseUsername: string,
  maxAttempts: number = 10
): string | null {
  // Ensure base is valid
  if (!isValidHiveUsername(baseUsername)) {
    return null;
  }

  for (let i = 0; i < maxAttempts; i++) {
    // Generate random 3-char suffix (lowercase + numbers)
    const suffix = crypto
      .randomBytes(2)
      .toString('hex')
      .substring(0, 3);

    const candidate = `${baseUsername}-${suffix}`;

    // Check length constraint
    if (candidate.length <= 16 && isValidHiveUsername(candidate)) {
      return candidate;
    }

    // If too long, try shortening the base
    if (candidate.length > 16) {
      const maxBaseLength = 16 - 4; // 4 chars for '-' + 3-char suffix
      const shortenedBase = baseUsername.substring(0, maxBaseLength);
      const shortenedCandidate = `${shortenedBase}-${suffix}`;

      if (isValidHiveUsername(shortenedCandidate)) {
        return shortenedCandidate;
      }
    }
  }

  return null;
}
