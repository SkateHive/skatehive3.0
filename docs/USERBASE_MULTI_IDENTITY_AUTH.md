# Userbase Multi-Identity Authentication System

**Branch:** `userbase`
**Last Updated:** January 29, 2026
**Status:** ✅ Production Ready

---

## Overview

Skatehive's authentication system supports **multiple identity types** that can be linked to a single app account. Users can sign up with any method and link additional identities later, creating a unified cross-platform profile.

### Supported Identity Types

| Identity Type | Provider | Primary Use |
|--------------|----------|-------------|
| **Email (App Account)** | Magic Link | Core account, no blockchain needed |
| **Hive** | Keychain/Aioha | Blockchain posting, Hive profile data |
| **EVM Wallet** | WalletConnect/MetaMask | Token gating, Zora profile |
| **Farcaster** | Neynar API | Social graph, Farcaster profile |

---

## Authentication Flows

### Flow 1: Email-First Signup

**User Journey:**
```
1. Click "Sign Up" → Enter email + chosen name
2. Receive magic link email
3. Click link → Auto-login
4. Optional: Link Hive/EVM/Farcaster later
```

**What Happens:**
- Creates `userbase_users` record with:
  - `handle`: slugified version of chosen name (e.g., "Sktbrd Eth" → "sktbrd-eth")
  - `display_name`: exactly as entered (e.g., "Sktbrd Eth")
  - `avatar_url`: Dicebear pixel art or provided avatar
- Creates `userbase_auth_methods` record with email
- Generates 30-day session cookie (`userbase_refresh`)

**API Endpoints:**
- `POST /api/userbase/auth/sign-up` - Send magic link
- `GET /api/userbase/auth/magic-link?token=...` - Verify and login

### Flow 2: Hive-First Login

**User Journey:**
```
1. Click "Connect with Hive Keychain"
2. Approve in Keychain popup
3. Auto-creates app account from Hive profile
4. Optional: Add email or link wallet later
```

**What Happens:**
- Checks if Hive identity already exists in `userbase_identities`
- If not, creates new `userbase_users` with:
  - `handle`: Hive username (if available) or `username-{suffix}`
  - `display_name`: Hive username
  - `avatar_url`: `https://images.hive.blog/u/{username}/avatar`
- Creates `userbase_identities` record with Hive handle
- Generates session via bootstrap flow

**API Endpoints:**
- `POST /api/userbase/auth/bootstrap` - Auto-create account from Hive

### Flow 3: EVM Wallet-First Login

**User Journey:**
```
1. Click "Connect with Ethereum"
2. Approve wallet connection
3. Sign authentication message
4. Auto-creates app account
5. Optional: Link Hive or add email later
```

**What Happens:**
- Creates `userbase_users` with:
  - `handle`: `wallet-{first6chars}` (e.g., "wallet-8bf594")
  - `display_name`: ENS name or "Wallet 0x{first6chars}"
  - `avatar_url`: ENS avatar or generated
- Creates `userbase_identities` record with address
- Generates session

**API Endpoints:**
- `POST /api/userbase/auth/bootstrap` with `type: "evm"`

### Flow 4: Farcaster-First Login

**User Journey:**
```
1. Connect via Farcaster (WalletConnect + Neynar)
2. Auto-creates app account
3. Optional: Link Hive/wallet or add email
```

**What Happens:**
- Fetches profile data from Neynar API (5s timeout)
- Creates `userbase_users` with:
  - `handle`: Farcaster username or `fc-{fid}`
  - `display_name`: Farcaster display name
  - `avatar_url`: Farcaster PFP
- Creates `userbase_identities` record with FID
- Links verified EVM addresses from Farcaster profile

**API Endpoints:**
- `POST /api/userbase/auth/bootstrap` with `type: "farcaster"`

---

## Identity Linking System

### Linking Additional Identities

Once logged in with any method, users can link additional identities from Settings or the Account Linking Modal.

#### Hive Linking

**Flow:**
```
1. User clicks "LINK →" button for Hive
2. Creates challenge (15min TTL): POST /api/userbase/identities/hive/challenge
3. Signs message with Hive Keychain (Posting key)
4. Verifies signature (30s timeout): POST /api/userbase/identities/hive/verify
5. Success → Links identity, shows toast, routes to /user/{hive_username}
```

