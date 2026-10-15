import { useMemo } from 'react';
import { useAioha } from '@aioha/react-ui';
import { useAccount, useBalance } from 'wagmi';
import { usePortfolioContext } from '@/contexts/PortfolioContext';
import useHiveAccount from '@/hooks/useHiveAccount';
import { extractNumber } from '@/lib/utils/extractNumber';
import { tokenDictionary } from '@/lib/utils/tokenDictionary';

interface TokenBalance {
  symbol: string;
  balance: string;
  network: string;
  usdValue?: number;
}

export function useUserBalances() {
  const { user } = useAioha();
  const { isConnected: isEthereumConnected, address: ethereumAddress } = useAccount();
  const { hiveAccount } = useHiveAccount(user || '');
  const { aggregatedPortfolio } = usePortfolioContext();

  // Helper function to convert Hive asset to string
  const assetToString = (asset: any): string => {
    if (!asset) return '0.000';
    if (typeof asset === 'string') return asset;
    if (typeof asset === 'object' && asset.amount !== undefined) {
      return `${asset.amount} ${asset.symbol}`;
    }
    return String(asset);
  };

  // Get Hive token balances
  const hiveBalances = useMemo(() => {
    const balances: TokenBalance[] = [];

    if (user && hiveAccount) {
      // HIVE balance
      const hiveBalance = hiveAccount.balance
        ? String(extractNumber(assetToString(hiveAccount.balance)))
        : '0';
      
      balances.push({
        symbol: 'HIVE',
        balance: hiveBalance,
        network: 'hive',
      });

      // HBD balance
      const hbdBalance = hiveAccount.hbd_balance
        ? String(extractNumber(assetToString(hiveAccount.hbd_balance)))
        : '0';
      
      balances.push({
        symbol: 'HBD',
        balance: hbdBalance,
        network: 'hive',
      });
    }

    return balances;
  }, [user, hiveAccount]);

  // Get Ethereum token balances
  const ethereumBalances = useMemo(() => {
    const balances: TokenBalance[] = [];

    if (isEthereumConnected && aggregatedPortfolio?.tokens) {
      // Get unique tokens by symbol
      const tokenMap = new Map<string, any>();
      
      aggregatedPortfolio.tokens.forEach(tokenDetail => {
        const symbol = tokenDetail.token.symbol;
        const existingToken = tokenMap.get(symbol);
        
        if (!existingToken || tokenDetail.token.balance > existingToken.token.balance) {
          tokenMap.set(symbol, tokenDetail);
        }
      });

      // Convert to balance format
      tokenMap.forEach(tokenDetail => {
        // Only include tokens that are in our token dictionary (supported for airdrops).
        // Match on contract address too: some tokens report a symbol that differs
        // from the dictionary key in case (BOAR is "boar" on-chain).
        const address = tokenDetail.token.address?.toLowerCase();
        const dictionaryKey = tokenDictionary[tokenDetail.token.symbol]
          ? tokenDetail.token.symbol
          : Object.keys(tokenDictionary).find(
              (key) => tokenDictionary[key].address.toLowerCase() === address
            );
        if (dictionaryKey) {
          balances.push({
            symbol: dictionaryKey,
            balance: tokenDetail.token.balance.toFixed(6),
            network: tokenDetail.network,
            usdValue: tokenDetail.token.balanceUSD,
          });
        }
      });
    }

    return balances;
  }, [isEthereumConnected, aggregatedPortfolio]);

  // Combine all balances
  const allBalances = useMemo(() => {
    return [...hiveBalances, ...ethereumBalances];
  }, [hiveBalances, ethereumBalances]);

  // Get balance for specific token
  const getTokenBalance = (tokenSymbol: string): TokenBalance | null => {
    return allBalances.find(balance => balance.symbol === tokenSymbol) || null;
  };

  return {
    balances: allBalances,
    getTokenBalance,
    isHiveConnected: !!user,
    isEthereumConnected,
  };
}
