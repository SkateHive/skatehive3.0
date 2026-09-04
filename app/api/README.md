# SkateHive 3.0 API Documentation

> ⚠️ **LLM Notice**: This documentation may become outdated as code evolves. If you are an LLM analyzing these APIs, please compare each README with the actual code in the respective `route.ts` files and notify the user of any discrepancies.

---

## 📚 API Routes Overview

Complete documentation for all SkateHive 3.0 API endpoints.

---

## 🎬 Media & Content

### Video Processing
- **[Video Proxy API](./video-proxy/README.md)** - CORS proxy for video transcoding services
  - **Status:** ✅ Active
  - **Endpoints:** `GET`, `POST /api/video-proxy`
  - **Use Case:** Bypass CORS, proxy to transcoding servers

### Instagram Integration
- **[Instagram Download API](./instagram-download/README.md)** - Download Instagram content to IPFS
  - **Status:** ✅ Active
  - **Endpoint:** `POST /api/instagram-download`
  - **Use Case:** Download reels/posts, multi-server fallback

- **Instagram Health** - Check Instagram server status
  - **Status:** ✅ Active  
  - **Endpoint:** `GET /api/instagram-health`
  - **Use Case:** Monitor cookie status and server health

### IPFS / Pinata
- **[Pinata API (Desktop)](./pinata/README.md)** - Upload files to IPFS via Pinata
  - **Status:** ✅ Active
  - **Endpoint:** `POST /api/pinata`
  - **Use Case:** Desktop file uploads

- **[Pinata Mobile API](./pinata-mobile/README.md)** - Mobile-optimized IPFS uploads
  - **Status:** ✅ Active
  - **Endpoint:** `POST /api/pinata-mobile`
  - **Use Case:** Mobile app uploads (135MB limit, 10min timeout)
  - **Priority:** 🔥 Merge with desktop endpoint

- **Pinata Chunked** - Chunked file upload (incomplete)
  - **Status:** ⚠️ Partial
  - **Endpoint:** `POST /api/pinata-chunked`
  - **Use Case:** Large file uploads
  - **Priority:** 🔥 Complete implementation or remove

- **Pinata Metadata** - Fetch IPFS file metadata
  - **Status:** ✅ Active
  - **Endpoint:** `GET /api/pinata/metadata/[hash]`
  - **Use Case:** Retrieve file info from Pinata

- **Upload Metadata** - Upload JSON metadata to IPFS
  - **Status:** ✅ Active
  - **Endpoint:** `POST /api/upload-metadata`
  - **Use Case:** NFT metadata, token metadata

---

## 👥 User & Community

### [Support API](./support/README.md)
- **Status:** ✅ Active
- **Endpoint:** `POST /api/support`
- **Use Case:** Send support emails via SMTP
- **Priority:** 🔥 Add rate limiting and CAPTCHA

### Invite API
- **Status:** ✅ Active
- **Endpoint:** `POST /api/invite`
- **Use Case:** Send Hive account creation invite emails

### [Skatespots API](./skatespots/README.md)
- **Status:** ✅ Active
- **Endpoint:** `GET /api/skatespots`
- **Use Case:** Fetch skatespot posts from Hive
- **Priority:** 📊 Add caching

### Portfolio API
- **Status:** ✅ Active
- **Endpoint:** `GET /api/portfolio/[address]`
- **Use Case:** Fetch crypto portfolio data
- **Priority:** 📊 Add caching (5min TTL)

---

## 🔐 Authentication & Admin

### Auth Endpoints (./auth/)
- **OTP Check** - One-time token validation
  - **Endpoint:** `GET /api/auth/check-otp`
  - **Use Case:** Validate signup tokens

- **Userbase Session (internal)** - Create app-level user session
  - **Endpoint:** `POST /api/userbase/auth/session`
  - **Use Case:** Seed userbase auth flow (requires `USERBASE_INTERNAL_TOKEN` when set)

