# Userbase Implementation - Developer Handoff

**Last Updated:** 2026-01-31
**Status:** Production Ready
**Database Migrations:** 0001-0018 applied

---

## What is Userbase?

Userbase is Skatehive's authentication system that allows users to interact with the platform through multiple pathways:

1. **Email Lite Accounts** - Sign up with email only, post immediately using shared platform account
2. **Wallet Accounts** - Connect MetaMask/WalletConnect (Ethereum/Base)
3. **Farcaster Accounts** - Sign in with Farcaster
4. **Sponsored Hive Accounts** - OG users sponsor creation of real Hive accounts for lite users
5. **Manual Hive Keys** - Users can add their own Hive posting keys

All account types can post, vote, and comment on Hive blockchain.

---

## Core Architecture

### Database Tables (10 total)

```
userbase_users               - Core user records
userbase_sessions            - Login sessions with refresh tokens
userbase_auth_methods        - Email/password/OAuth credentials
userbase_identities          - Linked identities (Hive, Farcaster, EVM)
userbase_identity_challenges - Challenge-response nonces (15min TTL)
userbase_magic_links         - Magic link tokens for email auth
userbase_hive_keys           - Encrypted Hive posting keys (sponsored + manual)
userbase_soft_posts          - Attribution tracking for posts made via shared account
userbase_soft_votes          - Attribution tracking for votes made via shared account
userbase_sponsorships        - Hive account sponsorship requests/records
```

**Key Points:**
- UUIDs for all primary keys
- Timestamps: `created_at`, `updated_at`
- Status fields use enums for data integrity
- All operations happen immediately (no cron jobs needed)

---

## How Posting Works

### Three Posting Methods

**1. Lite Accounts (Shared Key)**

- User has NO personal Hive key
- Uses `DEFAULT_HIVE_POSTING_KEY` from environment variable
- Posts immediately to Hive via @skateuser account
- `userbase_soft_posts` records attribution (NOT a queue)
- Post appears instantly on Hive blockchain

**Code:** `app/api/userbase/hive/comment/route.ts:288-312`

**2. Sponsored Accounts (Platform-Created)**

- OG user clicks "Sponsor" button on lite user's content/profile
- Creates sponsorship record with status='pending'
- **Frontend** uses Keychain to create Hive account (user signs transaction)
- **Frontend** calls `/api/userbase/sponsorships/process` with transaction ID and keys
- Posting key encrypted and stored in `userbase_hive_keys`
- User now posts directly under their own Hive username
- **No cron jobs** - everything triggered by user actions

**Code:**
- Create: `app/api/userbase/sponsorships/create/route.ts`
- Process: `app/api/userbase/sponsorships/process/route.ts`

**3. Manual Keys (User-Provided)**

- User goes to `/settings/hive` and enters their posting key
- Key validated against on-chain public keys
- Encrypted and stored in `userbase_hive_keys`
- User posts directly with their own key

**Code:** `app/api/userbase/keys/posting/route.ts`

---

## Critical Flows

### Flow 1: Lite Account Posts Comment

```typescript
1. User creates comment (no Hive key stored)
2. POST /api/userbase/hive/comment
3. getPostingKey(userId) → returns null
4. Falls back to DEFAULT_HIVE_POSTING_KEY
5. Record created in userbase_soft_posts (status='queued', then 'broadcasted')
6. Broadcast to Hive IMMEDIATELY via @skateuser account
7. Update soft_post status='broadcasted'
```

**Important:** The soft_post record is for **attribution/tracking**, not a queue. Broadcast happens immediately in the same API call.

**Code:** `app/api/userbase/hive/comment/route.ts:280-350`

### Flow 2: OG User Sponsors Lite User

```typescript
1. OG user clicks "Sponsor" button on lite user's profile/post
2. POST /api/userbase/sponsorships/create
   - Validates: sponsor has Hive identity, username available
   - Creates sponsorship record (status='pending')
3. **Frontend** opens Keychain with account creation operation
4. User signs transaction in Keychain
5. Keychain creates account on Hive blockchain
6. **Frontend** calls POST /api/userbase/sponsorships/process with:
   - transaction_id
   - generated keys (owner, active, posting, memo)
7. Backend:
   - Verifies transaction on blockchain
   - Encrypts posting key → userbase_hive_keys
   - Creates Hive identity link
   - Emails all keys to user
   - Updates sponsorship status='completed'
8. User now has real Hive account and can post directly
```

