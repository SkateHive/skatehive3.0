# POIDH Native Integration Checklist

## Current State: Full Native Integration

All core POIDH features are now integrated natively — create, contribute, claim, vote, accept, cancel, and withdraw all happen directly from Skatehive without redirecting to poidh.xyz.

---

## Phase 1: Contract Infrastructure

- [x] **Expand `lib/poidh-abi.ts`** — Added all write functions: `createSoloBounty`, `createOpenBounty`, `joinOpenBounty`, `createClaim`, `acceptClaim`, `submitClaimForVote`, `voteClaim`, `resolveVote`, `cancelSoloBounty`, `cancelOpenBounty`, `withdrawFromOpenBounty`, `withdraw`, `withdrawTo` + all read functions
- [x] **Add Arbitrum to wagmi config** — Added Arbitrum One (42161) chain + transport to `app/providers.tsx`
- [ ] **Add Degen chain support** (optional) — Chain 666666666, contract `0x18e5585ca7ce31b90bc8bb7aaf84152857ce243f`, currency DEGEN
- [x] **Create `lib/poidh-contracts.ts`** — Typed contract config objects per chain (address + abi + chainId)
- [x] **Add read functions to ABI** — `bountyVotingTracker`, `participantAmounts`, `participants`, `bountyCurrentVotingClaim`, `pendingWithdrawals`, `voteRound`, `everHadExternalContributor`, `bounties`, `claims`, `getBountiesLength`, `bountyClaims`, `userBounties`, `userClaims`, `votingPeriod`, `FEE_BPS`, `MIN_BOUNTY_AMOUNT`

---

## Phase 2: Create Bounty Natively

- [x] **New component: `PoidhBountyComposer.tsx`** — Form with title, description, reward amount (ETH), chain selector (Base/Arb), bounty type (Solo/Open)
- [x] **Chain switching UX** — `useSwitchChain()` auto-prompts user to switch to correct chain before tx
- [x] **`usePoidhWrite` hook** — Unified hook wrapping `useWriteContract` for all POIDH write operations
- [x] **Min bounty validation** — 0.001 ETH minimum enforced client-side
- [x] **TX confirmation flow** — Shows switching-chain → pending-approval → pending-tx → confirmed states
- [x] **Replace external redirect** — ETH pill in BountiesHubClient now opens native `PoidhBountyComposer` modal
- [x] **Auto-tag skatehive bounties** — Description auto-prepended with `[skatehive]` tag

---

## Phase 3: Contribute to Open Bounty

- [x] **`joinOpenBounty` in `usePoidhWrite`** — Wraps `useWriteContract` for `joinOpenBounty(bountyId)` with `msg.value`
- [x] **Contribution UI in `PoidhBountyDetail.tsx`** — "CONTRIBUTE ETH" button with amount input, visible only on open bounties
- [x] **Display contributors list** — Contributors panel shows addresses with amounts and % of pool
- [x] **Contributors panel** — Shows each contributor's shortened address, ETH staked, and percentage
- [x] **Total pool display** — Reward box shows total ETH amount
- [x] **Withdraw contribution** — "WITHDRAW MY CONTRIBUTION" button for non-issuer contributors (before voting)

---

## Phase 4: Submit Claim / Proof

- [x] **`createClaim` in `usePoidhWrite`** — Wraps `useWriteContract` for `createClaim(bountyId, name, description, uri)`
- [ ] **IPFS upload for proof** — Upload image/video proof to IPFS (Pinata/web3.storage), get URI for claim
- [x] **Claim composer UI** — Inline form in `PoidhBountyDetail.tsx`: title, description, proof URL input
- [x] **Replace "Submit on POIDH" button** — Native "SUBMIT PROOF" button with inline form
- [ ] **Show user's existing claims** — Highlight if connected wallet already submitted a claim on this bounty

---

## Phase 5: Accept Claim & Voting

- [x] **Solo bounty: Accept Claim** — Issuer sees "ACCEPT" button on each claim
- [x] **Open bounty: Submit for Vote** — Issuer sees "NOMINATE" button on each claim
- [x] **Voting UI** — Contributors see YES/NO buttons with vote weight display
- [x] **Vote weight display** — Shows yes/no ETH tally with visual progress bar
- [x] **Voting countdown** — Displays voting deadline timestamp and active/expired state
- [x] **Resolve vote** — "RESOLVE VOTE" button appears after voting deadline
- [x] **Vote result display** — Shows voting round number and current tally
- [ ] **Reset voting period** — Hook exists (`resetVotingPeriod` in `usePoidhWrite`) but UI button not yet added

---

## Phase 6: Cancel & Withdraw

- [x] **Cancel solo bounty** — Issuer sees "CANCEL BOUNTY" button on their open solo bounty
- [x] **Cancel open bounty** — Issuer sees "CANCEL BOUNTY" on their open bounty (auto-detects type)
- [x] **Refund from cancelled** — `claimRefund` in `usePoidhWrite` hook ready; UI needed for cancelled state
- [ ] **Withdraw pending balance** — Global "Withdraw" in user profile/settings for `pendingWithdrawals(address)`

