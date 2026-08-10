# Skatehive Scripts

This directory contains utility scripts for managing the Skatehive database operations.

## Directory Structure

```
scripts/
├── database/           # Database management scripts
│   ├── inspect-schema.js         # Inspect database table schemas
│   ├── smoke-userbase.js         # Userbase smoke test
│   └── snapshot-userbase.js      # Snapshot userbase tables
└── README.md          # This file
```

## Prerequisites

Before running any scripts, ensure you have:

1. **Environment configured**: `.env.local` file with database credentials
2. **Dependencies installed**: `pnpm install` (for Supabase client)
3. **Database access**: Supabase service role key permissions

## Database Scripts

### Inspect Schema

**File:** `database/inspect-schema.js`

**Purpose:** Inspects and displays current database table schemas for debugging.

**Usage:**

```bash
node scripts/database/inspect-schema.js
```

**Output:**

- Current table structure
- Column types and constraints
- Missing/extra columns analysis
- Schema compliance report

### Userbase Smoke Test

**File:** `database/smoke-userbase.js`

**Purpose:** Performs a basic write/read/delete cycle against the userbase tables.

**Usage:**

```bash
node scripts/database/smoke-userbase.js
```

**Required:**

- `DATABASE_URL` for direct Postgres access

### Userbase Snapshot

**File:** `database/snapshot-userbase.js`

**Purpose:** Dumps the current contents of userbase tables for debugging.

**Usage:**

```bash
node scripts/database/snapshot-userbase.js
```

**Required:**

- `DATABASE_URL` for direct Postgres access

## Environment Variables

All scripts require these environment variables in `.env.local`:

```env
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional - for enhanced debugging
NODE_ENV=development
```

## Common Issues & Solutions

### Database Connection Errors

```
❌ Error: Invalid API key
```

**Solution:** Check `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`

### Permission Errors

```
❌ insufficient_privilege
```

**Solution:** Ensure service role key has admin permissions

## Development Workflow

1. **Database Setup:**

   ```bash
   # Check current schema
   pnpm db:inspect
   # or: node scripts/index.js db:inspect
   ```

2. **Testing:**

```bash
# Run userbase smoke test
pnpm db:smoke-userbase

# Snapshot userbase tables
pnpm db:snapshot-userbase

# Reward claim pipeline
pnpm rewards:claim discover
pnpm rewards:claim dry-run --credential-source db --inactive-days 30
pnpm rewards:claim execute --credential-source db --inactive-days 30 --limit 50 --yes

# Show all available scripts
node scripts/index.js help
```

## Reward Claim Pipeline

**File:** `userbase/claim-rewards.ts`

**Purpose:** Discover inactive Hive-linked users who opted into the SkateHive curation trail, validate posting authority, and optionally execute `claim_reward_balance` with stored posting keys.

**Inactivity filter:**

- Defaults to 30 days and can be changed with `--inactive-days`
- Excludes recent userbase logins, sessions, profile changes, soft posts, and soft votes
- Rechecks recent on-chain posts/comments before both dry-run readiness and broadcast
- Requires a stored posting key and `trail_opt_out = false`

**Backup formats supported:**

- JSON attachments with `keys.active.private`
- TXT backups containing `Username:`, `Master Password:`, and/or `Active:`

**Safety defaults:**

- `discover` only queries DB
- `dry-run` never broadcasts
- `execute` requires `--yes`
- Active keys are not loaded when `--credential-source db` is used
- Reports never store private keys, only status, values, and txids

## Security Notes

- **Service role keys** have full database access - keep secure
- **Test thoroughly** in development before production changes

---

**Last Updated:** January 27, 2026
**Maintainer:** Skatehive Development Team
