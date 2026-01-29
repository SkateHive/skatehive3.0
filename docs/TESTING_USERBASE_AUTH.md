# Userbase Authentication Testing Guide

**Branch:** `userbase`
**Date:** January 29, 2026 (Updated)
**Testers:** Please report results in the testing spreadsheet or Discord thread

---

## Overview

We've implemented a **Multi-Identity Authentication System** called **Userbase** that allows users to sign up with any method (email, Hive, wallet, Farcaster) and link additional identities later. This creates a unified cross-platform profile. This testing guide covers all authentication methods and their combinations.

**Key Features (January 2026):**
- ✅ Email magic link authentication
- ✅ Hive Keychain login with auto-account creation
- ✅ EVM wallet connection (MetaMask, WalletConnect)
- ✅ Farcaster integration (Neynar API)
- ✅ One-click identity linking with automatic routing
- ✅ Account merging for duplicate identities
- ✅ Profile mode switching (Hive, Zora, Farcaster)

---

## Testing Environment

- **URL:** `https://[staging-url]` or `http://localhost:3000`
- **Browser:** Chrome recommended (also test Firefox, Safari)
- **Extensions needed:** 
  - Hive Keychain (for Hive login tests)
  - MetaMask or similar (for Ethereum login tests)

---

## Test Scenarios

### 📧 Test 1: Email-Only Login (New User)