---

## Phase 7: Enhanced Detail Page

- [x] **Real-time bounty state** — `usePoidhRead` hooks read voting state, participants, and amounts directly from contract
- [x] **Bounty type badge** — Shows "SOLO BOUNTY" or "OPEN BOUNTY" tag on detail page
- [ ] **NFT preview** — When claim is accepted, show the minted NFT with link to OpenSea/Base explorer
- [ ] **Transaction history** — Show create/join/claim/vote/accept events timeline
- [ ] **Chain explorer links** — Link bounty address + tx hashes to Basescan/Arbiscan

---

## Phase 8: UX Polish

- [x] **Unified wallet prompt** — All write actions trigger RainbowKit connect modal if wallet not connected
- [x] **Chain mismatch handling** — Auto-prompt chain switch via `useSwitchChain` when user is on wrong network
- [ ] **Gas estimation** — Show estimated gas cost before confirming transactions
- [x] **Error handling** — Shows contract revert reasons via `err.shortMessage` fallback
- [ ] **Optimistic updates** — Update UI immediately on tx submit, revert on failure (currently reloads page)
- [ ] **Mobile wallet support** — Test WalletConnect deep links on mobile
- [x] **Loading/pending states** — Status feedback for all tx states (switching, approval, pending, confirmed, error)

---

## Infrastructure Done

- [x] Wagmi v2 + viem + RainbowKit configured in providers (Base + Mainnet + Arbitrum)
- [x] Full POIDH v2 ABI with all read + write functions (`lib/poidh-abi.ts`)
- [x] Contract config per chain (`lib/poidh-contracts.ts`)
- [x] `usePoidhWrite` hook — unified write operations for all POIDH contract functions
- [x] `usePoidhRead` hooks — participants, voting state, participant amounts, pending withdrawals, open bounty detection
- [x] `usePoidhBounties` hook for listing
- [x] API routes for fetching bounties + claims via POIDH tRPC
- [x] `PoidhBountyDetail.tsx` — full native interaction (contribute, claim, vote, accept, cancel)
- [x] `PoidhBountyComposer.tsx` — native bounty creation (solo + open, Base + Arb)
- [x] `UnifiedBountyCard` + `UnifiedBountyList` (merged Hive + POIDH feed)
- [x] Chain constants (`ALLOWED_CHAINS`, labels, colors)
- [x] Type definitions (`PoidhBounty`, `PoidhClaim`, `UnifiedBounty`)
- [x] Bounty normalizers (Hive + POIDH → unified format)
- [x] Market prices hook (ETH/HIVE/HBD from CoinGecko)

---

## Remaining Items (Nice-to-Have)

- [ ] Degen chain support (chain 666666666)
- [ ] IPFS upload for claim proofs (currently manual URL input)
- [ ] Highlight user's own claims on a bounty
- [ ] Reset voting period UI button
- [ ] Withdraw pending balance UI in settings
- [ ] NFT preview for accepted claims
- [ ] Transaction history timeline
- [ ] Chain explorer links (Basescan/Arbiscan)
- [ ] Gas estimation display
- [ ] Optimistic UI updates (currently page reloads)
- [ ] Mobile WalletConnect testing

---

## Key Contract References

| Chain | Contract | Address |
|-------|----------|---------|
| Base (8453) | Bounty v2 | `0x5555fa783936c260f77385b4e153b9725fef1719` |
| Arbitrum (42161) | Bounty v2 | `0x5555fa783936c260f77385b4e153b9725fef1719` |
| Degen (666666666) | Bounty v2 | `0x18e5585ca7ce31b90bc8bb7aaf84152857ce243f` |
| Base/Arb | NFT | `0x27E117Cc9A8DA363442e7Bd0618939E3EEEACF6A` |
| Degen | NFT | `0x39f04b7897dcaf9dc454e433f43fb1c3bb528e11` |

**Protocol fee:** 2.5% on payouts
**Min bounty:** 0.001 ETH / 1 DEGEN
**Voting period:** 2 days
**Docs:** https://docs.poidh.xyz/

---

## New Files Created

| File | Purpose |
|------|---------|
| `lib/poidh-contracts.ts` | Chain-specific contract configs |
| `hooks/usePoidhWrite.ts` | All POIDH write operations (create, contribute, claim, vote, cancel, withdraw) |
| `hooks/usePoidhRead.ts` | On-chain read hooks (participants, voting, balances) |
| `components/bounties/PoidhBountyComposer.tsx` | Native ETH bounty creation form |

## Modified Files

| File | Changes |
|------|---------|
| `lib/poidh-abi.ts` | Full v2 ABI (18 read + 16 write functions) |
| `app/providers.tsx` | Added Arbitrum chain + transport |
| `components/bounties/PoidhBountyDetail.tsx` | Full native interaction (contribute, claim, vote, accept, cancel) |
| `components/bounties/BountiesHubClient.tsx` | Native ETH bounty creation (no more external redirect) |
| `components/bounties/index.ts` | Added PoidhBountyDetail + PoidhBountyComposer exports |
