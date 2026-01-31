# Userbase Integration - Comprehensive Test Checklist

## Test Environment Setup

Before testing, ensure:
- [ ] Database migrations are applied
- [ ] Environment variables are configured (`.env.local`)
- [ ] SMTP email is configured for testing
- [ ] Supabase project is running
- [ ] Default posting account has sufficient RC (Resource Credits)

---

## 1. Email-Based Lite Accounts

### 1.1 Registration & Authentication
- [ ] **Sign up with email**
  - [ ] Enter valid email address
  - [ ] Receive magic link email
  - [ ] Click magic link and verify successful login
  - [ ] Check session cookie is set
  - [ ] Verify `userbase_users` record created
  - [ ] Verify `userbase_auth_methods` record created (type: `email_magic`)
  - [ ] Verify `userbase_sessions` record created

- [ ] **Email validation**
  - [ ] Try invalid email format (should fail)
  - [ ] Try already registered email (should send link to existing account)
  - [ ] Try email with different casing (should match existing)

- [ ] **Profile setup**
  - [ ] Set handle/username
  - [ ] Upload avatar
  - [ ] Set display name, bio, location
  - [ ] Verify handle uniqueness (case-insensitive)

- [ ] **Session management**
  - [ ] Verify session persists across page reloads
  - [ ] Test session expiration (check after 30 days)
  - [ ] Test logout (session should be revoked)
  - [ ] Test concurrent sessions on different devices

### 1.2 Content Creation (Lite Accounts)
- [ ] **Create snap (short-form post)**
  - [ ] Write text content
  - [ ] Upload image/video
  - [ ] Submit successfully
  - [ ] Verify `userbase_soft_posts` record created
  - [ ] Verify `type = 'snap'`
  - [ ] Verify `author` is default posting account
  - [ ] Verify `safe_user` metadata contains lite user handle
  - [ ] Verify post appears on profile
  - [ ] Verify post shows lite user's avatar/handle (overlay)

- [ ] **Create comment**
  - [ ] Comment on existing post
  - [ ] Submit successfully
  - [ ] Verify `userbase_soft_posts` record created
  - [ ] Verify `type = 'comment'`
  - [ ] Verify comment shows with lite user identity

- [ ] **Create magazine post**
  - [ ] Write title and body
  - [ ] Select thumbnail
  - [ ] Add hashtags
  - [ ] Submit successfully
  - [ ] Verify `userbase_soft_posts` record created
  - [ ] Verify `type = 'post'`
  - [ ] Verify post appears in magazine feed
  - [ ] Verify correct user overlay

### 1.3 Voting (Lite Accounts)
- [ ] **Upvote a post**
  - [ ] Click upvote button
  - [ ] Verify `userbase_soft_votes` record created
  - [ ] Verify vote shows as active in UI
  - [ ] Verify vote weight is stored

- [ ] **Downvote a post**
  - [ ] Click downvote button
  - [ ] Verify vote recorded with negative weight

- [ ] **Change vote**
  - [ ] Upvote, then downvote same post
  - [ ] Verify vote is updated (not duplicated)
  - [ ] Check unique constraint on `user_id + author + permlink`

- [ ] **Remove vote**
  - [ ] Vote, then click again to remove
  - [ ] Verify vote is removed from database

### 1.4 Profile & Identity
- [ ] **View own profile**
  - [ ] See all soft posts attributed to user
  - [ ] See correct avatar and display name
  - [ ] See account type indicator (lite account)

- [ ] **Edit profile**
  - [ ] Update avatar
  - [ ] Update bio
  - [ ] Update location
  - [ ] Changes persist after reload

---

## 2. Farcaster Integration

### 2.1 Farcaster Sign-In
- [ ] **Connect with Farcaster**
  - [ ] Click "Sign in with Farcaster" button
  - [ ] Complete Farcaster auth flow
  - [ ] Verify `userbase_users` record created
  - [ ] Verify `userbase_identities` record created (type: `farcaster`)
  - [ ] Verify FID stored in `external_id`
  - [ ] Verify Farcaster username in `handle`
  - [ ] Verify session created

- [ ] **Farcaster profile sync**
  - [ ] Verify display name imported from Farcaster
  - [ ] Verify avatar imported from Farcaster
  - [ ] Verify bio imported (if available)

### 2.2 Content Creation (Farcaster Accounts)
- [ ] **Create snap**
  - [ ] Same as lite account snap creation
  - [ ] Verify soft post created
  - [ ] Verify Farcaster identity shown

