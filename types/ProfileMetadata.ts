import { VideoPart } from './VideoPart';

export interface SkatehiveExtensions {
  eth_address?: string; // Legacy field for backward compatibility (used for Zora profile)
  wallets?: {
    primary_wallet?: string;
    additional?: string[];
    btc_address?: string;
  };
  farcaster?: {
    fid?: number;
    username?: string;
    custody_address?: string;
    verified_wallets?: string[];
  };
  video_parts?: VideoPart[];
  other?: Record<string, any>;
  settings?: {
    voteSettings?: {
      default_voting_weight: number;
      enable_slider: boolean;
    };
    appSettings?: {
      zineCover?: string;
      svs_profile?: string;
      [key: string]: any;
    };
  };
}

export interface LegacyUserExtensions {
  extensions?: {
    eth_address?: string;
    video_parts?: VideoPart[];
    level?: number;
    staticXp?: number;
    cumulativeXp?: number;
  };
}

export interface SkatehiveJsonMetadata {
  profile?: {
    name?: string;
    about?: string;
    location?: string;
    website?: string;
    profile_image?: string;
    cover_image?: string;
    version?: number;
  };
  extensions?: SkatehiveExtensions;
}
