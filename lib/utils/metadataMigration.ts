import { DEFAULT_VOTE_WEIGHT } from './constants';
import { SkatehiveJsonMetadata } from '@/types/ProfileMetadata';

export function isLegacyMetadata(data: any): boolean {
  if (!data || !data.extensions) return false;
  const ext = data.extensions;
  return (
    ext.eth_address !== undefined ||
    ext.vote_weight !== undefined ||
    ext.farcasterName !== undefined ||
    ext.fid !== undefined ||
    ext.level !== undefined ||
    ext.staticXp !== undefined ||
    ext.cumulativeXp !== undefined
  );
}

export function migrateLegacyMetadata(data: any): SkatehiveJsonMetadata {
  const metadata: SkatehiveJsonMetadata = {
    ...data,
    profile: data?.profile || {},
    extensions: data?.extensions || {}
  };

  const ext: any = metadata.extensions;

  // Wallet migrations - keep eth_address in same location for legacy compatibility
  if (ext.eth_address) {
    ext.wallets = ext.wallets || {};
    ext.wallets.primary_wallet = ext.eth_address;
    // Keep the original eth_address for legacy compatibility
  }
  if (ext.btc_address) {
    ext.wallets = ext.wallets || {};
    ext.wallets.btc_address = ext.btc_address;
    delete ext.btc_address;
  }

  if (ext.vote_weight !== undefined) {
    ext.settings = ext.settings || {};
    ext.settings.voteSettings = ext.settings.voteSettings || {
      default_voting_weight: DEFAULT_VOTE_WEIGHT * 100,
      enable_slider: true
    };
    ext.settings.voteSettings.default_voting_weight = Math.round(
      Number(ext.vote_weight) * 100
    );
    delete ext.vote_weight;
  }

  if (ext.disable_slider !== undefined) {
    ext.settings = ext.settings || {};
    ext.settings.voteSettings = ext.settings.voteSettings || {
      default_voting_weight: DEFAULT_VOTE_WEIGHT * 100,
      enable_slider: true
    };
    ext.settings.voteSettings.enable_slider = !ext.disable_slider;
    delete ext.disable_slider;
  }

  if (ext.farcasterName || ext.fid) {
    ext.farcaster = ext.farcaster || {};
    if (ext.farcasterName) {
      ext.farcaster.username = ext.farcasterName;
      delete ext.farcasterName;
    }
    if (ext.fid) {
      ext.farcaster.fid = Number(ext.fid);
      delete ext.fid;
    }
  }

  delete ext.level;
  delete ext.staticXp;
  delete ext.cumulativeXp;

  // Ensure substructures exist
  ext.wallets = ext.wallets || {};
  ext.wallets.additional = ext.wallets.additional || [];

  ext.settings = ext.settings || {};
  ext.settings.voteSettings = ext.settings.voteSettings || {
    default_voting_weight: DEFAULT_VOTE_WEIGHT * 100,
    enable_slider: true
  };
  ext.settings.appSettings = ext.settings.appSettings || {};

  ext.other = ext.other || {};

  metadata.extensions = ext;
  return metadata;
}
