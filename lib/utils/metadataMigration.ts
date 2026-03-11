// Temporary stub for auth/merge dependencies
export function migrateLegacyMetadata(...args: any[]): any {
  console.warn('metadataMigration not implemented yet');
  // Return minimal structure that satisfies all type checks
  return { 
    extensions: {
      eth_address: undefined,
      wallets: {
        primary_wallet: undefined,
        additional: []
      },
      farcaster: {
        custody_address: undefined,
        verified_wallets: []
      },
      settings: {
        voteSettings: {
          default_voting_weight: undefined,
          enable_slider: undefined
        }
      }
    } 
  };
}
