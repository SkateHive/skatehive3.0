"use client";

import { TokenDetail, blockchainDictionary } from "../../../types/portfolio";
import { useAccount } from "wagmi";
import { useProfile } from '@farcaster/auth-kit';
import { usePortfolioContext } from "../../../contexts/PortfolioContext";

export type WalletSourceType = 'ethereum' | 'farcaster' | 'verified';

export interface WalletSourceInfo {
    type: WalletSourceType;
    label: string;
    walletLabel: string;
    networkLabel: string;
}

export function getWalletSource(tokenDetail: TokenDetail): WalletSourceInfo {
    const networkInfo = blockchainDictionary[tokenDetail.network];
    const networkLabel = networkInfo?.alias || tokenDetail.network;

    // Use the source tag if available (from enhanced aggregation)
    if (tokenDetail.source) {
        switch (tokenDetail.source) {
            case 'ethereum':
                return {
                    type: 'ethereum',
                    label: `Ethereum Wallet on ${networkLabel}`,
                    walletLabel: 'Ethereum Wallet',
                    networkLabel: networkLabel
                };
            case 'farcaster':
                return {
                    type: 'farcaster',
                    label: `Farcaster Wallet on ${networkLabel}`,
                    walletLabel: 'Farcaster Wallet',
                    networkLabel: networkLabel
                };
            case 'verified':
                return {
                    type: 'verified',
                    label: `Farcaster Wallet (${tokenDetail.sourceAddress?.slice(0, 6)}...${tokenDetail.sourceAddress?.slice(-4)}) on ${networkLabel}`,
                    walletLabel: `Farcaster Wallet (${tokenDetail.sourceAddress?.slice(0, 6)}...${tokenDetail.sourceAddress?.slice(-4)})`,
                    networkLabel: networkLabel
                };
            default:
                return {
                    type: 'ethereum',
                    label: `Unknown Source on ${networkLabel}`,
                    walletLabel: 'Unknown Source',
                    networkLabel: networkLabel
                };
        }
    }

    // Fallback logic - this should ideally be handled at the component level
    // since it requires access to hooks
    return {
        type: 'ethereum',
        label: `Unknown Source on ${networkLabel}`,
        walletLabel: 'Unknown Source',
        networkLabel: networkLabel
    };
}

// Hook version for legacy support where source tag is not available
export function useWalletSource(tokenDetail: TokenDetail): WalletSourceInfo {
    const { address } = useAccount();
    const { profile: farcasterProfile } = useProfile();
    const { portfolio, farcasterPortfolio, farcasterVerifiedPortfolios } = usePortfolioContext();

    const networkInfo = blockchainDictionary[tokenDetail.network];
    const networkLabel = networkInfo?.alias || tokenDetail.network;

    // Use the source tag if available (from enhanced aggregation)
    if (tokenDetail.source) {
        return getWalletSource(tokenDetail);
    }

    // Fallback to legacy detection logic if source tag is not available
    const ethAddress = address?.toLowerCase();
    const farcasterAddress = farcasterProfile?.custody?.toLowerCase();

    // Check if token exists in farcaster portfolio and we have a farcaster address different from ethereum
    if (farcasterPortfolio?.tokens?.some(t =>
        t.token.address === tokenDetail.token.address &&
        t.network === tokenDetail.network
    ) && farcasterAddress && farcasterAddress !== ethAddress) {
        return {
            type: 'farcaster',
            label: `Farcaster Wallet on ${networkLabel}`,
            walletLabel: 'Farcaster Wallet',
            networkLabel: networkLabel
        };
    }

    // Check if token exists in ethereum portfolio
    if (portfolio?.tokens?.some(t =>
        t.token.address === tokenDetail.token.address &&
        t.network === tokenDetail.network
    )) {
        return {
            type: 'ethereum',
            label: `Ethereum Wallet on ${networkLabel}`,
            walletLabel: 'Ethereum Wallet',
            networkLabel: networkLabel
        };
    }

    // Check if token exists in any verified address portfolio
    for (const [addr, portfolioData] of Object.entries(farcasterVerifiedPortfolios)) {
        if (portfolioData.tokens?.some(t =>
            t.token.address === tokenDetail.token.address &&
            t.network === tokenDetail.network
        )) {
            return {
                type: 'verified',
                label: `Farcaster Wallet (${addr.slice(0, 6)}...${addr.slice(-4)}) on ${networkLabel}`,
                walletLabel: `Farcaster Wallet (${addr.slice(0, 6)}...${addr.slice(-4)})`,
                networkLabel: networkLabel
            };
        }
    }

    // Fallback
    return {
        type: 'ethereum',
        label: `Unknown Source on ${networkLabel}`,
        walletLabel: 'Unknown Source',
        networkLabel: networkLabel
    };
}
