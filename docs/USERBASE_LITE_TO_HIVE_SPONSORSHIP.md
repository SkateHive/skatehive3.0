# Skatehive Lite Account to Hive Sponsorship System

**Branch:** `userbase`
**Last Updated:** January 30, 2026
**Status:** 🚧 In Development

---

## Executive Summary

The **Lite Account Sponsorship System** revolutionizes Web3 onboarding by removing all friction for new users. Users can sign up with familiar methods (email, Ethereum wallet, Farcaster) and start posting immediately without managing blockchain keys. When the community identifies valuable contributors, existing Hive members can sponsor their transition to full Hive accounts with one click.

### The Problem

Traditional blockchain onboarding requires:
- Understanding blockchain wallets
- Managing private keys
- Paying for account creation
- Learning complex security practices

**Result:** 95%+ drop-off rate before users even start.

### The Solution

**Phase 1: Frictionless Start (Lite Accounts)**
- Sign up with email/wallet/Farcaster in seconds
- Post immediately via shared account (`skateuser`)
- Content attributed through overlay system
- Zero blockchain knowledge required

**Phase 2: Community-Driven Upgrade (Sponsorship)**
- Existing members identify quality contributors
- One-click sponsorship creates real Hive account
- Keys automatically encrypted and stored
- User earns real Hive rewards
- Seamless transition - no re-onboarding

---

## System Architecture

### Account Lifecycle

```
┌─────────────────┐
│   NEW USER      │
│  (Email/Wallet) │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   LITE ACCOUNT (Day 0)              │
│   - Posts via skateuser             │
│   - Profile in userbase_users       │
│   - No blockchain keys              │
│   - Zero cost, zero friction        │
└────────┬────────────────────────────┘
         │
         │  ┌──────────────────────┐
         │  │  OG USER SPONSORS    │
         └─▶│  (Click "Sponsor")   │
            └──────────┬───────────┘
                       │
                       ▼
         ┌──────────────────────────────┐
         │  HIVE ACCOUNT CREATION       │
         │  1. Pay 3 HIVE or use token  │
         │  2. Generate keys            │
         │  3. Email keys to user       │
         │  4. Encrypt posting key      │
         │  5. Store in Supabase        │
         └──────────┬───────────────────┘
                    │
                    ▼
┌─────────────────────────────────────┐
│   FULL HIVE ACCOUNT (Upgraded)      │
│   - Posts with real account         │
│   - Earns Hive rewards              │
│   - Login still via email/wallet    │
│   - Keys managed securely           │
│   - Can manage keys in settings     │
└─────────────────────────────────────┘
```

---

## Core Features

### 1. Lite Account System (Already Implemented ✅)

**What Users Can Do:**
- Sign up with email, Ethereum wallet, or Farcaster
- Create posts, comments, and snaps immediately
- Have personalized profile (avatar, bio, display name)
- Interact with Hive content
- Build reputation in the community

**How It Works:**
- Posts broadcast to Hive via `skateuser` shared account
- `safe_user` hash links on-chain post to userbase profile
- Overlay system displays real user's name/avatar in feed
- Full implementation: `USERBASE_SOFT_POSTS.md`

**Database Tables:**
- `userbase_users` - Profile data
- `userbase_soft_posts` - Post registry with safe_user hash
- `userbase_identities` - Linked email/wallet/Farcaster

### 2. Sponsorship System (NEW FEATURE 🚧)

**Who Can Sponsor:**
- Any user with a linked Hive account
- Minimum reputation threshold (configurable)
- Optional: Minimum Hive Power requirement

**Sponsorship Flow:**

