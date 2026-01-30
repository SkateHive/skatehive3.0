# Sponsorship System Testing Guide

Comprehensive testing documentation for the Hive Account Sponsorship system.

## Test Overview

The sponsorship system has **3 test suites** covering different aspects:

1. **End-to-End Flow Tests** (`__tests__/sponsorship-flow.test.ts`)
2. **API Integration Tests** (`__tests__/api/sponsorship-api.test.ts`)
3. **UI Component Tests** (`__tests__/components/sponsorship-ui.test.tsx`)

---

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
# End-to-end flow tests
npm test sponsorship-flow

# API tests
npm test sponsorship-api

# UI component tests
npm test sponsorship-ui
```

### Run in Watch Mode
```bash
npm test -- --watch
```

### Run with Coverage
```bash
npm test -- --coverage
```

---

## Test Suite 1: End-to-End Flow

**File:** `__tests__/sponsorship-flow.test.ts`

Tests the complete user journey from lite account to sponsored account.

### What's Tested

#### Step 1: Username Generation
- ✅ Valid Hive username generation from display names
- ✅ Username validation (length, chars, format)
- ✅ Invalid username rejection
- ✅ Unique username generation

#### Step 2: Key Generation
- ✅ All 4 key pairs generated (owner, active, posting, memo)
- ✅ Keys in correct format (WIF for private, STM prefix for public)
- ✅ Different keys for different usernames
- ✅ Random seed usage (non-deterministic)

#### Step 3: Account Creation Operation
- ✅ Valid `account_create` operation structure
- ✅ All authority keys included
- ✅ Correct fee format ("3.000 HIVE")
- ✅ Recovery account configuration

#### Step 4: Key Encryption
- ✅ AES-256-GCM encryption
- ✅ User-specific encryption keys
- ✅ Random IV per encryption
- ✅ Authentication tag validation
- ✅ Tamper detection
- ✅ Cross-user isolation

#### Step 5: Posting Method Detection
- ✅ `soft_post` for lite accounts
- ✅ `hive_account` for sponsored users
- ✅ `keychain_signing` for Hive users without stored keys

#### Step 6: Email and Backup
- ✅ Full backup email format (all keys)
- ✅ Partial backup email format (posting key only)
- ✅ Attachment generation (JSON + TXT)

### Example Test

```typescript
it("should complete full sponsorship flow", async () => {
  // 1. Generate keys
  const keys = generateHiveKeys(username);

  // 2. Build operation
  const operation = buildAccountCreateOperation(sponsor, username, keys, fee);

  // 3. Encrypt posting key
  const encrypted = encryptHivePostingKey(keys.posting, userId);

  // 4. Verify encryption/decryption
  const decrypted = decryptHivePostingKey(encrypted, userId);
  expect(decrypted).toBe(keys.posting);
});
```

---

## Test Suite 2: API Integration

**File:** `__tests__/api/sponsorship-api.test.ts`

Tests all HTTP API endpoints for sponsorship functionality.

### Endpoints Tested

#### 1. `GET /api/userbase/sponsorships/eligible/[user_id]`
- ✅ Returns `eligible: true` for lite accounts
- ✅ Returns `eligible: false` for sponsored accounts
- ✅ Returns `eligible: false` for pending sponsorships
- ✅ Returns 404 for non-existent users

#### 2. `POST /api/userbase/sponsorships/create`
- ✅ Creates sponsorship record with valid data
- ✅ Rejects duplicate usernames
- ✅ Validates required fields
- ✅ Validates username format
- ✅ Prevents self-sponsorship

#### 3. `POST /api/userbase/sponsorships/process`
- ✅ Processes sponsorship after blockchain confirmation
- ✅ Encrypts and stores posting key
- ✅ Sends email with keys
- ✅ Updates sponsorship status
- ✅ Rejects invalid transaction IDs
- ✅ Handles already-processed sponsorships

#### 4. `GET /api/userbase/sponsorships/my-info`
- ✅ Returns sponsorship info for authenticated user
- ✅ Returns `sponsored: false` for lite accounts
- ✅ Returns 401 for unauthenticated requests

#### 5. `GET /api/userbase/sponsorships/info/[user_id]`
- ✅ Returns public sponsorship info (no auth required)
- ✅ Returns sponsor username
- ✅ Handles non-existent users gracefully

#### 6. `GET /api/userbase/keys/hive-info`
- ✅ Returns key info for authenticated user
- ✅ Returns `has_key: false` when no key stored
- ✅ Requires authentication

#### 7. `POST /api/userbase/keys/resend-backup`
- ✅ Resends key backup email
- ✅ Returns error if no keys found
- ✅ Handles email delivery failures
- ✅ Requires authentication

### Security Tests
- ✅ Rate limiting
- ✅ Session token validation
- ✅ CSRF protection
- ✅ SQL injection prevention (via parameterized queries)

### Error Handling
- ✅ Malformed JSON
- ✅ Database connection errors
- ✅ Concurrent processing
- ✅ Missing environment variables

---

## Test Suite 3: UI Components

**File:** `__tests__/components/sponsorship-ui.test.tsx`

Tests React components and hooks used in the sponsorship UI.

### Components Tested

#### SponsorButton
- ✅ Renders with gift icon
- ✅ Shows loading state
- ✅ Disables when not eligible
- ✅ Calls callback when clicked
- ✅ Shows error toasts

#### SponsorshipModal
- ✅ Displays user info (name, handle, cost)
- ✅ Shows cost (3 HIVE)
- ✅ Progresses through all steps
- ✅ Disables close during processing
- ✅ Shows error state with retry
- ✅ Auto-closes after success
- ✅ Integrates with Hive Keychain
- ✅ Handles Keychain not installed

#### HiveSponsorshipInfo
- ✅ Shows lite account badge
- ✅ Shows sponsored account info
- ✅ Displays key info
- ✅ Resend backup button
- ✅ Loading states
- ✅ Security warnings

#### Profile Badges
- ✅ "STATUS: LITE" badge (orange)
- ✅ "SPONSORED_BY: @username" badge (green)
- ✅ Terminal-style formatting
- ✅ Integration with IdentityBlock

### Hooks Tested

#### useSponsorshipStatus
- ✅ Fetches status on mount
- ✅ Loading state
- ✅ Returns sponsorship data
- ✅ Error handling
- ✅ Cleanup on unmount

#### useViewerHiveIdentity
- ✅ Returns null when not logged in
- ✅ Fetches viewer's Hive identity
- ✅ Refetches when user changes

### Accessibility Tests
- ✅ ARIA labels
- ✅ Keyboard navigation
- ✅ Color contrast
- ✅ Screen reader support

### Responsive Design
- ✅ Mobile adaptation
- ✅ Touch targets
- ✅ Font sizes

---

## Test Data

### Mock Users

```typescript
// Lite account (not sponsored)
const liteUser = {
  id: "lite-user-123",
  email: "skater@example.com",
  displayName: "Cool Skater",
  handle: "coolskater",
};

