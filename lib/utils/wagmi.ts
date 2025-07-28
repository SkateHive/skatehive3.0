import { cookieStorage, createConfig, createStorage, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';
import { WC_PROJECT_ID } from './constants';

export function getConfig() {
  return createConfig({
    chains: [base],
    connectors: [
      injected(),
      // coinbaseWallet(),
      walletConnect({ projectId: WC_PROJECT_ID }),
    ],
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    transports: {
      [base.id]: http(),
    },
  });
}

declare module 'wagmi' {
  interface WagmiRegister {
    config: ReturnType<typeof getConfig>;
  }
} 