- [ ] **Create comment**
  - [ ] Same as lite account comment creation

- [ ] **Create magazine post**
  - [ ] Same as lite account post creation

### 2.3 Voting (Farcaster Accounts)
- [ ] **Upvote/downvote**
  - [ ] Same as lite account voting
  - [ ] Verify soft votes created

---

## 3. EVM Wallet Integration

### 3.1 Wallet Connection
- [ ] **Connect MetaMask**
  - [ ] Click "Connect Wallet"
  - [ ] Sign message to verify ownership
  - [ ] Verify `userbase_identities` record created (type: `evm`)
  - [ ] Verify wallet address stored
  - [ ] Verify signature challenge/response

- [ ] **Connect WalletConnect**
  - [ ] Same flow as MetaMask
  - [ ] Test with different wallets (Rainbow, Trust, etc.)

- [ ] **Multiple wallet addresses**
  - [ ] Connect first wallet
  - [ ] Add second wallet to same account
  - [ ] Verify both identities linked to same user
  - [ ] Set one as primary

### 3.2 Content & Voting (Wallet Accounts)
- [ ] **Create content**
  - [ ] Same as lite accounts (soft posts)

- [ ] **Vote on content**
  - [ ] Same as lite accounts (soft votes)

---

## 4. Hive Wallet Integration (Keychain)

### 4.1 Keychain Connection
- [ ] **Connect Hive Keychain**
  - [ ] Click "Connect Hive Wallet"
  - [ ] Sign challenge message with posting key
  - [ ] Verify `userbase_identities` record created (type: `hive`)
  - [ ] Verify Hive username stored
  - [ ] Verify `is_primary = true` if first Hive identity

- [ ] **Multiple Hive accounts**
  - [ ] Connect first Hive account
  - [ ] Add second Hive account
  - [ ] Verify both linked to user
  - [ ] Test switching primary account

### 4.2 Direct Hive Posting (Wallet Users)
- [ ] **Create snap with Keychain**
  - [ ] Write content
  - [ ] Submit
  - [ ] Verify broadcast directly to Hive (NOT soft post)
  - [ ] Verify post shows on Hive blockchain
  - [ ] Verify post shows in feed immediately

- [ ] **Create comment with Keychain**
  - [ ] Comment on post
  - [ ] Verify direct Hive broadcast

- [ ] **Create magazine post with Keychain**
  - [ ] Full blog post
  - [ ] Verify direct Hive broadcast

### 4.3 Direct Hive Voting (Wallet Users)
- [ ] **Upvote with Keychain**
  - [ ] Click upvote
  - [ ] Sign vote transaction
  - [ ] Verify vote broadcasts directly to Hive (NOT soft vote)
  - [ ] Verify vote shows immediately

- [ ] **Downvote with Keychain**
  - [ ] Same as upvote

---

## 5. Sponsorship System

### 5.1 Eligibility Check
- [ ] **Check lite account eligibility**
  - [ ] Create lite account
  - [ ] Post 3+ pieces of content
  - [ ] Check sponsorship eligibility endpoint
  - [ ] Verify eligible status returned

- [ ] **Check ineligible account**
  - [ ] New lite account with no content
  - [ ] Verify not eligible
  - [ ] Check minimum requirements displayed

### 5.2 Sponsorship Creation
- [ ] **Sponsor a lite account**
  - [ ] Log in as OG Hive user (with Keychain)
  - [ ] Find eligible lite account
  - [ ] Click "Sponsor" button
  - [ ] Choose username for sponsorship
  - [ ] Verify username availability check
  - [ ] Verify username format validation
  - [ ] Select cost type (HIVE transfer or account token)
  - [ ] Confirm sponsorship
  - [ ] Verify `userbase_sponsorships` record created
  - [ ] Verify `status = 'pending'`

### 5.3 Sponsorship Processing
- [ ] **Process pending sponsorship**
  - [ ] Trigger sponsorship processing endpoint/cron
  - [ ] Verify status changes to `processing`
  - [ ] Verify Hive account creation attempted
  - [ ] Verify status changes to `completed` on success
  - [ ] Verify `hive_tx_id` is stored

- [ ] **Email delivery**
  - [ ] Verify lite user receives email with:
    - [ ] New Hive username
    - [ ] Master password (encrypted)
    - [ ] Posting key (encrypted)
    - [ ] Active key (encrypted)
    - [ ] Instructions for key backup

### 5.4 Post-Sponsorship Verification
- [ ] **Hive account created**
  - [ ] Verify account exists on Hive blockchain
  - [ ] Verify posting authority set correctly
  - [ ] Verify profile metadata updated

