'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { PortfolioData } from '../types/portfolio';

interface PortfolioContextType {
    portfolio: PortfolioData | null;
    isLoading: boolean;
    error: string | null;
    refetch: () => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

interface PortfolioProviderProps {
    children: ReactNode;
    address: string | undefined;
}

export function PortfolioProvider({ children, address }: PortfolioProviderProps) {
    const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPortfolio = useCallback(async () => {
        if (!address) {
            setPortfolio(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/portfolio/${address}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch portfolio');
            }

            setPortfolio(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, [address]);

    useEffect(() => {
        fetchPortfolio();
    }, [fetchPortfolio]);

    // Memoize the context value to prevent unnecessary re-renders
    const contextValue = useMemo(() => ({
        portfolio,
        isLoading,
        error,
        refetch: fetchPortfolio
    }), [portfolio, isLoading, error, fetchPortfolio]);

    return (
        <PortfolioContext.Provider value={contextValue}>
            {children}
        </PortfolioContext.Provider>
    );
}

export function usePortfolioContext() {
    const context = useContext(PortfolioContext);
    if (context === undefined) {
        throw new Error('usePortfolioContext must be used within a PortfolioProvider');
    }
    return context;
}