**Frontend:** `components/userbase/SponsorshipModal.tsx`
**Backend:** `app/api/userbase/sponsorships/process/route.ts`

### Flow 3: Add Manual Posting Key

```typescript
1. User navigates to /settings/hive
2. Enters Hive username + posting key
3. POST /api/userbase/keys/posting
4. Validate key:
   - Convert to public key
   - Fetch account from Hive blockchain
   - Verify public key in account.posting.key_auths
5. Encrypt key (AES-256-GCM)
6. Store in userbase_hive_keys
7. User can now post/vote directly
```

**Code:** `app/api/userbase/keys/posting/route.ts:145-302`

---

## Soft Posts & Soft Votes (NOT Queues!)

**Common Misconception:** These tables are queues that need cron jobs.

**Reality:** These are **attribution/audit tables** that track which content came from lite accounts using the shared platform key.

### userbase_soft_posts

```sql
CREATE TABLE userbase_soft_posts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES userbase_users(id),
  author TEXT,              -- Always @skateuser for lite accounts
  permlink TEXT,            -- The post's permlink on Hive
  type TEXT,                -- 'snap' | 'magazine' | 'comment'
  status TEXT,              -- 'queued' | 'broadcasted' | 'failed'
  safe_user TEXT,           -- Anonymized user identifier
  metadata JSONB,           -- Post metadata
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  broadcasted_at TIMESTAMPTZ
);
```

**Purpose:**
- Track which posts came from userbase lite accounts
- Show attribution in UI ("Posted via @username")
- Audit trail for content moderation
- **NOT** a queue for delayed broadcasting

**Status flow:**
1. Record created with `status='queued'` when broadcast starts
2. Broadcast happens **immediately** in same API call
3. Status updated to `'broadcasted'` after success (or `'failed'` on error)

### userbase_soft_votes

Same pattern as soft_posts - tracks votes made with shared platform key.

---

## Database Schema Details

### userbase_hive_keys

Stores encrypted Hive posting keys for sponsored and manual accounts.

```sql
CREATE TABLE userbase_hive_keys (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES userbase_users(id),
  hive_username TEXT NOT NULL,
  encrypted_posting_key TEXT NOT NULL,  -- AES-256-GCM encrypted
  encryption_iv TEXT NOT NULL,           -- Initialization vector
  encryption_auth_tag TEXT NOT NULL,     -- Authentication tag
  key_type TEXT NOT NULL,                -- 'sponsored' | 'user_provided'
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);
```

**Encryption:**
- Algorithm: AES-256-GCM
- Key source: `ENCRYPTION_KEY` environment variable (64 hex chars)
- Format: `{encryptedKey: string, iv: string, authTag: string}`

**Code:** `lib/userbase/encryption.ts`

### userbase_sponsorships

```sql
CREATE TABLE userbase_sponsorships (
  id UUID PRIMARY KEY,
  lite_user_id UUID REFERENCES userbase_users(id),
  sponsor_user_id UUID REFERENCES userbase_users(id),
  hive_username TEXT NOT NULL,
  cost_type TEXT,                    -- 'hive_transfer' | 'account_token'
  cost_amount NUMERIC,
  hive_tx_id TEXT,                   -- Transaction ID from Keychain
  status TEXT NOT NULL,              -- 'pending' | 'processing' | 'completed' | 'failed'
  created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
```

**Status flow:**
1. `pending` - Sponsorship created, waiting for Keychain transaction
2. `processing` - Frontend called /process with transaction ID
3. `completed` - Account created, keys stored, email sent
4. `failed` - Error during processing

---

## Environment Variables

Required in `.env.local`:

