# DAO Module Documentation

Complete implementation of Builder DAO integration for Skatehive.

## 📦 Structure

```
lib/dao/
├── types.ts           # Shared TypeScript types
├── config.ts          # Multi-DAO configuration
├── auction.ts         # Auction service (GraphQL)
├── governance.ts      # Governance service (GraphQL)
└── README.md          # This file

hooks/dao/
├── useAuction.ts      # Auction hooks
├── useProposals.ts    # Proposals list hook
├── useProposal.ts     # Single proposal hook
├── useVotingPower.ts  # Voting power check
└── useVote.ts         # Vote submission

components/dao/
├── auction/           # Auction components
│   ├── AuctionPage.tsx
│   ├── AuctionCard.tsx
│   ├── AuctionHistory.tsx
│   └── ...
├── governance/        # Governance components
│   ├── ProposalPreview.tsx       # Mini-app for markdown
│   ├── ProposalsList.tsx         # Proposals list
│   └── ProposalDetailClient.tsx  # Full proposal page
└── DAOPageClient.tsx  # Main DAO page with tabs
```

---

## 🚀 Features

### 1. Auction System
- ✅ Fetch auctions via GraphQL subgraph
- ✅ Display current and historical auctions
- ✅ Auction cards with bid history
- ✅ Integration with Builder DAO contracts

### 2. Governance System
- ✅ Fetch proposals via GraphQL subgraph
- ✅ Display proposal status (Active/Pending/Succeeded/etc)
- ✅ Vote on active proposals (For/Against/Abstain)
- ✅ Check voting power
- ✅ View full proposal details

### 3. Markdown Integration
- ✅ Auto-detect proposal URLs in markdown
- ✅ Render mini-app preview with voting interface
- ✅ Support for multiple Builder DAOs

### 4. Multi-DAO Support
- ✅ Skatehive DAO (primary)
- ✅ Gnars DAO (reference)
- ✅ Extensible config for adding more DAOs

---

## 🔧 Configuration

### Add a new Builder DAO:

```typescript
// lib/dao/config.ts
export const NEW_DAO: BuilderDaoConfig = {
  name: 'New DAO',
  domain: 'newdao.eth',
  chainId: base.id,
  subgraphUrl: 'https://api.goldsky.com/...',
  addresses: {
    token: '0x...',
    auction: '0x...',
    governor: '0x...',
    treasury: '0x...',
    metadata: '0x...',
  },
};

// Register in BUILDER_DAOS
export const BUILDER_DAOS: Record<string, BuilderDaoConfig> = {
  'skatehive.app': SKATEHIVE_DAO,
  'www.gnars.com': GNARS_DAO,
  'newdao.eth': NEW_DAO, // Add here
};
```

---

## 📝 Usage Examples

### Fetch Proposals

```typescript
import { useProposals } from '@/hooks/dao/useProposals';
import { DAO_ADDRESSES } from '@/lib/utils/constants';

function MyComponent() {
  const { data: proposals, isLoading } = useProposals(
    DAO_ADDRESSES.token,
    50 // limit
  );

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {proposals?.map((proposal) => (
        <div key={proposal.proposalId}>
          {proposal.title}
        </div>
      ))}
    </div>
  );
}
```

### Vote on Proposal

```typescript
import { useVote } from '@/hooks/dao/useVote';
import { DAO_ADDRESSES } from '@/lib/utils/constants';

function VoteButtons({ proposalId }: { proposalId: string }) {
  const { vote, isPending } = useVote(DAO_ADDRESSES.governor);

  return (
    <>
      <button
        onClick={() => vote(proposalId, 1)} // 1 = For
        disabled={isPending}
      >
        Vote For
      </button>
      <button
        onClick={() => vote(proposalId, 0)} // 0 = Against
        disabled={isPending}
      >
        Vote Against
      </button>
    </>
  );
}
```

### Check Voting Power

