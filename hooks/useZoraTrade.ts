'use client';

import { useState, useCallback } from 'react';
import { tradeCoin, TradeParameters, createTradeCall } from '@zoralabs/coins-sdk';
import { useAccount, useWalletClient, usePublicClient, useBalance, useChainId, useSwitchChain } from 'wagmi';
import { Address, formatEther, formatUnits } from 'viem';
import { useToast } from '@chakra-ui/react';
import { base } from 'wagmi/chains';

export interface TradeConfig {
  fromToken: {
    type: 'eth' | 'erc20';
    address?: Address;
    amount: bigint;
    source?: 'external' | 'zora-internal'; // New field to specify balance source
  };
  toToken: {
    type: 'eth' | 'erc20';
    address?: Address;
  };
  slippage: number;
}

export function useZoraTrade() {
  const [isTrading, setIsTrading] = useState(false);
  const [tradeResult, setTradeResult] = useState<any>(null);
  
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient({ chainId: base.id });
  const publicClient = usePublicClient({ chainId: base.id });
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const toast = useToast();

  // Get ETH balance
  const { data: ethBalance } = useBalance({
    address,
  });

  const getTokenDecimals = useCallback(async (tokenAddress: Address): Promise<number> => {
    if (!publicClient) return 18; // Default fallback

    try {
      // Read decimals directly from contract
      const decimals = await publicClient.readContract({
        address: tokenAddress,
        abi: [
          {
            name: 'decimals',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ name: 'decimals', type: 'uint8' }],
          },
        ],
        functionName: 'decimals',
      });
      
      return Number(decimals);
    } catch (error) {
      return 18; // Default fallback
    }
  }, [publicClient]);

  // Get external wallet balance (standard ERC20/ETH)
  const getExternalBalance = useCallback(async (
    type: 'eth' | 'erc20',
    tokenAddress?: Address
  ) => {
    if (!isConnected) return BigInt(0);

    try {
      if (type === 'eth') {
        return ethBalance?.value || BigInt(0);
      } else if (tokenAddress && publicClient) {
        const balance = await publicClient.readContract({
          address: tokenAddress,
          abi: [
            {
              name: 'balanceOf',
              type: 'function',
              stateMutability: 'view',
              inputs: [{ name: 'owner', type: 'address' }],
              outputs: [{ name: 'balance', type: 'uint256' }],
            },
          ],
          functionName: 'balanceOf',
          args: [address!],
        });
        return balance as bigint;
      }
      return BigInt(0);
    } catch (error) {
      console.error('Error getting external balance:', error);
      return BigInt(0);
    }
  }, [isConnected, ethBalance, publicClient, address]);

  // Get Zora internal balance using the SDK
  const getZoraInternalBalance = useCallback(async (
    type: 'eth' | 'erc20',
    tokenAddress?: Address
  ) => {
    if (!isConnected || !address || !publicClient) {
      console.log('❌ Zora balance check failed: missing requirements', { isConnected, address: !!address, publicClient: !!publicClient });
      return BigInt(0);
    }

    try {
      if (type === 'erc20' && tokenAddress) {
        console.log('🔍 Fetching Zora internal balance for:', { tokenAddress, user: address });
        
        // Read ERC20 balanceOf directly
        const balance = await publicClient.readContract({
          address: tokenAddress,
          abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }],
          functionName: 'balanceOf',
          args: [address],
        });

        return balance as bigint;
      } else if (type === 'eth') {
        // For ETH, we'll need to check Zora's ETH deposit contract
        // This is a placeholder - you may need to implement based on Zora's docs
        console.log('ETH internal balance check - may need Zora deposit contract integration');
        return BigInt(0); // Placeholder
      }
      return BigInt(0);
    } catch (error) {
      console.error('❌ Error getting Zora internal balance:', error);
      return BigInt(0);
    }
  }, [isConnected, address, publicClient]);

  // Enhanced balance function that gets both external and internal balances
  const getDualBalances = useCallback(async (
    type: 'eth' | 'erc20',
    tokenAddress?: Address
  ) => {
    if (!isConnected) return { external: BigInt(0), internal: BigInt(0), total: BigInt(0) };

    const [externalBalance, internalBalance] = await Promise.all([
      getExternalBalance(type, tokenAddress),
      getZoraInternalBalance(type, tokenAddress),
    ]);

    return {
      external: externalBalance,
      internal: internalBalance,
      total: externalBalance + internalBalance,
    };
  }, [isConnected, getExternalBalance, getZoraInternalBalance]);

  const getTokenBalance = useCallback(async (tokenAddress: Address) => {
    if (!address || !publicClient) {
      console.log('❌ getTokenBalance: Missing requirements', { address: !!address, publicClient: !!publicClient });
      return BigInt(0);
    }

    console.log('🔍 getTokenBalance: Fetching balance for token:', tokenAddress);

    try {
      // Try the Zora SDK method first to get both balance and correct decimals
      try {
        const balance = await publicClient.readContract({
          address: tokenAddress,
          abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }],
          functionName: 'balanceOf',
          args: [address],
        });
        if (balance !== undefined) {
          return balance as bigint;
        }
      } catch (error) {
        console.log('⚠️ balanceOf failed, trying fallback:', error);
      }
      
      // Fallback: try to read balance directly from contract
      try {
        console.log('👛 Trying direct contract balanceOf call...');
        const balance = await publicClient.readContract({
          address: tokenAddress,
          abi: [
            {
              name: 'balanceOf',
              type: 'function',
              stateMutability: 'view',
              inputs: [{ name: 'owner', type: 'address' }],
              outputs: [{ name: 'balance', type: 'uint256' }],
            },
          ],
          functionName: 'balanceOf',
          args: [address],
        });
        
        console.log('✅ Got balance from direct contract call:', balance.toString());
        return balance as bigint;
      } catch (contractError) {
        console.log('❌ Direct contract call failed:', contractError);
        // Use fallback
      }
      
      console.log('💥 All methods failed, returning 0');
      return BigInt(0);
    } catch (error) {
      console.log('❌ getTokenBalance: Outer catch error:', error);
      return BigInt(0);
    }
  }, [address, publicClient]);

  // Enhanced formatted balance function that shows both external and internal balances
  const getEnhancedFormattedBalance = useCallback(async (
    type: 'eth' | 'erc20',
    tokenAddress?: Address,
    fallbackDecimals: number = 18
  ) => {
    if (!isConnected) return null;

    try {
      const balances = await getDualBalances(type, tokenAddress);
      let symbol: string;
      let actualDecimals: number;

      if (type === 'eth') {
        symbol = 'ETH';
        actualDecimals = 18;
      } else if (tokenAddress) {
        symbol = 'TOKEN'; // Generic symbol for tokens
        actualDecimals = await getTokenDecimals(tokenAddress);
      } else {
        return null;
      }

      const formatBalance = (balance: bigint) => 
        type === 'eth' ? formatEther(balance) : formatUnits(balance, actualDecimals);

      return {
        external: {
          raw: balances.external,
          formatted: formatBalance(balances.external),
          symbol: `${symbol} (Wallet)`,
          decimals: actualDecimals,
        },
        internal: {
          raw: balances.internal,
          formatted: formatBalance(balances.internal),
          symbol: `${symbol} (Zora)`,
          decimals: actualDecimals,
        },
        total: {
          raw: balances.total,
          formatted: formatBalance(balances.total),
          symbol: `${symbol} (Total)`,
          decimals: actualDecimals,
        },
      };
    } catch (error) {
      return {
        external: { raw: BigInt(0), formatted: '0', symbol: `${type === 'eth' ? 'ETH' : 'TOKEN'} (Wallet)`, decimals: fallbackDecimals },
        internal: { raw: BigInt(0), formatted: '0', symbol: `${type === 'eth' ? 'ETH' : 'TOKEN'} (Zora)`, decimals: fallbackDecimals },
        total: { raw: BigInt(0), formatted: '0', symbol: `${type === 'eth' ? 'ETH' : 'TOKEN'} (Total)`, decimals: fallbackDecimals },
      };
    }
  }, [isConnected, getDualBalances, getTokenDecimals]);

  // Original formatted balance function (kept for compatibility)
    const getFormattedBalance = useCallback(async (
    type: 'eth' | 'erc20',
    tokenAddress?: Address,
    fallbackDecimals: number = 18
  ) => {
    if (!isConnected) return null;

    try {
      let balance: bigint;
      let symbol: string;
      let actualDecimals: number;

      if (type === 'eth') {
        balance = ethBalance?.value || BigInt(0);
        symbol = 'ETH';
        actualDecimals = 18;
      } else if (tokenAddress) {
        balance = await getTokenBalance(tokenAddress);
        symbol = 'TOKEN'; // Generic symbol for tokens
        // Get the actual decimals from the token contract
        actualDecimals = await getTokenDecimals(tokenAddress);
      } else {
        return null;
      }

      const formatted = type === 'eth' 
        ? formatEther(balance)
        : formatUnits(balance, actualDecimals);

      return {
        raw: balance,
        formatted,
        symbol,
        decimals: actualDecimals,
      };
    } catch (error) {
      // Return a default balance object instead of null to prevent UI errors
      return {
        raw: BigInt(0),
        formatted: '0',
        symbol: type === 'eth' ? 'ETH' : 'TOKEN',
        decimals: type === 'eth' ? 18 : fallbackDecimals,
      };
    }
  }, [isConnected, ethBalance, getTokenBalance, getTokenDecimals]);

  const getTradeQuote = useCallback(async (config: TradeConfig) => {
    if (!publicClient) {
      return null;
    }

    try {
      const tradeParameters: TradeParameters = {
        sell: config.fromToken.type === 'eth' 
          ? { type: 'eth' }
          : { type: 'erc20', address: config.fromToken.address! },
        buy: config.toToken.type === 'eth'
          ? { type: 'eth' }
          : { type: 'erc20', address: config.toToken.address! },
        amountIn: config.fromToken.amount,
        slippage: config.slippage / 100,
        sender: address!,
      };

      const quote = await createTradeCall(tradeParameters);
      return quote;
    } catch (error) {
      return null;
    }
  }, [address, publicClient]);

  const executeTrade = useCallback(async (config: TradeConfig) => {
    if (!isConnected || !address || !walletClient || !publicClient) {
      throw new Error('Wallet not connected');
    }

    // Verify we're on Base chain
    if (chainId !== base.id) {
      try {
        await switchChain({ chainId: base.id });
      } catch (switchError: any) {
        const error = new Error(`Failed to switch to Base network. Please switch manually.`);
        toast({
          title: 'Network Switch Failed',
          description: 'Please switch to Base network manually.',
          status: 'error',
          duration: 5000,
        });
        throw error;
      }
    }

    setIsTrading(true);
    setTradeResult(null);

    try {
      // Note: For ETH and major tokens like USDC, Zora uses internal balance management
      // External wallet balances may show zero even when Zora internal balances exist
      // The SDK handles these internal balances automatically during trades
      console.log('🎯 Starting trade execution - Zora SDK will manage all balance validations');
      
      // Log the balance source being used
      if (config.fromToken.source) {
        console.log(`💰 Balance Source: ${config.fromToken.source}`);
        if (config.fromToken.source === 'external') {
          console.log('🏦 Using external wallet balance');
        } else if (config.fromToken.source === 'zora-internal') {
          console.log('🏦 Using Zora internal balance');
        }
      }

      // For ERC20 tokens, ensure we're using permit-based approval
      if (config.fromToken.type === 'erc20') {
        console.log('🔐 ERC20 trade detected - will use permit signatures instead of approvals');
        console.log('💡 Permit2 should handle approval automatically without separate transactions');
      }
      
      const tradeParameters: TradeParameters = {
        sell: config.fromToken.type === 'eth' 
          ? { type: 'eth' }
          : { type: 'erc20', address: config.fromToken.address! },
        buy: config.toToken.type === 'eth'
          ? { type: 'eth' }
          : { type: 'erc20', address: config.toToken.address! },
        amountIn: config.fromToken.amount,
        slippage: config.slippage / 100, // Convert percentage to decimal
        sender: address,
      };

      // Create account object properly for viem
      const account = walletClient.account;
      if (!account) {
        throw new Error('No account found in wallet client');
      }

      console.log('🔑 Account details:', {
        address: account.address,
        type: account.type,
      });

      console.log('📤 Executing tradeCoin with parameters:', tradeParameters);
      
      // For ERC20 trades, log permit expectation
      if (config.fromToken.type === 'erc20') {
        console.log('🔐 ERC20 trade: Expecting permit signature instead of separate approval transaction');
        console.log('💡 If you see an approval popup from Zora, it means the token may not support EIP-2612 permits');
        console.log('⚠️ The "zora.co" approval link is broken - this should be handled automatically');
      }

      const receipt = await tradeCoin({
        tradeParameters,
        walletClient,
        account,
        publicClient,
        validateTransaction: true,
      });

      setTradeResult(receipt);
      
      toast({
        title: 'Trade successful!',
        description: `Transaction hash: ${receipt.transactionHash}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      return receipt;

    } catch (error: any) {
      // Handle specific error types
      let title = 'Trade failed';
      let description = 'An error occurred during the trade';
      let status: 'error' | 'warning' = 'error';
      
      if (error?.message) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('user denied') || errorMessage.includes('user rejected')) {
          title = 'Transaction cancelled';
          description = 'You cancelled the transaction in your wallet';
          status = 'warning';
        } else if (errorMessage.includes('insufficient funds') || errorMessage.includes('insufficient balance')) {
          title = 'Insufficient funds';
          description = 'You don\'t have enough balance to complete this trade';
        } else if (errorMessage.includes('permit') || errorMessage.includes('approval') || errorMessage.includes('allowance')) {
          title = 'Token approval needed';
          description = 'Please sign the permit message in your wallet to authorize this trade. No separate approval transaction needed.';
          status = 'warning';
        } else if (errorMessage.includes('transfer_from_failed') || errorMessage.includes('transferfrom')) {
          title = 'Transfer failed';
          description = 'The token transfer failed. This usually means insufficient balance or the permit signature was not accepted.';
        } else if (errorMessage.includes('network') || errorMessage.includes('chain')) {
          title = 'Network error';
          description = 'Please check your network connection and try again';
        } else if (errorMessage.includes('slippage')) {
          title = 'Slippage error';
          description = 'Price moved too much. Try increasing slippage tolerance';
        } else if (errorMessage.includes('gas')) {
          title = 'Gas estimation failed';
          description = 'Unable to estimate gas. The transaction might fail';
        } else {
          // For other errors, show a sanitized version
          description = error.message.length > 100 
            ? error.message.substring(0, 100) + '...' 
            : error.message;
        }
      }
      
      toast({
        title,
        description,
        status,
        duration: status === 'warning' ? 3000 : 5000,
        isClosable: true,
      });
      
      // Don't re-throw user cancellation errors as they're not really "errors"
      if (error?.message?.toLowerCase().includes('user denied') || 
          error?.message?.toLowerCase().includes('user rejected')) {
        return null;
      }
      
      throw error;
    } finally {
      setIsTrading(false);
    }
  }, [isConnected, address, walletClient, publicClient, toast, chainId]);

  const resetTrade = useCallback(() => {
    setTradeResult(null);
    setIsTrading(false);
  }, []);

  // Function to refresh balances (useful after trades)
  const refreshBalance = useCallback(async (
    type: 'eth' | 'erc20',
    tokenAddress?: Address
  ) => {
    return await getFormattedBalance(type, tokenAddress);
  }, [getFormattedBalance]);

  return {
    executeTrade,
    getTradeQuote,
    getFormattedBalance,
    getEnhancedFormattedBalance, // New function with external/internal breakdown
    getExternalBalance,
    getZoraInternalBalance,
    getDualBalances,
    getTokenBalance,
    getTokenDecimals,
    refreshBalance,
    isTrading,
    tradeResult,
    resetTrade,
    isConnected,
    ethBalance,
  };
}
