# Skatehive 3.0 - Claude Code Memory

## Core Mission: Frictionless Hive Access

**Ultimate Goal:** Enable ANY user to access ALL Hive features of Skatehive without friction, regardless of how they sign up or which identities they have.

---

## The Four Entry Points

Users can join Skatehive through ANY of these methods - all are equal citizens:

| Entry Point | What They Have | Can Post? | Can Vote? | Can Comment? |
|-------------|----------------|-----------|-----------|--------------|
| **Email** | Magic link auth | ✅ Yes | ✅ Yes | ✅ Yes |
| **EVM Wallet** | MetaMask, WalletConnect | ✅ Yes | ✅ Yes | ✅ Yes |
| **Farcaster** | Sign in with Farcaster | ✅ Yes | ✅ Yes | ✅ Yes |
| **Hive Keychain** | Direct blockchain auth | ✅ Yes | ✅ Yes | ✅ Yes |

**Key Principle:** The entry point doesn't matter. Every user gets full Hive functionality immediately.

---

## How Hive Features Work (The Magic)

### Users WITHOUT a Hive Posting Key ("Lite Accounts")

This includes: Email-only, EVM-only, Farcaster-only users (anyone who hasn't linked Hive or stored a key)

```
User Action → Skatehive Backend → Hive Blockchain
     ↓              ↓                    ↓
  "Post!"    Uses @skateuser key    Post appears from @skateuser
                    ↓
             But UI shows overlay with REAL user's profile
                    ↓
             Attribution tracked in userbase_soft_posts
```

**User Experience:** They don't know they're using a shared account. The post shows their name, avatar, and profile link.

### Users WITH a Hive Posting Key ("Full Accounts")

This includes: Users with Keychain, sponsored users, users who stored their key

```
User Action → Skatehive Backend → Hive Blockchain
     ↓              ↓                    ↓
  "Post!"    Uses USER'S OWN key    Post appears from @their_username
```

**User Experience:** Posts directly under their own Hive account. Full blockchain ownership.

---

## Posting Key Priority Logic

When a user tries to post/vote/comment, the system checks in this order:

```
1. Does user have encrypted key in userbase_hive_keys?
   → YES: Decrypt and use it (direct posting as their account)

2. Does user have linked Hive identity + Keychain available?
   → YES: Use Keychain to sign (direct posting as their account)

3. Fall back to DEFAULT_HIVE_POSTING_KEY
   → Post via shared @skateuser account
   → Create soft_post/soft_vote record for attribution
   → UI shows overlay with real user's profile
```

---

## Upgrade Paths (Lite → Full)

### Path 1: Get Sponsored
- Any OG user can sponsor a lite user
- Creates real Hive account via Keychain
- Posting key encrypted and stored automatically
- User now posts under their own Hive username

### Path 2: Link Existing Hive Account
- User already has a Hive account from elsewhere
- Links via Keychain signature verification
- Can post via Keychain when available

### Path 3: Store Posting Key Manually
- User has Hive account but wants convenience
- Goes to `/settings/hive`, enters username + posting key
- Key validated against on-chain public keys
- Encrypted and stored
- Can now login with email/wallet AND post directly (no Keychain popup)

---

## Usage Scenarios & Simulations

### Scenario 1: New Skater (Email Entry)
```
1. Discovers Skatehive, signs up with email
2. Gets magic link, clicks, logged in
3. Posts first skate video → appears from @skateuser but shows their profile
4. Engages for a week, builds reputation
5. OG user sees their content, clicks "Sponsor"
6. Now has @newskater Hive account
7. Future posts go directly to blockchain under their name
```

### Scenario 2: Crypto Native (Wallet Entry)
```
1. Connects MetaMask to Skatehive
2. Account auto-created from wallet address
3. Posts content → goes via @skateuser with overlay
4. Realizes they have old Hive account from 2020
5. Links Hive via Keychain in settings
6. System asks "Merge accounts?" → Yes
7. Now has full Hive + EVM identity, posts via Keychain
```

### Scenario 3: Farcaster User
```
1. Signs in with Farcaster
2. Account created with Farcaster profile data
3. Posts content → goes via @skateuser with overlay
4. Their Farcaster has verified wallets → auto-detected as linkable
5. Links wallet with one click
6. Gets sponsored by community
7. Now has Hive + Farcaster + EVM all linked
```

### Scenario 4: Existing Hive User Wants Convenience
```
1. Logs in with Keychain (already has Hive account)
2. Links email for easier login
3. Posts require Keychain popup every time (annoying)
4. Goes to /settings/hive, stores posting key
5. Now logs in with email, posts without popups
6. Keychain still works when needed (for active key operations)
```

### Scenario 5: Multi-Identity Power User
```
1. Started with email, got sponsored
2. Linked their wallet for NFT features
3. Linked Farcaster for social features
4. Has ALL identities connected
5. Can login with any method
6. Posts always go under their Hive account
7. Profile shows all their connected identities
```

### Scenario 6: Account Collision (Merge)
```
1. User signed up with email months ago
2. Today logs in with wallet (forgot about email account)
3. System creates new account for wallet
4. Tries to link Hive → "Already linked to another account"
5. Confirms merge → all identities combined
6. Old email account absorbed into current account
```

---

## Identity Linking Rules

| Current Identity | Can Link | Result |
|------------------|----------|--------|
| Email | + Hive | Direct posting enabled |
| Email | + EVM | Wallet features, same posting |
| Email | + Farcaster | Social features, same posting |
| EVM | + Hive | Direct posting enabled |
| EVM | + Email | Email login convenience |
| EVM | + Farcaster | Social features |
| Farcaster | + Hive | Direct posting enabled |
| Farcaster | + EVM | Wallet features |
| Farcaster | + Email | Email login convenience |
| Any | + Any already linked | Merge accounts dialog |

---

## Soft Posts & Attribution

When lite accounts post via shared key:

```sql
userbase_soft_posts:
  - user_id: UUID of the REAL author
  - author: "skateuser" (the shared account)
  - permlink: "the-post-permlink"
  - safe_user: HMAC hash for privacy
  - status: "broadcasted"
```

**UI Overlay Logic:**
```
1. Fetch post from Hive (shows @skateuser as author)
2. Check userbase_soft_posts for matching author+permlink
3. If found → overlay the real user's profile
4. Display shows: real user's avatar, name, profile link
```

---

## Database Tables (10 total)

| Table | Purpose |
|-------|---------|
| `userbase_users` | Core profiles (handle, display_name, avatar) |
| `userbase_sessions` | 30-day refresh tokens |
| `userbase_auth_methods` | Email magic link credentials |
| `userbase_identities` | Linked identities (Hive, EVM, Farcaster) |
| `userbase_identity_challenges` | Challenge-response nonces (15min TTL) |
| `userbase_magic_links` | Magic link tokens |
| `userbase_hive_keys` | Encrypted posting keys (AES-256-GCM) |
| `userbase_soft_posts` | Attribution for shared account posts |
| `userbase_soft_votes` | Attribution for shared account votes |
| `userbase_sponsorships` | Hive account sponsorship records |

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Shared Posting (for lite accounts)
DEFAULT_HIVE_POSTING_ACCOUNT=skateuser
DEFAULT_HIVE_POSTING_KEY=5xxx...

# Key Encryption (NEVER CHANGE AFTER DEPLOYMENT)
ENCRYPTION_KEY=64_hex_chars

# Farcaster
NEYNAR_API_KEY=xxx

# Email
RESEND_API_KEY=xxx
RESEND_FROM_EMAIL=noreply@skatehive.app

# Session
JWT_SECRET=xxx
```

---

## Key Principles (Never Forget)

1. **Entry point doesn't matter** - All users are equal, all get full features
2. **Complexity is hidden** - Users don't see blockchain mechanics
3. **Upgrade is optional** - Lite accounts work forever, sponsorship is a bonus
4. **Soft posts are attribution, not queuing** - Broadcast is immediate
5. **No cron jobs needed** - Everything is synchronous in API routes
6. **Works on Vercel free tier** - No background workers required
7. **Farcaster login = verification** - No additional challenge needed
8. **Merge preserves everything** - All identities and data combined

---

## Current Branch: userbase

**Status:** Production ready, testing in progress

**Last Updated:** 2026-01-31