```typescript
import { useVotingPower } from '@/hooks/dao/useVotingPower';
import { useAccount } from 'wagmi';
import { DAO_ADDRESSES } from '@/lib/utils/constants';

function VotingPowerDisplay() {
  const { address } = useAccount();
  const { data: votingPower } = useVotingPower(
    DAO_ADDRESSES.governor,
    address
  );

  return <div>Your voting power: {votingPower?.toString()} votes</div>;
}
```

---

## 🎨 Markdown Integration

When users paste a proposal URL in markdown:

```markdown
Check out this proposal:
https://www.gnars.com/proposals/118
```

It automatically renders as an interactive mini-app:

```
┌────────────────────────────────────────┐
│ 🏛️ Gnars DAO - Proposal #118          │
│ ✅ Active                              │
├────────────────────────────────────────┤
│ Gnars Operations - Q1 2026            │
│ 👤 Proposer: r4topu...                │
│                                        │
│ ✅ For: 65%  ████████░░                │
│ ❌ Against: 19%  ██░░░░░░░             │
│ 🎯 Threshold: 600 votes                │
│                                        │
│ Your voting power: 5 votes             │
│ ┌─────┐ ┌────────┐ ┌────────┐         │
│ │ FOR │ │ AGAINST│ │ ABSTAIN│         │
│ └─────┘ └────────┘ └────────┘         │
│                                        │
│ 🔗 View Full Proposal                  │
└────────────────────────────────────────┘
```

---

## 🔗 Routes

### Main DAO Page
```
/dao
├── Proposals Tab     (ProposalsList)
├── Auctions Tab      (AuctionHistory)
└── Treasury Tab      (DAOAssets)
```

### Individual Proposal
```
/dao/proposals/[id]   (ProposalDetailClient)
```

### Individual Auction
```
/auction/[tokenId]    (AuctionPage)
```

---

## 🛠️ Technical Details

### GraphQL Queries

**Proposals:**
```graphql
query Proposals($where: Proposal_filter) {
  proposals(where: $where, orderBy: timeCreated, orderDirection: desc) {
    proposalId
    title
    description
    proposer
    forVotes
    againstVotes
    abstainVotes
    quorumVotes
    voteStart
    voteEnd
    executed
    canceled
    vetoed
  }
}
```

**Auctions:**
```graphql
query Auctions($where: Auction_filter) {
  auctions(where: $where, orderBy: endTime, orderDirection: desc) {
    bidCount
    endTime
    settled
    token {
      tokenId
      name
      image
    }
    highestBid {
      amount
      bidder
    }
  }
}
```

### Smart Contract Interactions

**Governor Contract Methods:**
- `castVote(proposalId, support)` - Vote on proposal
- `castVoteWithReason(proposalId, support, reason)` - Vote with reason
- `getVotes(account, timestamp)` - Check voting power
- `proposalThreshold()` - Get proposal threshold
- `quorum()` - Get quorum threshold

**Auction Contract Methods:**
- `auction()` - Get current auction data
- (Bidding is handled separately in AuctionBid component)

---

## 🧪 Testing

To test the implementation:

1. **Local Development:**
   ```bash
   pnpm dev
   ```

2. **Visit pages:**
   - `/dao` - Main DAO page
   - `/dao/proposals/[id]` - Individual proposal
   - `/auction/[id]` - Individual auction

3. **Test markdown:**
   - Create a post with a proposal URL
   - Verify mini-app renders correctly

---

## 📚 Resources

- Nouns Builder Docs: https://docs.nouns.build/
- Gnars DAO: https://www.gnars.com
- Builder Protocol GitHub: https://github.com/ourzora/nouns-protocol
- Skatehive DAO Config: `config/app.config.ts`

---

## 🐛 Troubleshooting

### Proposal not loading
- Check if subgraph URL is correct in config
- Verify proposalId format (should be bytes32 hash)
- Check network connection

### Voting not working
- Ensure wallet is connected
- Check if user has voting power
- Verify proposal status is "Active"
- Check if governor address is correct

### Mini-app not rendering
- Verify URL format matches regex in MarkdownProcessor
- Check if DAO domain is registered in BUILDER_DAOS
- Ensure ProposalPreview component is imported

---

Built with ❤️ by SkateHive Dev