```
1. OG User browses feed
   └─▶ Sees quality content from lite account
       └─▶ Clicks "Sponsor @username" button

2. Sponsorship Modal Opens
   ├─▶ Shows lite user's stats (posts, votes, reputation)
   ├─▶ Displays sponsorship cost (3 HIVE or 1 token)
   └─▶ Confirms username for new Hive account

3. OG User Confirms
   └─▶ Signs Hive transaction (KeychainSDK)
       ├─▶ Option A: Transfer 3 HIVE to account creation service
       └─▶ Option B: Use account creation token (if available)

4. Backend Creates Account
   ├─▶ Calls Hive account creation API
   ├─▶ Generates owner, active, posting, memo keys
   ├─▶ Sets recovery account to sponsor or @skatehive
   ├─▶ Stores account creation record in database
   └─▶ Triggers email delivery

5. Email Sent to User
   ├─▶ Subject: "Your Hive Account is Ready! 🎉"
   ├─▶ Body: Welcome message + security instructions
   ├─▶ Attachment: JSON file with all keys (owner, active, posting, memo)
   └─▶ Instructions: "Save this file securely, import to Keychain"

6. Backend Encrypts Posting Key
   ├─▶ Uses AES-256-GCM encryption
   ├─▶ Unique encryption key per user (derived from master secret + user_id)
   ├─▶ Stores encrypted posting key in userbase_hive_keys table
   └─▶ IV and auth tag stored separately for security

7. User Account Upgraded
   ├─▶ userbase_identities row created with Hive account
   ├─▶ is_sponsored flag set to true
   ├─▶ sponsor_user_id recorded for attribution
   ├─▶ Future posts use real Hive account (via encrypted posting key)
   └─▶ User can now earn Hive rewards
```

**Database Schema:**

```sql
-- Track Hive account sponsorships
CREATE TABLE userbase_sponsorships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lite_user_id UUID NOT NULL REFERENCES userbase_users(id),
  sponsor_user_id UUID NOT NULL REFERENCES userbase_users(id),
  hive_username TEXT NOT NULL,
  cost_type TEXT NOT NULL, -- 'hive_transfer' | 'account_token'
  cost_amount NUMERIC(10,3), -- 3.000 for HIVE transfer
  hive_tx_id TEXT, -- Transaction ID on Hive blockchain
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'completed' | 'failed'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(lite_user_id) -- One sponsorship per user
);

-- Store encrypted Hive posting keys
CREATE TABLE userbase_hive_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES userbase_users(id) UNIQUE,
  hive_username TEXT NOT NULL,
  encrypted_posting_key TEXT NOT NULL, -- AES-256-GCM encrypted
  encryption_iv TEXT NOT NULL, -- Initialization vector (base64)
  encryption_auth_tag TEXT NOT NULL, -- Authentication tag (base64)
  key_type TEXT NOT NULL DEFAULT 'sponsored', -- 'sponsored' | 'user_provided'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

-- Add sponsorship fields to identities
ALTER TABLE userbase_identities
  ADD COLUMN is_sponsored BOOLEAN DEFAULT FALSE,
  ADD COLUMN sponsor_user_id UUID REFERENCES userbase_users(id);
```

### 3. Posting with Real Hive Account

**How It Works:**

```typescript
// When user creates a post/comment/snap:

1. Check if user has Hive identity with encrypted posting key
   ├─▶ Query userbase_hive_keys for user_id
   └─▶ If found: Use Hive account for posting

2. Decrypt posting key server-side
   ├─▶ Derive decryption key from MASTER_SECRET + user_id
   ├─▶ Decrypt using AES-256-GCM with stored IV and auth tag
   └─▶ Keep decrypted key in memory only (never persist)

3. Broadcast to Hive
   ├─▶ Use dhive library to sign and broadcast
   ├─▶ Author: user's real Hive username
   ├─▶ Posting key: decrypted key (in-memory only)
   └─▶ Standard Hive post/comment operation

4. Store post record
   ├─▶ No longer a "soft post" (not in userbase_soft_posts)
   ├─▶ Standard Hive post displayed in feed
   └─▶ User earns real Hive rewards (author rewards, curation rewards)
```

**Fallback Logic:**
```typescript
function determinePostingMethod(userId: string) {
  const hiveKey = await getEncryptedHiveKey(userId);

  if (hiveKey) {
    // User has sponsored/linked Hive account
    return {
      method: 'hive_account',
      username: hiveKey.hive_username,
      usesEncryptedKey: true
    };
  }

  const hiveIdentity = await getHiveIdentity(userId);

  if (hiveIdentity && !hiveIdentity.is_sponsored) {
    // User manually linked Hive via Keychain (no stored key)
    return {
      method: 'keychain_signing',
      username: hiveIdentity.handle,
      requiresKeychainPopup: true
    };
  }

  // Lite account - use soft posts
  return {
    method: 'soft_post',
    username: 'skateuser',
    createsSoftPost: true
  };
}
```

### 4. Key Management in Settings

**User Settings Page Features:**

**For Sponsored Users:**
- View Hive account status (username, creation date, sponsor)
- Download backup key file (re-sends email)
- Import to Hive Keychain (instructions + one-click)
- Revoke stored posting key (requires re-linking via Keychain)