// Sponsored account
const sponsoredUser = {
  id: "sponsored-user-456",
  hiveUsername: "sponsoredskater",
  sponsorUsername: "ogsponsor",
  sponsoredAt: "2024-01-01T00:00:00Z",
};

// Sponsor (OG Hive user)
const sponsor = {
  id: "sponsor-789",
  hiveUsername: "ogsponsor",
  hivepower: 1000,
};
```

### Mock Keys

```typescript
const mockKeys = {
  owner: "5JqJKxQGwvz3xtqPzYKxJe3hG7kqF8xqVqYvKxJe3hG7kqF8xqV",
  ownerPublic: "STM8ZSyzjP3kzgWplHEhh4jL3SQmJv2qS...",
  active: "5JqJKxQGwvz3xtqPzYKxJe3hG7kqF8xqVqYvKxJe3hG7kqF8xqW",
  activePublic: "STM7YwXKh9jP3kzgWplHEhh4jL3SQmJv...",
  posting: "5JqJKxQGwvz3xtqPzYKxJe3hG7kqF8xqVqYvKxJe3hG7kqF8xqX",
  postingPublic: "STM6XwYJi8kP3kzgWplHEhh4jL3SQmJ...",
  memo: "5JqJKxQGwvz3xtqPzYKxJe3hG7kqF8xqVqYvKxJe3hG7kqF8xqY",
  memoPublic: "STM5WvZIh7jP3kzgWplHEhh4jL3SQmJv2...",
};
```

---

## Coverage Goals

### Target Coverage: **80%+**

- **Encryption**: 100% (critical security code)
- **Key Generation**: 100% (critical functionality)
- **API Routes**: 90%+
- **UI Components**: 70%+
- **Hooks**: 80%+

### Run Coverage Report

```bash
npm test -- --coverage --collectCoverageFrom='lib/**/*.ts' --collectCoverageFrom='app/api/**/*.ts'
```

---

## Continuous Integration

### GitHub Actions

Add to `.github/workflows/test.yml`:

```yaml
name: Test Sponsorship System

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test -- --coverage
        env:
          USERBASE_KEY_ENCRYPTION_SECRET: ${{ secrets.TEST_ENCRYPTION_SECRET }}

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## Manual Testing Checklist

Beyond automated tests, manually verify:

### UI Flow
- [ ] Sponsor button appears on lite profiles
- [ ] Sponsor button hidden on own profile
- [ ] Sponsor button hidden on already-sponsored profiles
- [ ] Modal opens with correct user info
- [ ] Keychain popup appears
- [ ] Progress indicators work
- [ ] Success state shows
- [ ] Email received with all keys
- [ ] Badges show correctly on profile

### Error Cases
- [ ] Keychain not installed error
- [ ] Username already taken error
- [ ] Transaction failed error
- [ ] Network error handling
- [ ] Session expired handling

### Security
- [ ] Keys encrypted correctly
- [ ] Email contains all keys
- [ ] Resend backup works
- [ ] Cannot sponsor self
- [ ] Rate limiting works

---

## Debugging Tests

### Enable Debug Logging

```bash
DEBUG=* npm test
```

### View Test Output

```bash
npm test -- --verbose
```

### Run Single Test

```bash
npm test -- -t "should encrypt and decrypt"
```

---

## Known Limitations

1. **Blockchain Integration**: Tests don't actually broadcast to Hive blockchain (mock responses)
2. **Email Delivery**: Tests don't actually send emails (mock SMTP)
3. **Keychain Integration**: Tests don't actually call Keychain extension (mock window.hive_keychain)
4. **Database**: Some tests need Supabase mocks

---

## Future Test Additions

- [ ] Load testing (concurrent sponsorships)
- [ ] E2E tests with real blockchain (testnet)
- [ ] Visual regression tests (screenshots)
- [ ] Performance benchmarks
- [ ] Fuzz testing for encryption
- [ ] Penetration testing

---

## Questions?

For questions about testing:
- Check existing test files for examples
- See Jest documentation: https://jestjs.io/
- See Testing Library docs: https://testing-library.com/

🛹 **Happy Testing!**
