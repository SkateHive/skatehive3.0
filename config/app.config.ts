/**
 * Skatehive 3.0 - Application Configuration
 * 
 * This file contains constants that are specific to the Skatehive app
 * and don't need to be environment variables. These values are committed
 * to version control and shared across all environments.
 * 
 * For secrets and deployment-specific values, see .env.local.example
 */

import { Address } from 'viem';

// ============================================================================
// HIVE BLOCKCHAIN CONFIGURATION
// ============================================================================

export const HIVE_CONFIG = {
  /** Hive community tag for Skatehive posts */
  COMMUNITY_TAG: 'hive-173115',
  
  /** Search tag for filtering Skatehive content */
  SEARCH_TAG: 'skatehive',
  
  /** Default Hive user for automated app operations */
  APP_ACCOUNT: 'skatedev',
  
  /** Snaps/Threads parent post configuration */
  THREADS: {
    AUTHOR: 'peak.snaps',
    PERMLINK: 'snaps',
  },
} as const;

// ============================================================================
// DAO CONTRACT ADDRESSES (Base Mainnet)
// ============================================================================

export const DAO_ADDRESSES = {
  token: '0xfe10d3ce1b0f090935670368ec6de00d8d965523' as Address,
  metadata: '0xea34d6f46ecc15bdf5c59fb26a8176262d18560f' as Address,
  auction: '0x599f3724129ab678986a948a63ecb42fcc873a43' as Address,
  treasury: '0x4c5086086fda01fb8fcffe491862e7504984a75f' as Address,
  governor: '0x3b7c72033cf4d8c5c85d58612a6661c2d70f4010' as Address,
} as const;

// ============================================================================
// KNOWN ETHEREUM ADDRESSES
// ============================================================================

export const ETH_ADDRESSES = {
  /** Skatehive Base multisig wallet */
  SKATEHIVE_MULTISIG: '0xC1afA4c0A70B622d7b71d42241Bb4d52B6F3E218' as Address,
  
  /** Airdrop contract address */
  AIRDROP_CONTRACT: '0x8bD8F0D46c84feCBFbF270bac4Ad28bFA2c78F05' as Address,
  
  /** Skatehive hot wallet */
  SKATEHIVE_HOT: '0xB4964e1ecA55Db36a94e8aeFfBFBAb48529a2f6c' as Address,
  
  /** USDC on Base */
  USDC: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as Address,
  
  /** Skatehive ERC20 token */
  SKATEHIVE_ERC20: '0x4200000000000000000000000000000000000042' as Address,
  
  /** Gnars ERC20 token */
  GNARS_ERC20: '0x6d1b360c25614cb6a6f911c2d1d5c0b6e4a3bcae' as Address,
  
  /** Higher ERC20 token */
  HIGHER_ERC20: '0x0578d8A44db98B23BF096A382e016e29a5Ce0ffe' as Address,

  /** Gnars NFT contract */
  GNARS_NFT: '0x880fb3cf5c6cc2d7dfc13a993e839a9411200c17' as Address,

  /** Platform referrer address */
  PLATFORM_REFERRER: '0x8D36b2cBc8f5Bc9fB43065D5E0485bc2a37eA94E' as Address,

  /** Zero address */
  ZERO: '0x0000000000000000000000000000000000000000' as Address,
} as const;

// ============================================================================
// APP CONFIG HELPERS
// ============================================================================

function isLocalhostUrl(value?: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '0.0.0.0'
    );
  } catch {
    return false;
  }
}

// ============================================================================
// APP BRANDING & DEFAULTS
// ============================================================================

export const APP_CONFIG = {
  /** Application name */
  NAME: 'Skatehive',
  
  /** Default domain for the app */
  DOMAIN: 'skatehive.app',

  /** Default base URL */
  BASE_URL: 'https://skatehive.app',
  
  /** Default theme */
  DEFAULT_THEME: 'skatehive',
  
  /** Default IPFS/Pinata gateway */
  PINATA_GATEWAY: 'ipfs.skatehive.app',

  /** API base URL */
  API_BASE_URL: 'https://api.skatehive.app',
  
  /** Default vote weight for snaps and posts (percentage) */
  DEFAULT_VOTE_WEIGHT: 51,
  
  /** Recovery account name */
  RECOVERY_ACCOUNT: 'skatehive',
  
  /** WalletConnect Project ID (from env or fallback) */
  get WALLETCONNECT_PROJECT_ID() {
    return process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 
           // burner key
           '6465a9e6cbe7a3cb53461864e01d3e8d';
  },
  
  /** Coinbase OnchainKit API Key (from env) */
  get ONCHAINKIT_API_KEY() {
    return process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY;
  },
  


  /** Primary app origin (env override or fallback) */
  get ORIGIN() {
    const envBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (envBaseUrl) {
      const isLocalhost = isLocalhostUrl(envBaseUrl);
      if (process.env.NODE_ENV !== 'production' || !isLocalhost) {
        return envBaseUrl;
      }
    }

    return this.BASE_URL;
  },

  /** IPFS gateway host (env override or fallback) */
  get IPFS_GATEWAY() {
    return process.env.NEXT_PUBLIC_IPFS_GATEWAY || this.PINATA_GATEWAY;
  },

  /** Theme override from env (optional) */
  get THEME_OVERRIDE() {
    return process.env.NEXT_PUBLIC_THEME || this.DEFAULT_THEME;
  },

  /** Giphy API Key (optional fallback) */
  get GIPHY_API_KEY() {
    return process.env.GIPHY_API_KEY || 'qXGQXTPKyNJByTFZpW7Kb0tEFeB90faV';
  },
} as const;

