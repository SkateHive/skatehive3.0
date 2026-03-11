// Temporary stub for auth/merge dependencies
export function migrateLegacyMetadata(...args: any[]) {
  console.warn('metadataMigration not implemented yet');
  return { 
    extensions: {
      wallets: {},
      farcaster: {},
      settings: {}
    } 
  };
}