**What Gets Linked:**
- Hive account metadata (followers, following, HP)
- EVM addresses from Hive profile (`json_metadata.profile.eth_address`, `primary_wallet`, etc.)
- Farcaster data if present in Hive profile

**Edge Cases:**
- If Hive account already linked to another app account → Shows merge prompt
- If Hive account doesn't exist → Returns 404
- If challenge expires → Returns 401 "Challenge expired"

**Source Priority for EVM Addresses:**
1. `eth_address` (priority: 1)
2. `primary_wallet` (priority: 2)
3. `wallets.additional` (priority: 3)
4. Farcaster verified addresses (priority: 3)

#### EVM Wallet Linking

**Flow:**
```
1. User clicks "LINK →" button for EVM
2. Creates challenge: POST /api/userbase/identities/evm/challenge
3. Signs message with wallet (MetaMask/WalletConnect)
4. Verifies signature: POST /api/userbase/identities/evm/verify
5. Success → Links wallet, routes to /user/{handle}?mode=zora
```

**What Gets Linked:**
- Wallet address (checksummed, stored lowercase)
- ENS name if available
- ENS avatar if available

#### Farcaster Linking

**Flow:**
```
1. User connects Farcaster via WalletConnect
2. Backend fetches profile from Neynar (5s timeout)
3. Verifies custody address signature
4. Links FID and verified addresses
5. Success → Routes to /user/{handle}?mode=farcaster
```

**What Gets Linked:**
- Farcaster FID (external_id)
- Farcaster username
- Display name and PFP
- All verified EVM addresses from Farcaster profile

### Account Merging

When linking an identity that's already connected to another account:

**Conflict Resolution:**
```
1. API returns 409 status with merge_required flag
2. Shows confirmation prompt:
   "@username is already linked to another account. Merge accounts?"
3. If approved:
   - POST /api/userbase/merge with target_user_id
   - Moves all identities to current account
   - Deletes old account
   - Refreshes session
```

**What Gets Merged:**
- All `userbase_identities` records
- All `userbase_soft_posts` (for email-only users)
- All `userbase_soft_votes`
- Session remains on current account

---

## Profile Modes

The app supports different profile views based on active identity:

| Mode | Route | Data Source | Features |
|------|-------|-------------|----------|
| **Hive** | `/user/{hive_username}` | Hive blockchain | Posts, followers, HP, snaps |
| **Zora** | `/user/{handle}?mode=zora` | Zora API + wallet | NFTs, tokens, collections |
| **Farcaster** | `/user/{handle}?mode=farcaster` | Neynar API | Casts, social graph |
| **App Account** | `/user/{handle}` | Userbase DB | Display name, bio, soft posts |

### Profile Routing After Link

When a user successfully links an identity, they're automatically routed to the appropriate profile mode:

```typescript
function routeAfterLink(identityType: string, identifier: string) {
  if (identityType === "hive") {
    router.push(`/user/${identifier}`); // Hive profile
  } else if (identityType === "evm") {
    router.push(`/user/${userbaseUser.handle}?mode=zora`); // Zora profile
  } else if (identityType === "farcaster") {
    router.push(`/user/${userbaseUser.handle}?mode=farcaster`); // Farcaster profile
  }
}
```

### Display Name Priority

The system determines which name to show using this priority:

```
1. Hive username (if logged in with Hive)
2. Userbase display_name (if set)
3. Userbase handle (fallback)
```

Example:
- User signs up with email as "Sktbrd Eth"
- `display_name`: "Sktbrd Eth", `handle`: "sktbrd-eth"
- Shows "Sktbrd Eth" everywhere
- If they link @skatehive Hive account → Shows "skatehive" when in Hive mode

---

## API Reference

### Challenge Generation

**POST `/api/userbase/identities/{type}/challenge`**

Creates a time-limited challenge for identity verification.

Request:
```json
// Hive
{ "handle": "skatehive" }

// EVM
{ "address": "0x8Bf5941d27176242745B716251943Ae4892a3C26" }
```

Response:
```json
{
  "message": "Skatehive wants to link...\n\nUser ID: {uuid}\n...",
  "expires_at": "2026-01-29T18:00:00.000Z"
}
```