```bash
# Supabase (Database)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Shared Lite Account Key
DEFAULT_HIVE_POSTING_ACCOUNT=skateuser
DEFAULT_HIVE_POSTING_KEY=5xxx...

# Userbase Encryption
ENCRYPTION_KEY=64_hex_characters_for_aes256

# Hive Active Key (for account creation via Keychain fallback)
HIVE_ACTIVE_KEY=5xxx...

# Email (for key backups)
RESEND_API_KEY=re_xxx...
RESEND_FROM_EMAIL=noreply@skatehive.app

# Session Security
JWT_SECRET=random_string_at_least_32_chars
```

**Critical:**
- `ENCRYPTION_KEY` must never change or all encrypted keys become unrecoverable
- `DEFAULT_HIVE_POSTING_KEY` must have enough RC for all lite account operations
- On Vercel free tier, no cron jobs needed (everything happens in API routes)

---

## Posting Method Detection

```typescript
// lib/userbase/getPostingMethod.ts (conceptual)

async function determinePostingMethod(userId: string) {
  // Check for stored posting key
  const key = await getPostingKey(userId);

  if (key) {
    return "direct_hive";  // User has sponsored or manual key
  } else {
    return "soft_post";    // Use shared platform key
  }
}
```

**In practice:**
- `vote/route.ts` and `comment/route.ts` check for user key first
- If no key found, use `DEFAULT_HIVE_POSTING_KEY`
- All broadcasts happen immediately (no queuing)

---

## Sponsorship Flow Details

### Frontend (Keychain Integration)

```typescript
// components/userbase/SponsorshipModal.tsx (simplified)

// 1. Create sponsorship record
const { sponsorship_id } = await createSponsorship({
  lite_user_id,
  hive_username,
  cost_type: 'hive_transfer'
});

// 2. Generate Hive keys
const keys = generateHiveKeys();

// 3. Open Keychain for account creation
window.hive_keychain.requestCreateClaimedAccount(
  sponsorUsername,
  hiveUsername,
  keys,
  async (response) => {
    if (response.success) {
      // 4. Process sponsorship with transaction ID
      await processSponsorship({
        sponsorship_id,
        transaction_id: response.result.id,
        keys
      });
    }
  }
);
```

### Backend Processing

```typescript
// app/api/userbase/sponsorships/process/route.ts

POST /api/userbase/sponsorships/process
1. Verify transaction on Hive blockchain
2. Encrypt posting key (AES-256-GCM)
3. Store in userbase_hive_keys
4. Create Hive identity link
5. Email all keys (owner, active, posting, memo) to user
6. Update sponsorship status='completed'
```

**Important:** Account creation happens via Keychain (frontend), not via backend cron job.

---

## Profile Sponsorship Display

**User Story:** "Show which accounts a user has sponsored and who sponsored their account"

### Implementation Locations

**Backend:**
- `/api/userbase/sponsorships/info/[user_id]` - Get user's sponsorship info
- `/api/userbase/sponsorships/my-info` - Get current user's sponsorship info

**Frontend:**
- Profile should query these endpoints and display:
  - "Sponsored by @username" if user was sponsored
  - "Accounts sponsored: @user1, @user2, @user3" if user has sponsored others

**Database Query:**

```sql
-- Who sponsored this user?
SELECT sponsor_user_id, created_at
FROM userbase_sponsorships
WHERE lite_user_id = $user_id AND status = 'completed';

-- Who has this user sponsored?
SELECT lite_user_id, hive_username, created_at
FROM userbase_sponsorships
WHERE sponsor_user_id = $user_id AND status = 'completed';
```

---

## Security Considerations

### Session Management

- Sessions use **refresh tokens** in `httpOnly` cookies
- Tokens are SHA-256 hashed before storage
- Sessions expire after 30 days
- Daily cleanup: `cleanup_expired_sessions()`

### Key Encryption

- Posting keys encrypted with AES-256-GCM
- Separate IV and auth tag for each key
- Never log or expose decrypted keys
- Encryption key rotation not yet implemented

### Input Validation

- User authentication required for all userbase endpoints
- Hive key ownership verified on-chain before storing
- XSS prevention via input sanitization
- SQL injection prevented via parameterized queries

---

## Testing Checklist

