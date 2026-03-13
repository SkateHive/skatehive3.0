/**
 * DAO Configuration
 * Maps Builder DAOs for multi-DAO support
 */

import { base } from 'viem/chains';
import { BuilderDaoConfig } from './types';
import { DAO_ADDRESSES, EXTERNAL_SERVICES } from '@/config/app.config';

// ============================================================================
// SKATEHIVE DAO (Primary)
// ============================================================================

export const SKATEHIVE_DAO: BuilderDaoConfig = {
  name: 'Skatehive DAO',
  domain: 'skatehive.app',
  chainId: base.id,
  subgraphUrl: EXTERNAL_SERVICES.DAO_GRAPHQL_URL,
  addresses: DAO_ADDRESSES,
};

// ============================================================================
// GNARS DAO (for cross-reference support)
// ============================================================================

export const GNARS_DAO: BuilderDaoConfig = {
  name: 'Gnars DAO',
  domain: 'www.gnars.com',
  chainId: base.id,
  subgraphUrl: 'https://api.goldsky.com/api/public/project_clkk1ucdyf6ak38svcatie9tf/subgraphs/nouns-builder-base-mainnet/stable/gn',
  addresses: {
    token: '0x880fb3cf5c6cc2d7dfc13a993e839a9411200c17',
    auction: '0x494eaa55ecf6310658b8fc004b0888dcb698097f',
    governor: '0x3dd4e53a232b7b715c9ae455f4e732465ed71b4c',
    treasury: '0x72ad986ebac0246d2b3c565ab2a1ce3a14ce6f88',
    metadata: '0xdc9799d424ebfdcf5310f3bad3ddcce3931d4b58',
  },
};

// ============================================================================
// BUILDER DAOS REGISTRY
// ============================================================================

export const BUILDER_DAOS: Record<string, BuilderDaoConfig> = {
  'skatehive.app': SKATEHIVE_DAO,
  'www.gnars.com': GNARS_DAO,
  'gnars.com': GNARS_DAO, // Support both with and without www
  // More Builder DAOs can be added here:
  // 'nouns.wtf': NOUNS_DAO,
  // 'lilnouns.wtf': LIL_NOUNS_DAO,
};

/**
 * Normalize domain by removing www prefix
 * @param domain - Domain from URL
 * @returns Normalized domain
 */
function normalizeDomain(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, '');
}

/**
 * Get DAO config by domain
 * @param domain - Domain from URL (e.g. "www.gnars.com" or "gnars.com")
 * @returns DAO config or undefined
 */
export function getDaoByDomain(domain: string): BuilderDaoConfig | undefined {
  const normalized = normalizeDomain(domain);
  
  // Try normalized domain first
  if (BUILDER_DAOS[normalized]) {
    return BUILDER_DAOS[normalized];
  }
  
  // Try with www prefix
  if (BUILDER_DAOS[`www.${normalized}`]) {
    return BUILDER_DAOS[`www.${normalized}`];
  }
  
  // Try exact match as fallback
  return BUILDER_DAOS[domain.toLowerCase()];
}

/**
 * Extract domain and proposal ID from URL
 * @param url - Full proposal URL
 * @returns { domain, proposalId } or null
 */
export function parseProposalUrl(url: string): { domain: string; proposalId: string } | null {
  const regex = /https?:\/\/(?:www\.)?([^\/]+)\/proposals\/(\d+)/i;
  const match = url.match(regex);
  
  if (!match) return null;
  
  return {
    domain: match[1],
    proposalId: match[2],
  };
}
