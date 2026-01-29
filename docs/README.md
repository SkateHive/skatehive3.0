# Skatehive Documentation

Welcome to the Skatehive documentation! This folder contains technical documentation, testing guides, and status reports for the Skatehive platform.

---

## Userbase Multi-Identity Authentication System

The core authentication system that powers Skatehive's flexible login options.

### Start Here

1. **[USERBASE_STATUS_JAN2026.md](./USERBASE_STATUS_JAN2026.md)** 📊
   - **READ THIS FIRST** - Current status, what's implemented, what's ready
   - Production readiness checklist
   - Quick overview of all features
   - Performance metrics and deployment guide

2. **[USERBASE_MULTI_IDENTITY_AUTH.md](./USERBASE_MULTI_IDENTITY_AUTH.md)** 🏗️
   - **Main technical documentation** - comprehensive architecture guide
   - Authentication flows (Email, Hive, EVM, Farcaster)
   - Identity linking system
   - API reference with request/response examples
   - Database schema and indexes
   - Security considerations
   - Troubleshooting guide

3. **[TESTING_USERBASE_AUTH.md](./TESTING_USERBASE_AUTH.md)** ✅
   - **Testing guide** - 14 test scenarios
   - Step-by-step testing instructions
   - Expected results for each test
   - Bug report template
   - Testing checklist

---

## Soft Posts System

How email-only users can post to Hive without managing keys.

**[USERBASE_SOFT_POSTS.md](./USERBASE_SOFT_POSTS.md)** 📝
- Soft posts architecture
- Overlay system for displaying real authors
- Hook implementation details
- API endpoints
- Database schema
- Troubleshooting

**[HANDOFF_SOFT_POSTS_JAN2026.md](./HANDOFF_SOFT_POSTS_JAN2026.md)** 🔄
- Development handoff notes
- Recent changes and cleanup
- Code patterns

---

## Portuguese Documentation

**[TESTING_USERBASE_AUTH_PT-BR.md](./TESTING_USERBASE_AUTH_PT-BR.md)** 🇧🇷
- Testing guide in Portuguese
- Same test scenarios as English version

---

## Quick Navigation

### I want to...

**...understand how authentication works**
→ Start with [USERBASE_STATUS_JAN2026.md](./USERBASE_STATUS_JAN2026.md), then read [USERBASE_MULTI_IDENTITY_AUTH.md](./USERBASE_MULTI_IDENTITY_AUTH.md)

**...test the authentication system**
→ Follow [TESTING_USERBASE_AUTH.md](./TESTING_USERBASE_AUTH.md)

**...implement a new authentication method**
→ Read [USERBASE_MULTI_IDENTITY_AUTH.md](./USERBASE_MULTI_IDENTITY_AUTH.md) § API Reference and § Authentication Flows

**...understand soft posts**
→ Read [USERBASE_SOFT_POSTS.md](./USERBASE_SOFT_POSTS.md)

**...deploy to production**
→ Check [USERBASE_STATUS_JAN2026.md](./USERBASE_STATUS_JAN2026.md) § Deployment Checklist

**...troubleshoot an issue**
→ Check [USERBASE_MULTI_IDENTITY_AUTH.md](./USERBASE_MULTI_IDENTITY_AUTH.md) § Troubleshooting or [USERBASE_STATUS_JAN2026.md](./USERBASE_STATUS_JAN2026.md) § Support & Troubleshooting

---

## Documentation Structure

```
docs/
├── README.md (this file)
│
├── Userbase Authentication System
│   ├── USERBASE_STATUS_JAN2026.md          ← Status report & deployment guide
│   ├── USERBASE_MULTI_IDENTITY_AUTH.md     ← Main technical docs
│   ├── TESTING_USERBASE_AUTH.md            ← Testing guide (EN)
│   └── TESTING_USERBASE_AUTH_PT-BR.md      ← Testing guide (PT-BR)
│
└── Soft Posts System
    ├── USERBASE_SOFT_POSTS.md              ← Soft posts architecture
    └── HANDOFF_SOFT_POSTS_JAN2026.md       ← Development handoff
```

---

## Key Concepts

### Userbase
The authentication and user profile system that allows flexible login options (email, Hive, wallet, Farcaster).

### Multi-Identity
Users can link multiple identities (Hive account, EVM wallets, Farcaster profile) to a single app account.

### Profile Modes
Different views of a user's profile based on their linked identities:
- **Hive Mode** - Blockchain posts, followers, Hive Power
- **Zora Mode** - NFTs, tokens, collections
- **Farcaster Mode** - Social graph, casts
- **App Account Mode** - Display name, bio, soft posts

### Soft Posts
A system that allows email-only users to post content to Hive using a shared account (`skateuser`) with an overlay system that displays their actual profile.

---

## Contributing to Documentation

When updating documentation:

1. **Update all related docs** - If you change a flow, update both technical docs and testing guides
2. **Include dates** - Mark when sections were last updated
3. **Add examples** - Code snippets and request/response examples are helpful
4. **Link between docs** - Reference other docs when relevant
5. **Keep status current** - Update USERBASE_STATUS_JAN2026.md when features change

---

## Questions?

- **GitHub Issues:** [skatehive/skatehive3.0/issues](https://github.com/skatehive/skatehive3.0/issues)
- **Discord:** Tag @vlad or @core-team
- **Email:** [Contact form on skatehive.app]

---

**Last updated:** January 29, 2026
🛹 Happy coding!