```bash
# 1. Lite Account Flow
✓ Sign up with email
✓ Create comment (should use @skateuser account)
✓ Vote on content (should use @skateuser account)
✓ Check userbase_soft_posts has record
✓ Check userbase_soft_votes has record

# 2. Sponsorship Flow
✓ Lite user creates content
✓ OG user clicks "Sponsor" button
✓ Keychain opens with account creation
✓ OG user signs transaction
✓ Keys stored in userbase_hive_keys
✓ Email received with backup keys
✓ Sponsored user can now post directly

# 3. Manual Key Flow
✓ Navigate to /settings/hive
✓ Enter username + posting key
✓ Validate key matches on-chain
✓ Key encrypted and stored
✓ User can post/vote with own key
```

---

## Common Issues & Solutions

### Issue: Lite accounts can't post/vote

**Cause:** `DEFAULT_HIVE_POSTING_KEY` is invalid or account has no RC
**Fix:**
1. Verify key is correct in environment
2. Check @skateuser account has sufficient RC
3. Test key manually with Hive API

### Issue: Sponsorship fails after Keychain

**Cause:** `/process` endpoint not receiving correct data
**Fix:**
1. Check browser console for errors
2. Verify transaction ID from Keychain response
3. Check backend logs for processing errors

### Issue: Manual key rejected

**Cause:** Public key doesn't match on-chain key_auths
**Fix:**
1. User may have old/inactive key
2. Verify key on https://hiveblocks.com
3. User needs to get correct posting key from wallet

---

## Migration History

**Applied migrations:**
- `0001_userbase.sql` - Initial schema (8 tables)
- `0017_userbase_performance_optimizations.sql` - Indexes + constraints
- `0018_drop_unused_and_legacy_tables.sql` - Removed 5 legacy tables

**Dropped tables (no longer needed):**
- `userbase_user_keys` - Replaced by `userbase_hive_keys`
- `userbase_secrets` - Merged into `userbase_hive_keys`
- `userbase_key_usage_audit` - Audit removed for simplicity
- `userbase_community_memberships` - Feature not implemented
- `userbase_merge_audit` - Audit removed for simplicity

---

## Important Notes for Developers

### No Cron Jobs Needed

The system does NOT require cron jobs or background workers:
- Lite account posts broadcast immediately
- Sponsorships processed via user-triggered API calls
- Everything happens in synchronous API routes
- Works perfectly on Vercel free tier

### Soft Tables Are Not Queues

`userbase_soft_posts` and `userbase_soft_votes` track attribution, they don't queue operations:
- Content broadcasts immediately
- Status field tracks broadcast state for audit
- Frontend can query to show "Posted via @username"

### Sponsorships Are User-Driven

- OG users sponsor lite users by clicking button
- Account creation happens via Keychain (frontend)
- Backend verifies, encrypts keys, sends email
- No automated processing needed

---

## Key Files Reference

**Must Read:**
- `app/api/userbase/hive/comment/route.ts` - Comment posting with lite/direct modes
- `app/api/userbase/hive/vote/route.ts` - Voting with lite/direct modes
- `app/api/userbase/sponsorships/create/route.ts` - Sponsorship creation
- `app/api/userbase/sponsorships/process/route.ts` - Post-Keychain processing
- `lib/userbase/encryption.ts` - Key encryption/decryption

**Configuration:**
- `.env.example` - All required environment variables
- `config/app.config.ts` - Sponsorship costs and limits

**Testing:**
- `USERBASE_TEST_CHECKLIST.md` - Comprehensive test scenarios

**Deployment:**
- `DEPLOYMENT.md` - Production deployment guide

---

## Future Improvements

### Short Term
- Add sponsorship display to profiles (show who sponsored/was sponsored)
- Add rate limiting on posting endpoints
- Add metrics for RC usage on shared account

### Medium Term
- Key rotation mechanism for sponsored accounts
- Multi-sponsor option (split costs)
- Sponsorship marketplace (users can request sponsorship)

### Long Term
- Decentralized key custody options
- Support for other blockchains (Lens, Farcaster)
- Account recovery flow for lost keys

---

**Document Version:** 2.0 (Corrected)
**Code Version:** Migrations 0001-0018
**Last Verified:** 2026-01-31

**Questions?** Check inline code comments or reach out to the team.
