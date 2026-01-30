// Re-export the singleton wagmi config from providers to avoid duplicate WalletConnect initialization
// All contract operations should use this single config
import { wagmiConfig } from '@/app/providers';

export function getConfig() {
  return wagmiConfig;
}

declare module 'wagmi' {
  interface WagmiRegister {
    config: typeof wagmiConfig;
  }
}