**Configuration:**
- TTL: 15 minutes
- Nonce: 32-char hex
- Stored in: `userbase_identity_challenges`

### Identity Verification

**POST `/api/userbase/identities/{type}/verify`**

Verifies signature and creates/links identity.

Request:
```json
// Hive
{
  "handle": "skatehive",
  "signature": "...",
  "public_key": "STM..."
}

// EVM
{
  "address": "0x...",
  "signature": "0x..."
}
```

Response (Success):
```json
{
  "success": true,
  "identity_id": "uuid",
  "merged": false
}
```

Response (Merge Required):
```json
{
  "error": "Identity already linked",
  "merge_required": true,
  "target_user_id": "uuid",
  "target_user": {
    "handle": "existing-user",
    "display_name": "Existing User"
  }
}
```

**Timeouts:**
- Verification API: 30 seconds
- Neynar fetch: 5 seconds
- Metadata fetch: 3 seconds (non-blocking)

### Account Merge

**POST `/api/userbase/merge`**

Merges two userbase accounts.

Request:
```json
{
  "target_user_id": "uuid-of-account-to-merge-from"
}
```

Response:
```json
{
  "success": true,
  "kept_user_id": "uuid-of-current-account",
  "deleted_user_id": "uuid-of-merged-account"
}
```

**What Happens:**
1. Validates both users exist
2. Moves all identities to current account
3. Updates all soft posts/votes
4. Deletes target account
5. All atomic in transaction

---

## Database Schema

### Core Tables

**userbase_users**
```sql
- id: uuid (PK)
- handle: text (unique, nullable) -- URL-safe username
- display_name: text (nullable)   -- Display name (can have spaces, capitals)
- avatar_url: text (nullable)
- cover_image_url: text (nullable)
- bio: text (nullable)
- location: text (nullable)
- status: text (active | suspended)
- onboarding_step: integer
- created_at: timestamptz
- updated_at: timestamptz
```

**userbase_identities**
```sql
- id: uuid (PK)
- user_id: uuid (FK → userbase_users)
- type: text (hive | evm | farcaster)
- handle: text (nullable)          -- Hive username or Farcaster username
- address: text (nullable)         -- EVM address (lowercase)
- external_id: text (nullable)     -- Farcaster FID
- is_primary: boolean
- metadata: jsonb                  -- Profile data, source info
- verified_at: timestamptz
- created_at: timestamptz
- source: text (nullable)          -- FROM_HIVE, ETH_ADDRESS, etc.
- source_priority: integer (nullable) -- 1 (highest) to 3+ (lowest)
```

**userbase_identity_challenges**
```sql
- id: uuid (PK)
- user_id: uuid (FK → userbase_users)
- type: text (hive | evm | farcaster)
- identifier: text                 -- Handle or address being linked
- nonce: text
- message: text                    -- Challenge message to sign
- created_at: timestamptz
- expires_at: timestamptz
- consumed_at: timestamptz (nullable)
```

### Indexes

```sql
-- Fast identity lookup
CREATE INDEX idx_identities_user_type
  ON userbase_identities(user_id, type);

CREATE INDEX idx_identities_hive_handle
  ON userbase_identities(handle)
  WHERE type = 'hive';

CREATE INDEX idx_identities_evm_address
  ON userbase_identities(address)
  WHERE type = 'evm';

-- Challenge cleanup
CREATE INDEX idx_challenges_expires
  ON userbase_identity_challenges(expires_at);
```

---

## Error Handling

### Common Errors

| Error | Status | Cause | Resolution |
|-------|--------|-------|------------|
| `Challenge expired` | 401 | Challenge TTL exceeded (15min) | Disconnect and reconnect Keychain, retry link |
| `Identity already linked` | 409 | Identity connected to another account | Show merge prompt or cancel |
| `Hive account not found` | 404 | Username doesn't exist on Hive | Check spelling, try different account |
| `Invalid signature` | 401 | Signature verification failed | Retry signing with correct key |
| `Session expired` | 401 | Refresh token expired (30 days) | Re-login required |

### Timeout Configuration