**Steps:**
1. Open the app in an incognito/private window
2. Click the login button in the sidebar (bottom left)
3. In the Connection Modal, find "App Account" section
4. Click "Sign up here" link
5. Enter a NEW email address (one you haven't used before)
6. Enter a display name (e.g., "Skate Tester" - can have spaces and capitals)
7. Click "Sign Up"
8. Check your email for the magic link
9. Click the magic link to complete sign up
10. You should be redirected back and logged in

**Expected Results:**
- [ ] Magic link email received within 2 minutes
- [ ] After clicking link, user is logged in
- [ ] Sidebar/connection button shows your chosen display name (e.g., "Skate Tester")
- [ ] Your handle is the slugified version (e.g., "skate-tester")
- [ ] Can navigate to `/user/skate-tester` and see your profile
- [ ] Edit profile button (gear icon) appears on your profile
- [ ] Can edit display name, bio, location, avatar, cover
- [ ] Display name has priority over handle in UI

**Report:**
```
Test 1 - Email Login (New User)
Result: PASS / FAIL
Issues: [describe any issues]
```

---

### 📧 Test 2: Email Login (Returning User)

**Steps:**
1. Open the app (can use same browser, or incognito)
2. Click login button
3. In "App Account" section, click "Sign in"
4. Enter the email you used in Test 1
5. Check email for magic link
6. Click link

**Expected Results:**
- [ ] Magic link received
- [ ] Logged in with same account as before
- [ ] Profile data (handle, avatar, etc.) persisted from before

**Report:**
```
Test 2 - Email Login (Returning)
Result: PASS / FAIL
Issues: [describe any issues]
```

---

### 🐝 Test 3: Hive Keychain Login Only

**Steps:**
1. Open app in incognito window (fresh session)
2. Make sure Hive Keychain extension is installed
3. Click login button
4. Click "Connect with Hive Keychain"
5. Approve the login in Keychain popup

**Expected Results:**
- [ ] Keychain popup appears
- [ ] After approval, logged in with Hive username
- [ ] Can navigate to `/user/[hive-username]`
- [ ] Profile shows Hive data (followers, following, posts, etc.)
- [ ] Snaps tab shows your snaps
- [ ] Can post snaps/content

**Report:**
```
Test 3 - Hive Keychain Only
Result: PASS / FAIL
Issues: [describe any issues]
```

---

### 💎 Test 4: Ethereum Wallet Login Only

**Steps:**
1. Open app in incognito window
2. Make sure MetaMask (or similar) is installed
3. Click login button
4. Click "Connect with Ethereum"
5. Select wallet and approve connection
6. Sign the message if prompted

**Expected Results:**
- [ ] Wallet popup appears
- [ ] After approval, logged in
- [ ] Profile shows wallet address or ENS name
- [ ] Can view tokens tab on profile
- [ ] Zora profile toggle available (if applicable)

**Report:**
```
Test 4 - Ethereum Only
Result: PASS / FAIL
Issues: [describe any issues]
```

---

### 🔗 Test 5: Email + Link Hive Identity (ONE-CLICK FLOW)

**Steps:**
1. Login with email first (Test 1 or 2)
2. Click user button (sidebar) → Opens Connection Modal OR go to Settings page
3. Find "Hive" section with "LINK →" button
4. Click "LINK →" button
5. Sign message in Hive Keychain (Posting key)
6. **Automatic verification happens in background (no extra clicks needed)**

**Expected Results:**
- [ ] Keychain popup appears immediately after clicking LINK
- [ ] After signing, NO preview modal appears (invisible flow)
- [ ] Success toast appears: "Hive account linked!"
- [ ] Automatically routes to `/user/[hive-username]` (Hive profile mode)
- [ ] Profile now shows Hive data (followers, HP, posts)
- [ ] Can post snaps that appear on Hive blockchain
- [ ] EVM addresses from Hive profile metadata are automatically linked
- [ ] Farcaster data from Hive profile (if present) is linked
- [ ] Sidebar connection button shows Hive username when in Hive mode

**Timing:**
- [ ] Challenge generation: < 2 seconds
- [ ] Signature verification: < 30 seconds
- [ ] Total flow: < 1 minute from click to profile view

**Edge Cases to Test:**
- [ ] If Hive account is already linked to another app account → Shows merge confirmation
- [ ] If Hive username doesn't exist → Shows error "Hive account not found"
- [ ] If challenge expires (wait 16 minutes) → Shows "Challenge expired" error

**Report:**
```
Test 5 - Email + Link Hive
Result: PASS / FAIL
Issues: [describe any issues]
```

---

### 🔗 Test 6: Email + Link Ethereum Wallet (ONE-CLICK FLOW)

**Steps:**
1. Login with email first
2. Open Connection Modal (click user button in sidebar) OR go to Settings
3. Find "Ethereum" section with "LINK →" button
4. Click "LINK →" button
5. Approve wallet connection in MetaMask/WalletConnect
6. Sign authentication message
7. **Automatic verification happens in background**

**Expected Results:**
- [ ] Wallet popup appears immediately
- [ ] After signing, NO preview modal (invisible flow)
- [ ] Success toast appears: "Wallet linked!"
- [ ] Automatically routes to `/user/[your-handle]?mode=zora` (Zora profile mode)
- [ ] Can view tokens/NFTs tab on profile
- [ ] ENS name (if available) is displayed
- [ ] ENS avatar (if available) is used
- [ ] Wallet address shown in connection modal and settings
- [ ] Profile mode can be switched between App Account and Zora

**Timing:**
- [ ] Challenge generation: < 2 seconds
- [ ] Wallet signature: < 1 minute (depends on user)
- [ ] Verification: < 30 seconds
- [ ] Total flow: < 2 minutes from click to Zora profile

**Edge Cases:**
- [ ] If wallet is already linked to another account → Shows merge confirmation
- [ ] If ENS name is set → Shows ENS name instead of 0x address
- [ ] If challenge expires → Shows "Challenge expired" error

**Report:**
```
Test 6 - Email + Link Ethereum
Result: PASS / FAIL
Issues: [describe any issues]
```

---

### 🔗 Test 6b: Email + Link Farcaster (ONE-CLICK FLOW)

**Steps:**
1. Login with email first
2. Open Connection Modal OR go to Settings
3. Find "Farcaster" section with "LINK →" button
4. Click "LINK →" button
5. Connect via Farcaster (WalletConnect custody address)
6. **Automatic profile fetch from Neynar API + verification**

**Expected Results:**
- [ ] Farcaster connection popup appears
- [ ] After connecting, NO preview modal
- [ ] Success toast: "Farcaster account linked!"
- [ ] Automatically routes to `/user/[your-handle]?mode=farcaster` (Farcaster profile mode)
- [ ] Farcaster profile data displayed (username, FID, PFP, bio)
- [ ] All verified EVM addresses from Farcaster are automatically linked
- [ ] Can switch between App Account, Hive, Zora, and Farcaster modes

**Timing:**
- [ ] Neynar API fetch: < 5 seconds (with timeout)
- [ ] Total flow: < 1 minute

**Edge Cases:**
- [ ] If Neynar API times out → Shows error, doesn't block linking
- [ ] If FID is already linked → Shows merge confirmation
- [ ] Multiple verified wallets from Farcaster → All linked with source priority

---

### 🔗 Test 7: Hive First, Then Email

**Steps:**
1. Login with Hive Keychain first (fresh session)
2. Check if userbase account was auto-created
3. Go to Settings
4. Try to link/add email to account

**Expected Results:**
- [ ] Document what happens
- [ ] Is email linking available?
- [ ] Does it work?

**Report:**
```
Test 7 - Hive First + Email
Result: PASS / FAIL / NOT IMPLEMENTED
Issues: [describe any issues]
```

---

### 📝 Test 8: Post a Snap (Email-Only User)

**Steps:**
1. Login with email only (no Hive linked)
2. Click compose/post button
3. Create a snap with text and/or image
4. Submit

**Expected Results:**
- [ ] Snap posts successfully
- [ ] Snap appears on your profile's Snaps tab
- [ ] Snap appears in main feed
- [ ] Snap shows your display name (not "skateuser")

**Report:**
```
Test 8 - Post Snap (Email User)
Result: PASS / FAIL
Issues: [describe any issues]
```

---

### ❤️ Test 9: Vote on Content (Email-Only User)

**Steps:**
1. Login with email only
2. Find any post in the feed
3. Click the vote/like button
4. Check if vote registered

**Expected Results:**
- [ ] Vote submits successfully
- [ ] Vote count updates
- [ ] Your vote is remembered on page refresh

**Report:**
```
Test 9 - Vote (Email User)
Result: PASS / FAIL
Issues: [describe any issues]
```

---

### ✏️ Test 10: Edit Profile

**Steps:**
1. Login (any method)
2. Go to your profile page
3. Click the edit button (pencil icon near username)
4. Change display name
5. Upload new avatar
6. Upload cover image
7. Add bio and location
8. Save

**Expected Results:**
- [ ] Edit modal opens with SkateModal styling
- [ ] Can upload avatar (IPFS)
- [ ] Can upload cover (IPFS)
- [ ] Changes save successfully
- [ ] Profile updates immediately after save

**Report:**
```
Test 10 - Edit Profile
Result: PASS / FAIL
Issues: [describe any issues]
```

---

### 🚪 Test 11: Logout

**Steps:**
1. While logged in, click the user button in sidebar
2. Click "Sign Out" or "Disconnect"
3. Confirm logout

**Expected Results:**
- [ ] Successfully logged out
- [ ] Session cleared
- [ ] Redirected appropriately
- [ ] Can log back in

**Report:**
```
Test 11 - Logout
Result: PASS / FAIL
Issues: [describe any issues]
```

---

### 📱 Test 12: Mobile Experience

**Steps:**
1. Open app on mobile device or use browser dev tools mobile view
2. Test login flow
3. Test navigation
4. Test posting
5. Test profile viewing/editing

**Expected Results:**
- [ ] Login works on mobile
- [ ] UI is responsive
- [ ] Can navigate and use features

**Report:**
```
Test 12 - Mobile
Result: PASS / FAIL
Issues: [describe any issues]
```

---

### 🔄 Test 13: Profile Mode Switching (Multi-Identity)

**Prerequisites:** Complete Tests 5, 6, and 6b (have Hive, EVM, and Farcaster all linked)

**Steps:**
1. Login with your multi-identity account
2. Open Connection Modal (click user button in sidebar)
3. Observe the identity logos (Hive, Ethereum, Farcaster)
4. Click the Hive logo → Should route to `/user/[hive-username]`
5. Open modal again, click Ethereum logo → Should route to `/user/[handle]?mode=zora`
6. Open modal again, click Farcaster logo → Should route to `/user/[handle]?mode=farcaster`
7. Open modal again, click App Account section → Should route to `/user/[handle]` (default mode)

**Expected Results:**
- [ ] Each logo click routes to the correct profile mode
- [ ] Hive mode shows: Posts, followers, HP, Hive snaps
- [ ] Zora mode shows: NFTs, tokens, collections
- [ ] Farcaster mode shows: Casts, FID, social graph
- [ ] App Account mode shows: Display name, bio, soft posts (email-only content)
- [ ] Connection button in sidebar shows appropriate name for current mode:
  - Hive mode → Shows Hive username
  - Other modes → Shows display_name or handle
- [ ] Profile header updates correctly for each mode
- [ ] Switching is instant (no page reload)

**Report:**
```
Test 13 - Profile Mode Switching
Result: PASS / FAIL
Issues: [describe any issues]
```

---

### 🔀 Test 14: Account Merging

**Prerequisites:** Need TWO separate accounts with different identities

**Setup:**
1. Create Account A: Email signup as "Test User A"
2. Link @hiveuser1 to Account A
3. Logout
4. Create Account B: Email signup as "Test User B"
5. Try to link @hiveuser1 to Account B (should trigger merge prompt)

**Steps:**
1. In Account B, try to link the same Hive account that's already linked to Account A
2. Observe merge confirmation prompt
3. Click "Yes, merge accounts"
4. Verify merge completes

**Expected Results:**
- [ ] System detects existing link and shows merge prompt
- [ ] Prompt explains: "@hiveuser1 is already linked to another account. Merge accounts?"
- [ ] If confirmed, merge happens:
  - All identities from Account A move to Account B
  - All soft posts from Account A move to Account B
  - Account A is deleted
  - Session remains on Account B
- [ ] After merge, can access all identities from Account B
- [ ] Profile shows combined data from both accounts

**Report:**
```
Test 14 - Account Merging
Result: PASS / FAIL
Issues: [describe any issues]
```

---

## Known Issues (Don't Report These)

- WalletConnect initialization warnings in console (cosmetic)
- `/loadingsfx.mp3` 404 error (missing asset)
- Some Hive RPC "Invalid parameters" errors for non-existent usernames

---

## Bug Report Template

```markdown
## Bug Report

**Test Number:** #
**Tester:** [your name]
**Date:** 
**Browser/Device:** 

### Steps to Reproduce
1. 
2. 
3. 

### Expected Behavior


### Actual Behavior


### Screenshots/Console Errors
[attach if applicable]

### Severity
- [ ] Blocker (can't continue)
- [ ] Major (feature broken)
- [ ] Minor (cosmetic/inconvenient)
```

---

## Testing Checklist Summary

| Test | Description | Tester | Result |
|------|-------------|--------|--------|
| 1 | Email signup (new user) - Display name + handle | | |
| 2 | Email login (returning) | | |
| 3 | Hive Keychain only | | |
| 4 | Ethereum only | | |
| 5 | Email + link Hive (one-click, auto-route) | | |
| 6 | Email + link Ethereum (one-click, Zora mode) | | |
| 6b | Email + link Farcaster (one-click) | | |
| 7 | Hive first + email | | |
| 8 | Post snap (email user) | | |
| 9 | Vote (email user) | | |
| 10 | Edit profile | | |
| 11 | Logout | | |
| 12 | Mobile | | |
| 13 | Profile mode switching (multi-identity) | | |
| 14 | Account merging | | |

---

## Questions to Answer

1. Is the one-click identity linking flow intuitive?
2. Are error messages clear when something fails (challenge expired, already linked, etc.)?
3. Does automatic routing after linking feel smooth?
4. Is it clear which profile mode you're currently viewing?
5. Any confusion about handle vs display name?
6. Is the merge confirmation prompt clear and understandable?
7. Do timeouts feel appropriate (not too fast, not too slow)?
8. Can you easily switch between profile modes?
9. Does the connection button show the correct name for each mode?
10. Is it clear which identities are linked in the Connection Modal?

---

## Contact

Report issues to: [Discord channel / GitHub issues / etc.]

Thanks for testing! 🛹