**For All Users:**
- Link existing Hive account manually (Keychain challenge-response)
- Set posting key manually (paste + encrypt)
- Switch between posting methods:
  - Use stored encrypted key (fast, no popups)
  - Use Keychain for every post (secure, requires popup)
  - Revert to lite account (removes key, future posts via skateuser)

**Settings UI:**

```typescript
// /app/settings/hive-account/page.tsx

<Card>
  <CardHeader>
    <h2>Hive Account Settings</h2>
  </CardHeader>

  {hasEncryptedKey ? (
    <>
      <StatusBadge>Active Hive Account</StatusBadge>
      <p>Username: @{hiveUsername}</p>
      <p>Sponsored by: @{sponsorUsername}</p>
      <p>Created: {createdAt}</p>

      <Button onClick={downloadKeyBackup}>
        Download Key Backup
      </Button>

      <Button onClick={openKeychainImportGuide}>
        Import to Keychain
      </Button>

      <Accordion title="Advanced Options">
        <Button variant="outline" onClick={revokeStoredKey}>
          Revoke Stored Key (Use Keychain Instead)
        </Button>
        <p className="text-sm text-muted">
          This will remove the stored posting key. Future posts will require Keychain popup.
        </p>
      </Accordion>
    </>
  ) : (
    <>
      <StatusBadge variant="warning">Lite Account</StatusBadge>
      <p>You're posting via the shared skateuser account.</p>

      <Button onClick={openLinkHiveModal}>
        Link Existing Hive Account
      </Button>

      <Button onClick={openSetPostingKeyModal}>
        Manually Set Posting Key
      </Button>
    </>
  )}
</Card>
```

---

## Security Model

### Encryption Architecture

**Encryption Specification:**
- Algorithm: AES-256-GCM (Galois/Counter Mode)
- Key derivation: HKDF-SHA256
- Input: `MASTER_SECRET` (env var) + `user_id` (UUID)
- IV: 12 bytes random (generated per encryption)
- Auth tag: 16 bytes (validates integrity)

**Why AES-256-GCM:**
- Authenticated encryption (prevents tampering)
- Industry standard (used by TLS, Signal, WhatsApp)
- Fast performance (hardware acceleration)
- Resistant to chosen-ciphertext attacks

**Key Derivation:**
```typescript
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';

function deriveEncryptionKey(userId: string): Buffer {
  const masterSecret = process.env.MASTER_ENCRYPTION_SECRET!;
  const info = `hive-posting-key-${userId}`;

  // HKDF ensures unique key per user from single master secret
  return Buffer.from(
    hkdf(sha256, masterSecret, undefined, info, 32) // 32 bytes = 256 bits
  );
}
```

**Encryption Flow:**
```typescript
import crypto from 'crypto';

async function encryptPostingKey(postingKey: string, userId: string) {
  const key = deriveEncryptionKey(userId);
  const iv = crypto.randomBytes(12); // GCM standard: 96-bit IV

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(postingKey, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return {
    encryptedKey: encrypted,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64')
  };
}

async function decryptPostingKey(
  encryptedData: { encryptedKey: string; iv: string; authTag: string },
  userId: string
): Promise<string> {
  const key = deriveEncryptionKey(userId);
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const authTag = Buffer.from(encryptedData.authTag, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData.encryptedKey, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted; // Returns WIF-format posting key
}
```

### Security Best Practices

**Environment Variables:**
```env
# CRITICAL: Keep these secret, rotate regularly
MASTER_ENCRYPTION_SECRET=<64-char random hex string>
HIVE_ACCOUNT_CREATION_KEY=<active key for account creation service>
```

**Access Control:**
- Posting key decryption: Server-side only, never expose to client
- Decrypted keys: Never logged, never persisted, memory only
- Database access: Service role key only (not anon key)
- RLS policies: Users can only access own encrypted keys

**Threat Model:**

| Threat | Mitigation |
|--------|------------|
| Database breach | Keys encrypted at rest, useless without master secret |
| XSS attack | Keys never sent to client, HTTP-only cookies |
| MITM attack | HTTPS enforced, secure cookies, key never in transit plaintext |
| Insider threat | Master secret in env only, audit logs for key access |
| Key reuse | Unique IV per encryption, auth tag prevents tampering |

**Key Rotation:**
- Master secret rotation: Re-encrypt all keys with new secret (maintenance script)
- User posting key rotation: User can revoke and re-link via Keychain

