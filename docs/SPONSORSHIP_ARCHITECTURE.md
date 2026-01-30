# Sponsorship System - Architecture Overview

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
└─────────────────────────────────────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
┌──────────────┐       ┌──────────────┐        ┌──────────────┐
│SponsorButton │       │Sponsorship   │        │Hive          │
│(Feed/Profile)│──────▶│Modal         │        │SponsorshipInfo│
└──────────────┘       └──────────────┘        └──────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│ /sponsorships/create     │  Create sponsorship record          │
│ /sponsorships/process    │  Process after blockchain          │
│ /sponsorships/eligible   │  Check if user can be sponsored    │
│ /sponsorships/my-info    │  Get user's sponsorship status     │
│ /sponsorships/info       │  Get public sponsorship info       │
│ /keys/hive-info          │  Get key metadata                  │
│ /keys/resend-backup      │  Resend key backup email           │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌──────────────┐       ┌──────────────┐        ┌──────────────┐
│Key Generation│       │Encryption    │        │Email Service │
│(DHive)       │       │(AES-256-GCM) │        │(Resend)      │
└──────────────┘       └──────────────┘        └──────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│ userbase_sponsorships    │  Track sponsorship records          │
│ userbase_hive_keys       │  Store encrypted posting keys       │
│ userbase_identities      │  Hive account associations          │
│ userbase_users           │  User accounts                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      HIVE BLOCKCHAIN                            │
├─────────────────────────────────────────────────────────────────┤
│ account_create operation │  Create new Hive account            │
│ Transaction verification │  Verify account creation            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Relationships

### 1. User Flow (Happy Path)

```
User clicks "Sponsor" button
         │
         ▼
SponsorshipModal opens
         │
         ▼
Generate Hive keys (client-side)
         │
         ▼
Create sponsorship record (API)
         │
         ▼
Build account_create operation
         │
         ▼
Request Keychain signature (browser extension)
         │
         ▼
Broadcast to Hive blockchain
         │
         ▼
Verify transaction (API)
         │
         ▼
Encrypt posting key (API)
         │
         ▼
Store in database
         │
         ▼
Send email with all keys
         │
         ▼
Update sponsorship status to "completed"
         │
         ▼
Success! User now has Hive account
```

---

## Data Flow

### Sponsorship Creation

```
┌──────────┐     POST /create      ┌─────────────┐
│ Frontend │ ──────────────────────▶│ API         │
└──────────┘                        └─────────────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │ Validation  │
                                    └─────────────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │ Database    │
                                    │ INSERT      │
                                    └─────────────┘
                                           │
                                           ▼
                            Return sponsorship_id
```

### Key Processing

```
┌──────────┐  POST /process + keys  ┌─────────────┐
│ Frontend │ ──────────────────────▶│ API         │
└──────────┘                        └─────────────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │ Verify TX   │
                                    │ on Hive     │
                                    └─────────────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │ Encrypt     │
                                    │ posting key │
                                    └─────────────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │ Store in DB │
                                    └─────────────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │ Send Email  │
                                    └─────────────┘
```

---

## Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1: Frontend                                               │
├─────────────────────────────────────────────────────────────────┤
│ • Input validation                                              │
│ • Session check                                                 │
│ • Keys generated in memory only (never persisted client-side)   │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Layer 2: API                                                    │
├─────────────────────────────────────────────────────────────────┤
│ • Session authentication                                        │
│ • Request validation                                            │
│ • Rate limiting (⚠️ TODO)                                       │
│ • CSRF protection (⚠️ TODO)                                     │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Layer 3: Encryption                                             │
├─────────────────────────────────────────────────────────────────┤
│ • AES-256-GCM encryption                                        │
│ • User-specific encryption keys (PBKDF2)                        │
│ • Authentication tags (tamper detection)                        │
│ • Cross-user isolation                                          │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Layer 4: Database                                               │
├─────────────────────────────────────────────────────────────────┤
│ • Row-level security (RLS)                                      │
│ • User can only see own keys                                    │
│ • Service role for admin operations                             │
│ • Encrypted data at rest (Supabase)                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Components Map

