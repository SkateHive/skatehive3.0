import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Posting method types
 */
export type PostingMethod =
  | {
      type: 'hive_account';
      username: string;
      hasStoredKey: true;
      description: 'Posts with stored encrypted posting key';
    }
  | {
      type: 'keychain_signing';
      username: string;
      hasStoredKey: false;
      description: 'Requires Keychain popup to sign';
    }
  | {
      type: 'soft_post';
      username: 'skateuser';
      hasStoredKey: false;
      description: 'Posts via shared account (lite account)';
    };

/**
 * Determines the posting method for a user
 * Priority: Encrypted key > Keychain > Soft post
 *
 * @param supabase - Supabase client instance
 * @param userId - The user's ID
 * @returns Posting method configuration
 *
 * @example
 * const method = await getPostingMethod(supabase, userId);
 * if (method.type === 'hive_account') {
 *   // Post with encrypted key (no popup needed)
 *   const key = await getDecryptedKey(supabase, userId);
 *   // ... broadcast to Hive
 * } else if (method.type === 'keychain_signing') {
 *   // Request Keychain to sign
 * } else {
 *   // Create soft post
 * }
 */
export async function getPostingMethod(
  supabase: SupabaseClient,
  userId: string
): Promise<PostingMethod> {

  // Priority 1: Check for stored encrypted posting key (sponsored or manually set)
  const { data: keyData, error: keyError } = await supabase
    .from('userbase_hive_keys')
    .select('hive_username')
    .eq('user_id', userId)
    .single();

  // PGRST116 = "no rows found" - expected when user has no stored key
  if (keyError && keyError.code !== 'PGRST116') {
    throw new Error(`Failed to check hive keys: ${keyError.message}`);
  }

  if (keyData) {
    return {
      type: 'hive_account',
      username: keyData.hive_username,
      hasStoredKey: true,
      description: 'Posts with stored encrypted posting key',
    };
  }

  // Priority 2: Check for linked Hive identity (no stored key - use Keychain)
  const { data: identityData, error: identityError } = await supabase
    .from('userbase_identities')
    .select('handle')
    .eq('user_id', userId)
    .eq('type', 'hive')
    .single();

  // PGRST116 = "no rows found" - expected when user has no linked hive identity
  if (identityError && identityError.code !== 'PGRST116') {
    throw new Error(`Failed to check hive identity: ${identityError.message}`);
  }

  if (identityData?.handle) {
    return {
      type: 'keychain_signing',
      username: identityData.handle,
      hasStoredKey: false,
      description: 'Requires Keychain popup to sign',
    };
  }

  // Priority 3: Default to soft post (lite account)
  return {
    type: 'soft_post',
    username: 'skateuser',
    hasStoredKey: false,
    description: 'Posts via shared account (lite account)',
  };
}

/**
 * Checks if a user can post directly to Hive (without Keychain popup)
 * Returns true if user has encrypted posting key stored
 *
 * @param supabase - Supabase client instance
 * @param userId - The user's ID
 * @returns true if user can post directly
 */
export async function canPostDirectlyToHive(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const method = await getPostingMethod(supabase, userId);
  return method.type === 'hive_account';
}

/**
 * Gets the Hive username for posting (if available)
 * Returns null if user is a lite account
 *
 * @param supabase - Supabase client instance
 * @param userId - The user's ID
 * @returns Hive username or null
 */
export async function getHiveUsernameForPosting(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const method = await getPostingMethod(supabase, userId);
  return method.type !== 'soft_post' ? method.username : null;
}

/**
 * Determines if a user needs Keychain for posting
 *
 * @param supabase - Supabase client instance
 * @param userId - The user's ID
 * @returns true if Keychain popup is required
 */
export async function requiresKeychain(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const method = await getPostingMethod(supabase, userId);
  return method.type === 'keychain_signing';
}
