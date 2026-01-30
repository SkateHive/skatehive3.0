import { SupabaseClient } from "@supabase/supabase-js";
import {
  encryptHivePostingKey,
  decryptHivePostingKey,
  isValidHivePrivateKey,
} from "./encryption";

export interface HiveKeyRecord {
  id: string;
  user_id: string;
  hive_username: string;
  encrypted_posting_key: string;
  encryption_iv: string;
  encryption_auth_tag: string;
  key_type: "sponsored" | "user_provided";
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

/**
 * Stores an encrypted posting key for a user
 * Validates the key format before encryption
 */
export async function storeEncryptedKey(
  supabase: SupabaseClient,
  userId: string,
  hiveUsername: string,
  postingKey: string,
  keyType: "sponsored" | "user_provided" = "sponsored"
): Promise<void> {
  // Validate key format
  if (!isValidHivePrivateKey(postingKey)) {
    throw new Error("Invalid Hive private key format");
  }

  const { encryptedKey, iv, authTag } = encryptHivePostingKey(postingKey, userId);

  const { error } = await supabase.from("userbase_hive_keys").upsert(
    {
      user_id: userId,
      hive_username: hiveUsername,
      encrypted_posting_key: encryptedKey,
      encryption_iv: iv,
      encryption_auth_tag: authTag,
      key_type: keyType,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id",
    }
  );

  if (error) {
    throw new Error(`Failed to store encrypted key: ${error.message}`);
  }
}

/**
 * Retrieves and decrypts a posting key for a user
 * Returns null if no key is stored
 * IMPORTANT: Decrypted key should only exist in memory, never persist or log it
 */
export async function getDecryptedKey(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {

  const { data, error } = await supabase
    .from("userbase_hive_keys")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  try {
    const decrypted = decryptHivePostingKey(
      {
        encryptedKey: data.encrypted_posting_key,
        iv: data.encryption_iv,
        authTag: data.encryption_auth_tag,
      },
      userId
    );

    // Update last_used_at timestamp
    await supabase
      .from("userbase_hive_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", userId);

    return decrypted;
  } catch (error) {
    console.error("Failed to decrypt posting key:", error);
    return null;
  }
}

/**
 * Removes stored posting key for a user
 * User will revert to lite account posting method after this
 */
export async function revokeStoredKey(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {

  const { error } = await supabase
    .from("userbase_hive_keys")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to revoke key: ${error.message}`);
  }
}

/**
 * Gets key metadata without decrypting
 * Safe to call from client-facing API routes for displaying account status
 */
export async function getKeyInfo(
  supabase: SupabaseClient,
  userId: string
): Promise<HiveKeyRecord | null> {

  const { data, error } = await supabase
    .from("userbase_hive_keys")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as HiveKeyRecord;
}

/**
 * Checks if a user has a stored posting key
 * Lightweight check without retrieving the encrypted data
 */
export async function hasStoredKey(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {

  const { data, error } = await supabase
    .from("userbase_hive_keys")
    .select("id")
    .eq("user_id", userId)
    .single();

  return !error && !!data;
}

/**
 * Gets the Hive username associated with a stored key
 * Returns null if no key is stored
 */
export async function getHiveUsername(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {

  const { data, error } = await supabase
    .from("userbase_hive_keys")
    .select("hive_username")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.hive_username;
}