```typescript
// API Timeouts (in AccountLinkingModal.tsx)
const NEYNAR_TIMEOUT = 5000;        // 5s - Farcaster profile fetch
const VERIFY_TIMEOUT = 30000;       // 30s - Signature verification
const METADATA_TIMEOUT = 3000;      // 3s - Profile metadata (non-blocking)

// Challenge TTL (in challenge routes)
const CHALLENGE_TTL = 15 * 60 * 1000; // 15 minutes

// Session TTL (in bootstrap/magic-link routes)
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
```

---

## Security Considerations

### Safe User Identification

For soft posts (email-only users posting to Hive), we use HMAC-SHA256 hashing:

```typescript
function generateSafeUser(userId: string): string {
  const secret = process.env.SAFE_USER_SECRET;
  return crypto.createHmac('sha256', secret)
    .update(userId)
    .digest('hex');
}
```

This allows posts to be attributed without exposing internal user IDs on-chain.

### Challenge Security

- Challenges include user_id, identifier, nonce, and timestamp
- 15-minute expiration prevents replay attacks
- Consumed challenges can't be reused
- All verification is server-side

### Session Security

- HTTP-only cookies prevent XSS
- Secure flag in production (HTTPS only)
- SameSite=Lax prevents CSRF
- Refresh token hashed with SHA-256 before storage

---

## Testing

See `TESTING_USERBASE_AUTH.md` for comprehensive testing guide covering:
- Email signup/login
- Hive Keychain login
- EVM wallet connection
- Identity linking scenarios
- Account merging
- Profile switching

---

## Known Issues & Limitations

### Current Limitations

1. **Email-only users can't post directly to Hive** - They post via `skateuser` account (soft posts)
2. **No password-based auth** - Email auth is magic link only
3. **Handle changes require admin** - Handle is set once during signup
4. **No multi-device key sync** - Each session is independent

### Planned Features

- [ ] Email-to-email account recovery
- [ ] Social login (Google, Twitter)
- [ ] Account deletion/data export
- [ ] Handle change via settings
- [ ] Multi-factor authentication

---

## Troubleshooting

### "Button loading forever" during link

**Cause:** API timeout or network issue
**Fix:**
- Check console for timeout errors
- Verify Neynar API key is valid
- Ensure DATABASE_URL is accessible
- Check that timeouts are properly configured (5s Neynar, 30s verify)

### Display name shows handle instead

**Cause:** Display name not set or priority logic incorrect
**Fix:**
- Check `userbase_users.display_name` is not NULL
- Verify priority logic: `hiveUsername || displayName || handle`
- Ensure ConnectionModal.tsx uses correct priority

### Profile shows wrong data after linking

**Cause:** State not refreshed or routing incorrect
**Fix:**
- Call `refresh()` and `refreshUserbase()` after linking
- Verify `bumpIdentitiesVersion()` is called to invalidate queries
- Check routing logic goes to correct profile mode

---

## Architecture Decisions

### Why Multiple Identity Types?

**Problem:** Traditional blockchain apps require users to have keys/accounts before using the app.

**Solution:** Allow users to start with familiar methods (email, wallet) and link blockchain identities later.

**Benefits:**
- Lower onboarding friction
- Progressive complexity
- Unified cross-platform profiles
- Flexible authentication options

### Why Soft Posts?

Email-only users need to interact with Hive content without managing keys. Soft posts use a shared Hive account (`skateuser`) but display the user's actual profile via an overlay system. See `USERBASE_SOFT_POSTS.md` for details.

### Why HMAC for Safe User?

We can't put user IDs directly on-chain (privacy concern). HMAC allows secure identification without exposing internal database IDs. The secret key is server-side only.

---

## Related Documentation

- `TESTING_USERBASE_AUTH.md` - Testing guide and scenarios
- `USERBASE_SOFT_POSTS.md` - Soft posts system architecture
- `HANDOFF_SOFT_POSTS_JAN2026.md` - Development handoff notes

---

## Migration Guide

If migrating from old auth system:

1. Run all migrations in `lib/database/migrations/`
2. Update environment variables:
   ```env
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   SAFE_USER_SECRET=...
   NEYNAR_API_KEY=...
   ```
3. Test each flow with test accounts
4. Monitor error logs for edge cases

---

**Questions or Issues?**
Report to: [GitHub Issues](https://github.com/skatehive/skatehive3.0/issues) or Discord

🛹 Happy skating!
