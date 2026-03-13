import type { Discussion } from '@hiveio/dhive';
import type { PoidhBounty } from '@/types/poidh';
import type { UnifiedBounty } from '@/types/unified-bounty';
import { extractFirstImage } from '@/lib/poidh-utils';
import { CHAIN_LABEL_SHORT } from '@/lib/poidh-constants';
import { formatEther } from 'viem';

// ── Hive bounty regex helpers ────────────────────────────────

function parseHiveTitle(body: string): string {
  const match = body.match(/Trick\/Challenge:\s*(.*)/);
  return match?.[1]?.trim() || '';
}

function parseHiveRules(body: string): string {
  const match = body.match(/Bounty Rules:\s*([\s\S]*?)(?:\n|$)/);
  return match?.[1]?.trim() || '';
}

function parseHiveReward(body: string): { amount: number; currency: string } {
  const match = body.match(/Reward:\s*([0-9.]+)\s*(HIVE|HBD)?/i);
  if (!match) return { amount: 0, currency: 'HIVE' };
  return {
    amount: parseFloat(match[1]) || 0,
    currency: (match[2] || 'HIVE').toUpperCase(),
  };
}

function parseHiveDeadline(body: string): number | null {
  const match = body.match(/Deadline:\s*(\d{2}-\d{2}-\d{4})/);
  if (!match) return null;
  const [mm, dd, yyyy] = match[1].split('-');
  const date = new Date(`${yyyy}-${mm}-${dd}T23:59:59`);
  return isNaN(date.getTime()) ? null : Math.floor(date.getTime() / 1000);
}

// ── Normalizers ──────────────────────────────────────────────

export function normalizeHiveBounty(
  discussion: Discussion,
  submissionCount: number = 0,
  isRewarded: boolean = false,
  winnerUsername: string | null = null,
): UnifiedBounty {
  const title = parseHiveTitle(discussion.body);
  const rules = parseHiveRules(discussion.body);
  const { amount, currency } = parseHiveReward(discussion.body);
  const deadline = parseHiveDeadline(discussion.body);
  const now = Math.floor(Date.now() / 1000);

  let isActive = true;
  let statusLabel: UnifiedBounty['statusLabel'] = 'OPEN';
  if (isRewarded || (deadline && deadline < now)) {
    isActive = false;
    statusLabel = 'CLOSED';
  }

  const createdAt = Math.floor(new Date(discussion.created).getTime() / 1000);
  const imageUrl = extractFirstImage(discussion.body);

  return {
    id: `hive:${discussion.author}/${discussion.permlink}`,
    source: 'hive',
    title: title || discussion.title || 'Untitled Bounty',
    description: rules,
    imageUrl,
    rewardAmount: amount,
    rewardCurrency: currency,
    rewardDisplay: `${amount} ${currency}`,
    isActive,
    statusLabel,
    createdAt,
    deadline,
    submissionCount,
    claimCount: discussion.active_votes?.length ?? 0,
    authorDisplay: `@${discussion.author}`,
    authorAvatar: `https://images.hive.blog/u/${discussion.author}/avatar/sm`,
    winnerDisplay: winnerUsername ? `@${winnerUsername}` : null,
    winnerAvatar: winnerUsername
      ? `https://images.hive.blog/u/${winnerUsername}/avatar/sm`
      : null,
    detailHref: `/post/${discussion.author}/${discussion.permlink}`,
    chainLabel: null,
    _hiveDiscussion: discussion,
  };
}

export function normalizePoidhBounty(bounty: PoidhBounty): UnifiedBounty {
  let amountInEth = 0;
  try {
    amountInEth = parseFloat(formatEther(BigInt(bounty.amount || '0')));
  } catch {
    amountInEth = 0;
  }

  const chainId = bounty.chainId ?? 8453;
  const isActive = bounty.isActive ?? false;
  const statusLabel: UnifiedBounty['statusLabel'] = isActive ? 'OPEN' : 'CLOSED' as const;

  const createdAt = bounty.createdAt > 0 ? bounty.createdAt : 0;

  // Winner from claimer address
  const winnerDisplay = bounty.claimer
    ? `${bounty.claimer.slice(0, 6)}...${bounty.claimer.slice(-4)}`
    : null;

  return {
    id: `poidh:${chainId}-${bounty.id}`,
    source: 'poidh',
    title: bounty.name || 'Untitled Bounty',
    description: bounty.description || '',
    imageUrl: bounty.imageUrl ?? null,
    rewardAmount: amountInEth,
    rewardCurrency: 'ETH',
    rewardDisplay: `${amountInEth < 0.001 ? amountInEth.toFixed(6) : amountInEth.toFixed(4)} ETH`,
    isActive,
    statusLabel,
    createdAt,
    deadline: null,
    submissionCount: bounty.claimCount ?? 0,
    claimCount: bounty.claimCount ?? 0,
    authorDisplay: bounty.issuer
      ? `${bounty.issuer.slice(0, 6)}...${bounty.issuer.slice(-4)}`
      : '???',
    authorAvatar: null,
    winnerDisplay,
    winnerAvatar: null,
    detailHref: `/bounties/poidh/${chainId}/${bounty.id}`,
    chainLabel: CHAIN_LABEL_SHORT[chainId] ?? null,
    _poidhBounty: bounty,
  };
}