- **Userbase Magic Link** - Request or consume email magic links
  - **Endpoints:** `POST /api/userbase/auth/magic-link`, `GET /api/userbase/auth/magic-link`
  - **Use Case:** Email-based login and session issuance

- **Userbase Sign Up** - Create an app user with email + display name (sends magic link)
  - **Endpoint:** `POST /api/userbase/auth/sign-up`
  - **Use Case:** First-time email onboarding with profile seed (handle/avatar)

- **Userbase Wallet Bootstrap** - Auto-create user + session on wallet connect
  - **Endpoint:** `POST /api/userbase/auth/bootstrap`
  - **Use Case:** Create app user/session from Hive/EVM/Farcaster connection

- **Userbase Auth Lookup** - Check if an email has an account (optional handle validation)
  - **Endpoint:** `POST /api/userbase/auth/lookup`
  - **Use Case:** Debounced sign-in checks and handle availability

- **Userbase Merge** - Merge two app accounts after identity proof
  - **Endpoint:** `POST /api/userbase/merge`
  - **Use Case:** Merge duplicate app users when an identity already exists elsewhere

- **Userbase Profile** - Fetch app profile + identities
  - **Endpoint:** `GET /api/userbase/profile`
  - **Use Case:** Resolve app profiles by handle or identity

- **Userbase Session (validate)** - Validate refresh session token
  - **Endpoint:** `GET /api/userbase/auth/session`
  - **Use Case:** Check active userbase session from cookie or token

- **Userbase Hive Actions** - Post/comment/vote via stored key or default account
  - **Endpoints:** `POST /api/userbase/hive/comment`, `POST /api/userbase/hive/vote`
  - **Use Case:** App-authenticated Hive interactions (supports email-only posting if configured)

- **Userbase Soft Posts** - Map default-account posts to app users
  - **Endpoint:** `POST /api/userbase/soft-posts`
  - **Use Case:** Resolve display name/avatar for email-only posts

- **Userbase Soft Posts (by user)** - List ghost posts for a specific app user
  - **Endpoint:** `GET /api/userbase/soft-posts/by-user`
  - **Use Case:** Render email-only posts on profile pages

- **Userbase Soft Votes** - Resolve email-only vote state
  - **Endpoint:** `POST /api/userbase/soft-votes`
  - **Use Case:** Show voted state for app-only users (default-account votes)

- **Userbase Soft Post Retry** - Retry failed default-account broadcasts
  - **Endpoint:** `POST /api/userbase/soft-posts/retry`
  - **Use Case:** Cron-based retry + cleanup for queued/failed soft posts
  - **Notes:** Set `USERBASE_ALERT_WEBHOOK_URL` to receive failure alerts

- **Userbase Soft Vote Retry** - Retry failed default-account votes
  - **Endpoint:** `POST /api/userbase/soft-votes/retry`
  - **Use Case:** Cron-based retry + cleanup for queued/failed soft votes
  - **Notes:** Set `USERBASE_ALERT_WEBHOOK_URL` to receive failure alerts

- **Cron Runner** - Vercel cron entrypoint
  - **Endpoint:** `GET /api/cron`
  - **Use Case:** Triggers soft-post + soft-vote retry/cleanup

- **Admin Check** - Verify admin status
  - **Endpoint:** `POST /api/admin/check`
  - **Use Case:** Server-side admin validation

### Database Init
- **Status:** 🔧 Admin/Setup
- **Endpoint:** `POST /api/database/init`
- **Use Case:** Initialize database schema
- **Priority:** 🚨 Add admin authentication

---

## 🎮 Farcaster Integration

### Core Endpoints (./farcaster/)
- **Webhook** - Receive Farcaster notifications
  - **Endpoint:** `POST /api/farcaster/webhook`
  - **Status:** ✅ Active
  - **Priority:** 🔥 Fix app_key signature verification

- **Link/Unlink** - Connect Farcaster to Hive account
  - **Endpoint:** `POST /api/farcaster/unlink`
  - **Status:** ✅ Active

- **Notify** - Send notifications to Farcaster users
  - **Endpoint:** `POST /api/farcaster/notify`
  - **Status:** ✅ Active