// ============================================================================
// EMAIL DEFAULTS
// ============================================================================

export const EMAIL_DEFAULTS = {
  /** Default SMTP host */
  SMTP_HOST: 'smtp.gmail.com',
  
  /** Default SMTP port */
  SMTP_PORT: 587,
  
  /** Use TLS by default */
  SMTP_SECURE: false,
  
  /** Default from address for outgoing emails */
  FROM_ADDRESS: 'noreply@skatehive.app',
} as const;

// ============================================================================
// SPONSORSHIP SYSTEM CONFIGURATION
// ============================================================================

export const SPONSORSHIP_CONFIG = {
  /** Cost in HIVE to sponsor an account via direct transfer */
  COST_HIVE: 3.0,

  /** Minimum posts required before a lite account is eligible for sponsorship */
  MIN_POSTS_FOR_ELIGIBILITY: 5,

  /** Minimum account age in days before eligible for sponsorship */
  MIN_ACCOUNT_AGE_DAYS: 7,

  /** Minimum unique voters required (prevents spam/self-voting) */
  MIN_UNIQUE_VOTERS: 3,

  /** Minimum Hive Power required for a user to sponsor others */
  SPONSOR_MIN_HP: 50,

  /** Maximum sponsorships a user can create per day */
  SPONSOR_DAILY_LIMIT: 5,

  /** Cooldown period between sponsorships (in hours) */
  SPONSOR_COOLDOWN_HOURS: 24,

  /** Default recovery account for newly created Hive accounts */
  get DEFAULT_RECOVERY_ACCOUNT() {
    return process.env.HIVE_DEFAULT_RECOVERY_ACCOUNT || 'skatehive';
  },

  /** Hive API nodes for account creation and verification */
  get HIVE_API_NODES() {
    const envNodes = process.env.HIVE_API_NODES;
    if (envNodes) {
      return envNodes.split(',').map(n => n.trim());
    }
    return [
      'https://api.hive.blog',
      'https://api.deathwing.me',
      'https://rpc.ecency.com',
    ];
  },
} as const;

// ============================================================================
// EXTERNAL SERVICES
// ============================================================================

export const EXTERNAL_SERVICES = {
  /** DAO GraphQL API */
  DAO_GRAPHQL_URL: process.env.NEXT_PUBLIC_DAO_GRAPHQL_URL || 'https://api.goldsky.com/api/public/project_cm33ek8kjx6pz010i2c3w8z25/subgraphs/nouns-builder-base-mainnet/latest/gn',

  /** Hive signer URL */
  HIVE_SIGNER_URL: 'https://hivesigner.com',

  /** Signup signer service URL */
  SIGNER_URL: 'https://minivlad.tail83ea3e.ts.net',

  /** Signup signer token fallback (override via env) */
  SIGNER_TOKEN: 'd1fa4884f3c12b49b922c96ad93413416e19a5dcde50499ee473c448622c54d9',
} as const;


// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Supabase configuration type
 */
export interface SupabaseConfig {
  url: string;
  publicKey: string;
}

/**
 * Get Supabase configuration from environment variables.
 * Validates that required env vars are present and throws descriptive errors if not.
 * 
 * @throws Error if required environment variables are missing
 */
export function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY;

  const missingVars: string[] = [];

  if (!url) {
    missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!publicKey) {
    missingVars.push('NEXT_PUBLIC_SUPABASE_PUBLIC_KEY');
  }

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required Supabase environment variables: ${missingVars.join(', ')}. ` +
      `Please check your .env.local file. See .env.local.example for reference.`
    );
  }

  return {
    url: url!,
    publicKey: publicKey!,
  };
}

/**
 * Get Supabase configuration without throwing errors.
 * Returns undefined values for missing env vars - callers must handle absence.
 */
export function getSupabaseConfigSafe() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publicKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY,
  };
}