---

## API Endpoints

### Sponsorship Routes

**POST `/api/userbase/sponsorships/create`**

Initiate sponsorship for a lite account.

Request:
```json
{
  "lite_user_id": "uuid-of-lite-user",
  "hive_username": "newusername123",
  "cost_type": "hive_transfer", // or "account_token"
  "hive_tx_id": "abc123..." // Transaction ID from sponsor's Hive transfer
}
```

Response:
```json
{
  "success": true,
  "sponsorship_id": "uuid",
  "status": "pending",
  "estimated_completion": "2-5 minutes"
}
```

**POST `/api/userbase/sponsorships/process`**

Background job to process pending sponsorships (called by cron or webhook).

Request:
```json
{
  "sponsorship_id": "uuid"
}
```

Response:
```json
{
  "success": true,
  "hive_username": "newusername123",
  "account_created": true,
  "email_sent": true,
  "key_encrypted": true
}
```

**GET `/api/userbase/sponsorships/eligible/:user_id`**

Check if user is eligible for sponsorship.

Response:
```json
{
  "eligible": true,
  "reason": null, // or "already_sponsored" | "has_hive_account"
  "user_stats": {
    "posts_count": 12,
    "votes_received": 48,
    "account_age_days": 14
  }
}
```

### Posting Routes (Updated)

**POST `/api/userbase/posts/create`**

Create post/comment/snap (auto-detects posting method).

Request:
```json
{
  "title": "My First Real Post!",
  "body": "Content here...",
  "tags": ["skateboarding", "introduceyourself"],
  "type": "post" // or "comment" | "snap"
}
```

Response (Hive Account):
```json
{
  "success": true,
  "method": "hive_account",
  "author": "newusername123",
  "permlink": "my-first-real-post",
  "hive_url": "https://peakd.com/@newusername123/my-first-real-post",
  "earns_rewards": true
}
```

Response (Lite Account):
```json
{
  "success": true,
  "method": "soft_post",
  "author": "skateuser",
  "permlink": "re-skatehive-abc123",
  "overlay_data": {
    "display_name": "John Doe",
    "handle": "john-doe",
    "avatar_url": "https://..."
  },
  "earns_rewards": false
}
```

### Key Management Routes

**POST `/api/userbase/hive-keys/set`**

Manually set posting key (encrypts and stores).

Request:
```json
{
  "hive_username": "myusername",
  "posting_key": "5J..." // WIF format
}
```

Response:
```json
{
  "success": true,
  "key_stored": true,
  "can_post_as": "myusername"
}
```

**DELETE `/api/userbase/hive-keys/revoke`**

Remove stored posting key.

Response:
```json
{
  "success": true,
  "key_removed": true,
  "posting_method": "soft_post" // Reverts to lite account
}
```

**GET `/api/userbase/hive-keys/backup`**

Re-send key backup email (for sponsored users).

Response:
```json
{
  "success": true,
  "email_sent": true,
  "sent_to": "user@example.com"
}
```

---

## User Experience

### For Lite Account Users

**Day 1:**
- Signs up with email in 30 seconds
- Posts first snap, gets upvotes from community
- Sees own name/avatar in feed (not "skateuser")
- No idea blockchain is involved

**Day 7:**
- Active member, quality content
- OG skater sponsors their account
- Receives email: "You've been sponsored! 🎉"
- Downloads key backup file
- Continues posting (now earns real Hive rewards)

**Day 14:**
- Imports keys to Hive Keychain (optional)
- Can post from other Hive apps (PeakD, Ecency)
- Starts earning author rewards
- Becomes an OG user, sponsors others

### For Sponsor (OG) Users

**Sponsoring Someone:**
1. Browse feed, see great content from lite user
2. Click "Sponsor" button on their profile
3. Modal shows: "Sponsor @skaterlite for 3 HIVE?"
4. Keychain popup: Approve transaction
5. Toast notification: "Sponsorship initiated!"
6. User gets notification: "@newskater was successfully sponsored!"

**Checking Sponsorships:**
- `/settings/my-sponsorships` page shows all sponsored users
- See their activity, rewards earned
- Community leaderboard for top sponsors

---

## Economics & Incentives

### Sponsorship Costs

| Method | Cost | Speed | Requirements |
|--------|------|-------|--------------|
| **Hive Transfer** | 3 HIVE (~$0.60) | 2-5 min | Any Hive account |
| **Account Token** | 1 token | Instant | RC delegation required |