- [ ] **Hive key storage**
  - [ ] Verify `userbase_hive_keys` record created
  - [ ] Verify `key_type = 'sponsored'`
  - [ ] Verify posting key is encrypted (AES-256-GCM)
  - [ ] Verify IV and auth tag stored
  - [ ] Cannot decrypt key without encryption secret

- [ ] **Identity update**
  - [ ] Verify `userbase_identities` updated
  - [ ] Verify `is_sponsored = true`
  - [ ] Verify `sponsor_user_id` set correctly
  - [ ] Verify Hive username added to identity

- [ ] **User transition**
  - [ ] Log in as sponsored user
  - [ ] Verify can still see old soft posts
  - [ ] Create new snap
  - [ ] Verify posts now use sponsored Hive account (NOT soft post)
  - [ ] Verify posts show with sponsored username

### 5.5 Failed Sponsorship Handling
- [ ] **Invalid username**
  - [ ] Try to sponsor with taken username
  - [ ] Verify sponsorship fails gracefully
  - [ ] Verify error message stored

- [ ] **Insufficient RC**
  - [ ] Attempt sponsorship with low RC account
  - [ ] Verify error handling

---

## 6. Profile Merging

### 6.1 Merge Preview
- [ ] **Preview merge for lite + Hive**
  - [ ] Create lite account with content
  - [ ] Link Hive account
  - [ ] Request merge preview
  - [ ] Verify shows all soft posts to be migrated
  - [ ] Verify shows target Hive account

- [ ] **Preview merge for lite + Farcaster + EVM**
  - [ ] Create account with multiple identities
  - [ ] Verify all identities shown in preview

### 6.2 Execute Merge
- [ ] **Merge lite account to Hive**
  - [ ] Execute merge
  - [ ] Verify all soft posts now show Hive username
  - [ ] Verify profile shows Hive identity as primary
  - [ ] Verify old soft post metadata preserved

- [ ] **Post-merge posting**
  - [ ] Create new content after merge
  - [ ] Verify posts use Hive account directly (if key available)
  - [ ] Verify posts no longer create soft posts

### 6.3 Merge Audit Trail
- [ ] **Check audit records**
  - [ ] Verify `userbase_merge_audit` records created
  - [ ] Verify merge metadata stored
  - [ ] Verify timestamp recorded

---

## 7. Settings & Key Management

### 7.1 Hive Account Settings Page
- [ ] **View Hive key status**
  - [ ] Navigate to /settings/hive
  - [ ] If sponsored: see encrypted key indicator
  - [ ] If manual key: see manual key indicator
  - [ ] If no key: see option to add key

- [ ] **Add manual posting key**
  - [ ] Enter Hive username
  - [ ] Enter posting key
  - [ ] Submit
  - [ ] Verify key is encrypted and stored
  - [ ] Verify `key_type = 'user_provided'`

- [ ] **Resend key backup email**
  - [ ] Click "Resend backup email"
  - [ ] Verify email sent with encrypted keys
  - [ ] Verify email contains proper formatting

### 7.2 Identity Management
- [ ] **View all linked identities**
  - [ ] See all connected accounts (Hive, Farcaster, EVM)
  - [ ] See which is primary
  - [ ] See verification status

- [ ] **Set primary identity**
  - [ ] Change primary identity
  - [ ] Verify UI updates
  - [ ] Verify database updated

- [ ] **Remove identity**
  - [ ] Remove non-primary identity
  - [ ] Verify removed from database
  - [ ] Cannot remove last identity

---

## 8. Edge Cases & Error Handling

### 8.1 Duplicate Prevention
- [ ] **Duplicate email registration**
  - [ ] Register with email A
  - [ ] Try to register again with email A
  - [ ] Verify sends login link (not error)

- [ ] **Duplicate handle**
  - [ ] Create user with handle "testuser"
  - [ ] Try to create another with "TestUser" (different case)
  - [ ] Verify case-insensitive uniqueness enforced

- [ ] **Duplicate Farcaster FID**
  - [ ] Link Farcaster account
  - [ ] Try to link same FID to different account
  - [ ] Verify error or merge prompt

### 8.2 Concurrency
- [ ] **Simultaneous votes**
  - [ ] Vote on same post from same account twice quickly
  - [ ] Verify only one vote recorded

- [ ] **Simultaneous sponsorships**
  - [ ] Try to sponsor same user twice
  - [ ] Verify unique constraint prevents duplicate

