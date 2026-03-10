# POIDH Integration

Integration of POIDH v3 bounties into SkateHive bounties page.

## Overview

POIDH (Pics Or It Didn't Happen) is an onchain bounty protocol on Ethereum. This integration brings multichain bounties from Arbitrum, Base, and Degen chains into the SkateHive platform.

## Features

- ✅ Fetch bounties from POIDH v3 contract across 3 chains
- ✅ Filter bounties by skate-related keywords
- ✅ Categorize by status: Active, Completed, Cancelled
- ✅ Tab-based UI: Hive | POIDH | All
- ✅ Chain filtering (Arbitrum, Base, Degen)
- ✅ Display bounty details: amount, claims, type (solo/open)

## Architecture

### Contract Interface

```typescript
Contract: 0xdffe8a4a4103f968ffd61fd082d08c41dcf9b940
Chains: Arbitrum (42161), Base (8453), Degen (666666666)
```

### Components

1. **`usePoidhBounties` Hook** (`hooks/usePoidhBounties.ts`)
   - Fetches bounties from all chains via viem
   - Filters by skate keywords
   - Categorizes by status

2. **`PoidhBountyCard`** (`components/bounties/PoidhBountyCard.tsx`)
   - Displays individual bounty
   - Shows chain, status, amount, claims
   - Links to block explorer

3. **`PoidhBountyList`** (`components/bounties/PoidhBountyList.tsx`)
   - Lists filtered bounties
   - Status and chain filters
   - Grid layout

4. **`BountiesClient`** (updated)
   - Tabs for Hive/POIDH/All
   - Unified bounty discovery

### Skate Keyword Filtering

Bounties are filtered by presence of these keywords in name/description:

```typescript
skate, skateboard, trick, kickflip, ollie, grind, rail, 
ledge, park, street, vert, bowl, ramp, deck, board, skatehive
```

## Usage

### Basic

```tsx
import PoidhBountyList from "@/components/bounties/PoidhBountyList";

<PoidhBountyList initialFilter={["active"]} />
```

### With Hook

```typescript
import { usePoidhBounties } from "@/hooks/usePoidhBounties";

const { bounties, isLoading, error, refetch } = usePoidhBounties({
  status: ["active"],
  chains: [42161, 8453], // Arbitrum + Base only
  searchTerm: "kickflip",
});
```

## API Reference

### Contract Functions Used

- `bountyCounter()` — Total bounty count
- `getBounty(id)` — Bounty details
- `bountyClaims(bountyId)` — Claim IDs for bounty

### Data Types

```typescript
interface PoidhBounty {
  id: number;
  issuer: string;
  name: string;
  description: string;
  amount: bigint;
  createdAt: number;
  isOpen: boolean;
  isCancelled: boolean;
  hasActiveClaim: boolean;
  chainId: number;
  claimIds?: number[];
}

type BountyStatus = "active" | "completed" | "cancelled";
```

## Performance

- Fetches last 100 bounties per chain (300 total max)
- Parallel RPC calls across chains
- Client-side filtering for instant results
- No backend required

## Future Enhancements

- [ ] Claim submission UI
- [ ] Voting interface (for open bounties)
- [ ] Real-time updates via websockets
- [ ] Indexer API for better performance
- [ ] Claim NFT display
- [ ] Gnars bounties integration

## Resources

- [POIDH Docs](https://docs.poidh.xyz)
- [Contract Source](https://github.com/picsoritdidnthappen/poidh-contracts)
- [Trello Card](https://trello.com/c/your-card-id)