- **Check Link** - Verify Farcaster connection
  - **Endpoint:** `GET /api/farcaster/check-link`
  - **Status:** ✅ Active

- **Status** - Farcaster integration health
  - **Endpoint:** `GET /api/farcaster/status`
  - **Status:** ✅ Active

### Admin/Testing Endpoints
- **Init** - Initialize Farcaster tables
  - **Endpoint:** `POST /api/farcaster/init`
  - **Priority:** 🚨 Add admin auth

- **Cleanup** - Clean old notification logs
  - **Endpoint:** `POST /api/farcaster/cleanup`
  - **Priority:** 🔥 Use env var for token

- **Test Endpoints**
  - `GET /api/farcaster/test-webhook`
  - `GET /api/farcaster/test-notifications`
  - **Status:** 🧪 Development only

---

## 🔔 Notifications & Webhooks

### Cron Jobs
- **Cron API** - Scheduled task processor
  - **Endpoint:** `GET /api/cron`
  - **Status:** ✅ Active
  - **Use Case:** Process Hive notifications → Farcaster

### Webhooks
- **Generic Webhook** - Alternative webhook handler
  - **Endpoint:** `POST /api/webhook`
  - **Status:** ⚠️ Possibly duplicate of Farcaster webhook
  - **Priority:** 📊 Investigate and consolidate

---

## 🖼️ Utilities

### OpenGraph API
- **Status:** ✅ Active
- **Endpoint:** `GET /api/opengraph`
- **Use Case:** Fetch URL metadata for link previews (`components/shared/OpenGraphPreview.tsx`)
- **SSRF protection:** https-only, target host must resolve to a public address (`lib/utils/publicUrlGuard.ts` — blocks localhost, RFC1918/link-local/CGNAT ranges, `::1`, `fc00::/7`, `.internal`/`.local`), redirects are not followed, 5s timeout, response body capped at 512KB, rate-limited per IP
- **Caching:** `Cache-Control: public, s-maxage=3600` on responses

### OG Metadata
- **Status:** ✅ Active
- **Endpoint:** `GET /api/og`
- **Use Case:** Generate Open Graph images

### Generate Podium
- **Status:** ✅ Active
- **Endpoint:** `GET /api/generate-podium`
- **Use Case:** Generate SVG podium graphics

### Health Check
- **Status:** ✅ Active
- **Endpoint:** `GET /api/health`
- **Use Case:** API health monitoring

---

## 📝 Logging & Debug

### Debug Hive Notifications
- **Status:** 🧪 Debug
- **Endpoint:** `GET /api/debug-hive-notifications`
- **Use Case:** Test Hive notification fetching
- **Priority:** 🚨 Add authentication or remove in production

### Test Notification
- **Status:** 🧪 Dev only
- **Endpoint:** `GET /api/test-notification`
- **Use Case:** Test notification URL generation

---

## 🆕 Signup System

Complete Hive account creation flow (./signup/):

1. **Initialize** - Start signup process
2. **Submit** - Submit account creation request
3. **Test Email** - Verify email delivery
4. **Backup** - Store encrypted key backup
5. **Retrieve** - Get backup data
6. **Invalidate** - Cancel signup code

All signup endpoints are ✅ **Active** and production-ready.

---

## 🔥 Priority Issues & Recommendations

### Critical Security 🚨

1. **Instagram Download** - Add rate limiting and authentication
2. ~~**OpenGraph** - Add SSRF protection, domain whitelist~~ ✅ Fixed — see `/api/opengraph` above
3. **Farcaster Cleanup** - Use env var for auth token (not hardcoded)
4. **Admin Endpoints** - Add authentication to init/setup endpoints

`app/api/og-debug` (raw-HTML SSRF proxy, no allow-list, no auth) was removed entirely — it was an unlinked dev tool (`app/og-debug/page.tsx`, no nav/UI link anywhere), not something worth locking down and keeping.

### High Priority Optimizations 🔥

