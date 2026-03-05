"use client";

import { useState, useCallback, useEffect } from 'react';
import { TransactionStatus, TransactionState } from '@/types/airdrop';

interface UseTransactionStatusOptions {
  persistKey?: string;
  autoReset?: boolean;
  resetDelay?: number;
}

export const useTransactionStatus = (options: UseTransactionStatusOptions = {}) => {
  const { persistKey, autoReset = false, resetDelay = 10000 } = options;
  
  const getInitialStatus = (): TransactionStatus => {
    if (
      persistKey &&
      typeof window !== 'undefined' &&
      typeof localStorage !== 'undefined' &&
      typeof localStorage.getItem === 'function'
    ) {
      const saved = localStorage.getItem(`airdrop_status_${persistKey}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Don't restore in-progress states
          if (['idle', 'completed', 'failed', 'cancelled'].includes(parsed.state)) {
            return parsed;
          }
        } catch (error) {
          console.warn('Failed to parse saved transaction status:', error);
        }
      }
    }
    return { state: 'idle', message: '' };
  };

  const [status, setStatus] = useState<TransactionStatus>(getInitialStatus);
  
  const updateStatus = useCallback((newStatus: Partial<TransactionStatus>) => {
    setStatus(prev => {
      const updated = { ...prev, ...newStatus };
      
      // Persist to localStorage if key provided
      if (
        persistKey &&
        typeof window !== 'undefined' &&
        typeof localStorage !== 'undefined' &&
        typeof localStorage.setItem === 'function'
      ) {
        localStorage.setItem(`airdrop_status_${persistKey}`, JSON.stringify(updated));
      }
      
      return updated;
    });
  }, [persistKey]);
  
  const resetStatus = useCallback(() => {
    const resetState: TransactionStatus = { state: 'idle', message: '' };
    setStatus(resetState);
    
    // Clear persistence
    if (persistKey && typeof window !== 'undefined') {
      localStorage.removeItem(`airdrop_status_${persistKey}`);
    }
  }, [persistKey]);

  const cancelTransaction = useCallback(() => {
    updateStatus({
      state: 'cancelled',
      message: 'Transaction cancelled by user'
    });
  }, [updateStatus]);

  // Auto-reset after completion/failure
  useEffect(() => {
    if (autoReset && (status.state === 'completed' || status.state === 'failed')) {
      const timer = setTimeout(resetStatus, resetDelay);
      return () => clearTimeout(timer);
    }
  }, [status.state, autoReset, resetDelay, resetStatus]);

  const isInProgress = [
    'preparing',
    'approval-pending', 
    'approval-confirming',
    'transfer-pending',
    'transfer-confirming'
  ].includes(status.state);

  const canCancel = isInProgress && !['approval-confirming', 'transfer-confirming'].includes(status.state);

  return { 
    status, 
    updateStatus, 
    resetStatus, 
    cancelTransaction,
    isInProgress,
    canCancel
  };
};
