'use client';

/**
 * Stub for Farcaster miniapp SDK — miniapp host coupling removed.
 * Returns safe defaults so all consumers work without changes.
 * Farcaster auth is handled by @farcaster/auth-kit (web SIWE flow).
 */

interface FarcasterUser {
  fid: number;
  username: string;
  displayName?: string;
  pfpUrl?: string;
}

export const useFarcasterMiniapp = () => {
  const openUrl = async (url: string) => {
    window.open(url, '_blank');
  };

  const close = async () => {
    window.close();
  };

  const composeCast = async (_text: string, _embeds?: string[]) => {
    throw new Error('composeCast requires the Farcaster app');
  };

  const getWalletAddress = async (): Promise<string | null> => null;

  const connectWallet = async (): Promise<string | null> => null;

  return {
    isInMiniapp: false,
    user: null as FarcasterUser | null,
    isLoading: false,
    isReady: true,
    walletProvider: null,
    openUrl,
    close,
    composeCast,
    getWalletAddress,
    connectWallet,
  };
};