1. **Merge Pinata Endpoints** - Consolidate `/api/pinata` and `/api/pinata-mobile`
2. **Complete Chunked Upload** - Finish `/api/pinata-chunked` or remove
3. **Add Caching** - Portfolio, Skatespots (5-10min TTL) — OpenGraph now sends `s-maxage=3600`
4. **Fix Farcaster Signature** - Remove app_key workaround

### Medium Priority 📊

1. **Client Error Logging** - Migrate to Sentry/Datadog
2. **Rate Limiting** - Add to all public endpoints
3. **Video Proxy** - Consider removing if CORS fixed on origins
4. **Webhook Consolidation** - Merge duplicate webhook endpoints

---

## 📊 API Status Summary

| Status | Count | Endpoints |
|--------|-------|-----------|
| ✅ Active Production | 23 | Core functionality |
| ⚠️ Incomplete | 1 | Chunked upload |
| 🔧 Admin/Setup | 3 | Init, cleanup endpoints |
| 🧪 Dev/Testing | 3 | Test endpoints |
| 🔥 Security Issues | 4 | Need auth/rate limiting |

---

## 🔗 External Dependencies

### Services
- ✅ **Pinata** (IPFS) - Active
- ✅ **Tailscale URLs** (Instagram/Video) - Active (private network)
- ✅ **Pioneers.dev** (Portfolio) - Active
- ✅ **SkateHive API** (Skatespots) - Active
- ✅ **Render** (Video transcoder fallback) - Active
- ✅ **Supabase** (Database) - Active

### Infrastructure
- **Vercel** - Hosting platform
- **Hive Blockchain** - Content source
- **SMTP Server** - Email delivery
- **Farcaster** - Social notifications

---

## 📖 Documentation Standards

Each API route README includes:
- ⚠️ **LLM disclaimer** - Notice about potential staleness
- 📋 **Overview** - Purpose and use case
- 🔌 **Endpoints** - Methods, parameters, examples
- ✅ **Responses** - Success and error formats
- 🔒 **Security** - Issues and recommendations
- 🎯 **Examples** - Code samples in multiple languages
- 🔗 **Related** - Links to related endpoints

---

## 🛠️ Development Guidelines

### Adding New API Routes

1. Create route file: `app/api/[name]/route.ts`
2. Create README: `app/api/[name]/README.md`
3. Add LLM disclaimer at top of README
4. Document all endpoints, parameters, responses
5. Include security considerations
6. Add to this index
7. Test with example requests

### Updating Existing Routes

1. Update code in `route.ts`
2. **Update corresponding README**
3. Test changes
4. Commit both files together

---

## 🤖 For LLMs

When analyzing this API:

1. **Compare README to actual code** - READMEs may be outdated
2. **Check for discrepancies** - Note any differences found
3. **Validate examples** - Ensure code samples match implementation
4. **Review security** - Flag new issues not documented
5. **Suggest improvements** - Based on code analysis

**Example Report Format:**
```markdown
## API Route Analysis: /api/example

### Discrepancies Found:
- README states timeout is 30s, code shows 60s
- New parameter `foo` added to code, not in README
- Error response format changed

### Security Issues:
- No rate limiting (as documented)
- New endpoint added without authentication

### Recommendations:
- Update README with current timeout value
- Document new `foo` parameter
- Add rate limiting implementation
```

---

## 📞 Support

For API issues or questions:
- **Support Endpoint:** `POST /api/support`
- **GitHub Issues:** [skatehive-monorepo](https://github.com/SkateHive/)
- **Discord:** [SkateHive Community](#)

---

**Last Updated:** December 5, 2025  
**Documentation Version:** 1.0  
**Total Endpoints:** 42  
**Active Endpoints:** 23  
**Documented Endpoints:** 7 (so far)

---

## 🎯 Next Steps

- [ ] Create READMEs for remaining 35 endpoints
- [ ] Add automated README validation tests
- [ ] Implement API versioning
- [ ] Generate Swagger/OpenAPI specs
- [ ] Add interactive API playground