### Frontend (React)
```
components/userbase/
├── SponsorButton.tsx          # Trigger sponsorship
├── SponsorshipModal.tsx       # Main workflow modal
└── HiveSponsorshipInfo.tsx    # Display status/info

hooks/
├── useSponsorshipStatus.ts    # Check if lite/sponsored
└── useViewerHiveIdentity.ts   # Get viewer's Hive username
```

### Backend (API Routes)
```
app/api/userbase/
├── sponsorships/
│   ├── create/route.ts        # Create sponsorship record
│   ├── process/route.ts       # Process after blockchain
│   ├── eligible/[user_id]/route.ts  # Check eligibility
│   ├── my-info/route.ts       # Get user's status
│   └── info/[user_id]/route.ts      # Get public info
└── keys/
    ├── hive-info/route.ts     # Get key metadata
    └── resend-backup/route.ts # Resend key backup
```

### Libraries (Business Logic)
```
lib/
├── hive/
│   ├── keyGeneration.ts       # Generate Hive keys
│   └── accountCreation.ts     # Build account_create op
├── userbase/
│   ├── encryption.ts          # AES-256-GCM encryption
│   ├── keyManagement.ts       # Store/retrieve keys
│   ├── postingMethod.ts       # Detect posting method
│   └── postWithEncryptedKey.ts # Example usage
└── email/
    ├── sendSponsorshipEmail.ts # Send key backup
    └── sponsorshipTemplate.ts  # Email template
```

### Database
```
sql/migrations/
├── 0015_userbase_sponsorships.sql     # Sponsorship tracking
└── 0015_userbase_sponsorships_rls.sql # Security policies
```

---

## Integration Points

### 1. Snap Component (Feed)
```typescript
// components/homepage/Snap.tsx
import SponsorButton from "@/components/userbase/SponsorButton";
import SponsorshipModal from "@/components/userbase/SponsorshipModal";

// Shows sponsor button if:
// - Post author is lite account
// - Viewer has Hive account
// - Not viewing own post
```

### 2. Profile Component
```typescript
// Profile page components
import HiveSponsorshipInfo from "@/components/userbase/HiveSponsorshipInfo";

// Shows:
// - Lite account badge
// - Sponsor button (for others viewing)
// - Sponsorship info (if sponsored)
// - Key management (if has keys)
```

### 3. Post Creation
```typescript
// When creating a post
import { getPostingMethod } from "@/lib/userbase/postingMethod";

// Determines method:
// - hive_account: Use encrypted key
// - keychain_signing: Prompt Keychain
// - soft_post: Use shared account
```

---

## External Dependencies

| Service | Purpose | Required? |
|---------|---------|-----------|
| Hive Keychain | Sign transactions | ✅ Yes |
| Hive API Nodes | Blockchain interaction | ✅ Yes |
| Resend.com | Email delivery | ✅ Yes |
| Supabase | Database & auth | ✅ Yes |

---

## Environment Variables Required

```bash
# Encryption
USERBASE_KEY_ENCRYPTION_SECRET="your-secret-key-here"

# Email
RESEND_API_KEY="re_xxxxx"
SPONSORSHIP_EMAIL_FROM="noreply@skatehive.app"

# Database
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJxxx..."
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJxxx..."
```

---

## Performance Considerations

### Bottlenecks
1. **Hive blockchain** - 3 second block time
2. **Email delivery** - ~1-2 seconds
3. **Encryption/decryption** - Negligible (< 10ms)
4. **Database queries** - Fast with indexes

### Optimization
- ✅ Indexes on frequently queried columns
- ✅ Multi-node fallback for Hive API
- ✅ Async email delivery (doesn't block)
- ⏳ Rate limiting (prevents abuse)

---

*This document provides a high-level overview of the sponsorship system architecture. For implementation details, see the code files directly.*
