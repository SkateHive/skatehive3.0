import { DAO_ADDRESSES as CONFIG_DAO_ADDRESSES, ETH_ADDRESSES, APP_CONFIG, EXTERNAL_SERVICES, getSupabaseConfigSafe } from '@/config/app.config';

// Web3/Blockchain configuration - all from centralized APP_CONFIG
export const WC_PROJECT_ID = APP_CONFIG.WALLETCONNECT_PROJECT_ID;
export const GRAPHQL_URL = EXTERNAL_SERVICES.DAO_GRAPHQL_URL;

// Re-export DAO_ADDRESSES from config
export const DAO_ADDRESSES = CONFIG_DAO_ADDRESSES;


export const SKATEHIVE_BASE_MULTISIG = ETH_ADDRESSES.SKATEHIVE_MULTISIG;
export const AIRDROP_CONTRACT_ADDRESS = ETH_ADDRESSES.AIRDROP_CONTRACT;
export const SKATEHIVE_HOT_ADDRESS = ETH_ADDRESSES.SKATEHIVE_HOT;
export const USDC_CONTRACT_ADDRESS = ETH_ADDRESSES.USDC;
export const SKATEHIVE_ERC20_ADDRESS = ETH_ADDRESSES.SKATEHIVE_ERC20;
export const GNARS_ERC20_ADDRESS = ETH_ADDRESSES.GNARS_ERC20;
export const HIGHER_ERC20_ADDRESS = ETH_ADDRESSES.HIGHER_ERC20;
export const BOAR_ERC20_ADDRESS = ETH_ADDRESSES.BOAR_ERC20;

// Supabase config - use getSupabaseConfigSafe() to avoid build-time errors
// Callers should handle undefined values or use getSupabaseConfig() for validation
const supabaseConfig = getSupabaseConfigSafe();
export const SUPABASE = {
  url: supabaseConfig.url,
  public_key: supabaseConfig.publicKey,
};
export const PINATA_URL = APP_CONFIG.PINATA_GATEWAY;

// Default vote weight for snaps and posts (percentage)
export const DEFAULT_VOTE_WEIGHT: number = APP_CONFIG.DEFAULT_VOTE_WEIGHT; 