### Sponsor Incentives (Future)

- **Reputation Boost:** Sponsoring increases sponsor's reputation
- **Badge System:** "Top Sponsor" badge at 10 sponsorships
- **Referral Rewards:** 5% of sponsored user's author rewards for first 30 days
- **Community Recognition:** Leaderboard on homepage

### Preventing Abuse

**Lite Account Restrictions:**
- Must have 5+ posts before eligible for sponsorship
- Account age minimum: 7 days
- Must have received upvotes from 3+ unique users
- Limit: 1 sponsorship per lite account

**Sponsor Restrictions:**
- Minimum HP: 50 HP (prevents Sybil attacks)
- Rate limit: 5 sponsorships per day
- Cooldown: 24 hours between sponsorships
- Manual review for suspicious patterns

---

## Implementation Roadmap

See `IMPLEMENTATION_PLAN_SPONSORSHIP.md` for detailed technical tasks.

**Phase 1: Foundation (Week 1-2)**
- Database schema for sponsorships and encrypted keys
- Encryption/decryption utilities
- Basic sponsorship API endpoints

**Phase 2: Account Creation (Week 3-4)**
- Hive account creation integration
- Email delivery system for keys
- Key encryption and storage

**Phase 3: Posting Integration (Week 5-6)**
- Posting method detection logic
- Encrypted key decryption for posting
- Fallback handling

**Phase 4: UI/UX (Week 7-8)**
- Sponsor button and modal
- Settings page for key management
- Sponsorship status indicators

**Phase 5: Testing & Launch (Week 9-10)**
- End-to-end testing
- Security audit
- Beta launch with limited sponsorships
- Monitoring and iteration

---

## Success Metrics

### Onboarding Metrics
- **Lite account signups:** Target 1000/month
- **Time to first post:** < 2 minutes average
- **Lite account retention:** > 50% active after 7 days

### Sponsorship Metrics
- **Sponsorship rate:** > 20% of active lite accounts get sponsored
- **Time to sponsorship:** Average 14 days from signup
- **Sponsored user retention:** > 80% active after sponsorship

### Engagement Metrics
- **Posts per user (lite):** 5+ posts before sponsorship
- **Posts per user (sponsored):** 10+ posts after sponsorship
- **Rewards earned:** Average 10 HP earned in first month

---

## FAQ

**Q: What happens if a user loses their key backup email?**
A: They can re-download from Settings → Hive Account → Download Backup. We also store the encrypted key, so they can always revoke and re-link via Keychain.

**Q: Can a lite account become a full Hive account without sponsorship?**
A: Yes! They can manually link an existing Hive account via Keychain, or create one themselves and link it.

**Q: What if a sponsored account violates ToS?**
A: The Hive account is permanent (blockchain rules), but we can revoke their app access and remove the stored posting key.

**Q: Do sponsors get anything in return?**
A: Currently recognition and reputation. Future plans include referral rewards (5% of sponsored user's earnings for 30 days).

**Q: Is the posting key safe if Supabase is breached?**
A: Keys are encrypted with AES-256-GCM. Without the `MASTER_ENCRYPTION_SECRET` (stored in environment variables, not in database), the keys are useless.

**Q: Can users export their data?**
A: Yes, GDPR-compliant export includes all posts, profile data, and encrypted key (they can decrypt with their backup).

---

## Related Documentation

- `USERBASE_MULTI_IDENTITY_AUTH.md` - Core authentication system
- `USERBASE_SOFT_POSTS.md` - Lite account posting system
- `IMPLEMENTATION_PLAN_SPONSORSHIP.md` - Technical implementation tasks
- `TESTING_USERBASE_AUTH.md` - Testing scenarios

---

## Conclusion

The Lite Account Sponsorship System transforms Web3 onboarding from a technical barrier into a community-driven growth engine. Users start with zero friction and earn their way to full blockchain accounts through quality contributions.

**Impact:**
- 📈 **10x onboarding conversion** (95% drop-off → 50% retention)
- 🎯 **Quality over quantity** (community validates before sponsorship)
- 🔐 **Security without complexity** (keys managed transparently)
- 🛹 **Skatehive becomes model for Web3 UX**

🛹 **Let's revolutionize onboarding!**

---

*Last updated: January 30, 2026*
*Status: Planning & Design*
