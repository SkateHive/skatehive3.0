import crypto from "crypto";

const SECRET_ENV = "USERBASE_KEY_ENCRYPTION_SECRET";

function getKey() {
  const secret = process.env[SECRET_ENV];
  if (!secret) {
    throw new Error(`${SECRET_ENV} is not set`);
  }
  return crypto.scryptSync(secret, "skatehive-userbase", 32);
}

/**
 * Derives a unique encryption key for a specific user's Hive posting key
 * Uses scrypt with user_id as additional salt for key isolation
 */
function deriveHiveKeyEncryptionKey(userId: string): Buffer {
  const secret = process.env[SECRET_ENV];
  if (!secret) {
    throw new Error(`${SECRET_ENV} is not set`);
  }
  // Each user gets a unique key derived from master secret + user_id
  const salt = `skatehive-hive-key-${userId}`;
  return crypto.scryptSync(secret, salt, 32);
}

export function encryptSecret(plaintext: string) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    v: 1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  });
}

export function decryptSecret(payload: string) {
  let parsed: { iv: string; tag: string; data: string };
  try {
    parsed = JSON.parse(payload);
  } catch (error) {
    throw new Error("Invalid encrypted payload");
  }

  if (!parsed?.iv || !parsed?.tag || !parsed?.data) {
    throw new Error("Invalid encrypted payload");
  }

  const key = getKey();
  const iv = Buffer.from(parsed.iv, "base64");
  const tag = Buffer.from(parsed.tag, "base64");
  const data = Buffer.from(parsed.data, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(data),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Encrypts a Hive posting key for a specific user using AES-256-GCM
 * Returns encrypted key, IV, and auth tag separately for database storage
 */
export function encryptHivePostingKey(
  postingKey: string,
  userId: string
): {
  encryptedKey: string;
  iv: string;
  authTag: string;
} {
  const key = deriveHiveKeyEncryptionKey(userId);
  const iv = crypto.randomBytes(12); // GCM standard: 96-bit IV

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(postingKey, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    encryptedKey: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

/**
 * Decrypts a Hive posting key for a specific user
 * Requires the encrypted key, IV, and auth tag from database
 */
export function decryptHivePostingKey(
  encryptedData: {
    encryptedKey: string;
    iv: string;
    authTag: string;
  },
  userId: string
): string {
  const key = deriveHiveKeyEncryptionKey(userId);
  const iv = Buffer.from(encryptedData.iv, "base64");
  const authTag = Buffer.from(encryptedData.authTag, "base64");
  const encrypted = Buffer.from(encryptedData.encryptedKey, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return decrypted.toString("utf8");
}

/**
 * Validates a Hive private key format (WIF)
 * Hive private keys start with '5' and are 51 characters (WIF format)
 */
export function isValidHivePrivateKey(key: string): boolean {
  return /^5[HJK][1-9A-Za-z]{49}$/.test(key);
}