### 8.3 Session Security
- [ ] **Invalid session token**
  - [ ] Manually modify session cookie
  - [ ] Verify rejected with 401

- [ ] **Expired session**
  - [ ] Create session, manually set expiry to past
  - [ ] Verify rejected

- [ ] **Revoked session**
  - [ ] Log out
  - [ ] Try to use old session cookie
  - [ ] Verify rejected

### 8.4 Data Integrity
- [ ] **Orphaned soft posts**
  - [ ] Verify soft posts cannot exist without user (cascade delete)
  - [ ] Delete user
  - [ ] Verify soft posts deleted

- [ ] **Orphaned identities**
  - [ ] Same cascade delete check for identities

### 8.5 Error Recovery
- [ ] **Failed Hive broadcast**
  - [ ] Simulate Hive node failure
  - [ ] Verify error message shown to user
  - [ ] Verify soft post status = 'failed'
  - [ ] Verify retry mechanism works

- [ ] **Failed email delivery**
  - [ ] Simulate SMTP failure
  - [ ] Verify error logged
  - [ ] Verify user can request resend

---

## 9. Performance Testing

### 9.1 Query Performance
- [ ] **Profile page load time**
  - [ ] Load profile with 100+ soft posts
  - [ ] Verify page loads in <2s
  - [ ] Check database query count
  - [ ] Verify proper pagination

- [ ] **Feed performance**
  - [ ] Load feed with mixed content (soft posts + Hive posts)
  - [ ] Verify efficient queries (use indexes)
  - [ ] Check N+1 query issues

### 9.2 Concurrent Users
- [ ] **Multiple simultaneous registrations**
  - [ ] Create 10+ accounts simultaneously
  - [ ] Verify all succeed
  - [ ] Check for race conditions

- [ ] **Heavy voting load**
  - [ ] Simulate 50+ votes per second
  - [ ] Verify database handles load
  - [ ] Check connection pool limits

---

## 10. Migration & Rollback Testing

### 10.1 Database Migrations
- [ ] **Fresh database**
  - [ ] Apply all migrations from scratch
  - [ ] Verify no errors
  - [ ] Verify all tables created
  - [ ] Verify all indexes created

- [ ] **Migration idempotency**
  - [ ] Run same migration twice
  - [ ] Verify no errors (IF NOT EXISTS clauses)

### 10.2 Data Migration
- [ ] **Migrate existing soft posts**
  - [ ] Create soft posts with old schema
  - [ ] Run migration to add `safe_user` column
  - [ ] Verify data migrated correctly

---

## 11. Security Testing

### 11.1 Authentication
- [ ] **Session hijacking prevention**
  - [ ] Try to use another user's session token
  - [ ] Verify rejected

- [ ] **CSRF protection**
  - [ ] Verify CSRF tokens on forms (if implemented)

### 11.2 Authorization
- [ ] **Access control**
  - [ ] Try to access another user's settings
  - [ ] Try to modify another user's profile
  - [ ] Verify RLS policies prevent unauthorized access

- [ ] **SQL injection**
  - [ ] Try SQL injection in handle field
  - [ ] Verify parameterized queries prevent injection

### 11.3 Key Security
- [ ] **Encrypted key storage**
  - [ ] Verify keys stored in encrypted form
  - [ ] Verify IV and auth tag present
  - [ ] Verify cannot decrypt without secret

- [ ] **Key access logging**
  - [ ] Decrypt a key
  - [ ] Verify `userbase_key_usage_audit` record created
  - [ ] Verify action, route, IP hash logged

---

## 12. Monitoring & Observability

### 12.1 Logging
- [ ] **Audit trail**
  - [ ] Verify key usage logged
  - [ ] Verify sponsorships logged
  - [ ] Verify merges logged

### 12.2 Metrics
- [ ] **Track key metrics**
  - [ ] New user registrations per day
  - [ ] Soft posts created per day
  - [ ] Sponsorships completed per day
  - [ ] Lite → sponsored conversion rate

---

## Test Completion Criteria

✅ All test cases pass
✅ No critical bugs found
✅ Performance meets requirements (<2s page loads)
✅ Security vulnerabilities addressed
✅ Documentation updated
✅ Database optimizations applied

---

## Automated Testing TODO

Consider adding automated tests for:
- Unit tests for encryption/decryption utilities
- Integration tests for API endpoints
- E2E tests for critical user flows (registration, posting, voting)
- Load tests for concurrent users
- Database migration tests

---

**Last Updated:** 2026-01-31
