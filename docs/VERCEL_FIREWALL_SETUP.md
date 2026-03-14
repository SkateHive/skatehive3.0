# Vercel Firewall Setup - Block Bot Traffic

**Last updated:** 2026-03-13

---

## Problem

60% of traffic is from Singapore/China bots that:
- Waste bandwidth and analytics quota
- Don't contribute to real engagement
- Can't be blocked via user-agent (they fake Chrome/Safari)

**Current traffic breakdown:**
- 🚨 Singapore: 298 sessions (41.6%)
- 🚨 China: 134 sessions (18.7%)
- 🇧🇷 Brazil: 145 sessions (20.2%)
- 🇺🇸 USA: 55 sessions (7.7%)

---

## Solution: Vercel Firewall (IP-based)

**Why IP-based blocking works:**
- Bots can fake user-agent but not source IP
- Legitimate users from SG/CN are rare for SkateHive
- Won't block Googlebot (different IP ranges)

---

## Setup Instructions

### 1. Access Vercel Firewall

1. Go to: https://vercel.com/sktbrd-projects/skatehive/settings/firewall
2. Click **"Create Firewall Rule"**

### 2. Create Country Block Rule

**Rule name:** `Block Singapore/China Bots`

**Conditions:**
```
Country is Singapore OR Country is China
```

**Action:** `Deny`

**Apply to:**
- [x] Production
- [x] Preview
- [ ] Development (optional)

### 3. Add Bypass for Legitimate Crawlers (Optional)

If you want to be extra safe and never block search engines:

**Rule name:** `Allow Search Engine Crawlers`

**Conditions:**
```
User-Agent contains "Googlebot"
OR User-Agent contains "Bingbot"
OR User-Agent contains "baiduspider"
```

**Action:** `Allow`

**Priority:** 1 (higher than block rule)

---

## Alternative: Vercel CLI (Programmatic)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Add firewall rule
vercel firewall add \
  --name "Block Singapore/China" \
  --conditions "geo.country == 'SG' || geo.country == 'CN'" \
  --action deny

# Verify
vercel firewall ls
```

---

## Expected Impact

**Before:**
- 716 total sessions
- 432 bot sessions (60.3%)
- 284 real sessions (39.7%)

**After:**
- ~284 total sessions (real users only)
- 0 bot sessions from SG/CN
- Analytics quota saved: ~60%

---

## Monitoring

**Check if it's working:**

1. Run analytics script:
   ```bash
   cd ~/.openclaw/workspace-skate-dev
   python3 << 'EOF'
   from google.analytics.data_v1beta import BetaAnalyticsDataClient
   from google.analytics.data_v1beta.types import RunReportRequest, DateRange, Dimension, Metric
   from google.oauth2 import service_account
   
   SA_FILE = '~/.openclaw/.env.google-sa.json'
   PROPERTY_ID = '527345741'
   
   creds = service_account.Credentials.from_service_account_file(SA_FILE)
   client = BetaAnalyticsDataClient(credentials=creds)
   
   request = RunReportRequest(
       property=f'properties/{PROPERTY_ID}',
       date_ranges=[DateRange(start_date='7daysAgo', end_date='today')],
       dimensions=[Dimension(name='country')],
       metrics=[Metric(name='sessions')],
       limit=10,
   )
   
   response = client.run_report(request)
   
   sg_cn = 0
   for row in response.rows:
       country = row.dimension_values[0].value
       sessions = int(row.metric_values[0].value)
       print(f"{country}: {sessions}")
       if country in ['Singapore', 'China']:
           sg_cn += sessions
   
   print(f"\nSG/CN traffic: {sg_cn} sessions")
   EOF
   ```

2. Expected result after 24h:
   - Singapore: 0 sessions ✅
   - China: 0 sessions ✅

---

## Rollback Plan

If legitimate users are blocked:

1. Go to Firewall settings
2. Click **"Delete Rule"** on the country block
3. Traffic resumes immediately

**Note:** You can always add exceptions for specific IPs if needed.

---

## Cost

**Vercel Firewall:**
- Free on Pro plan (included)
- Costs nothing extra
- Unlimited rules

---

## Future Improvements

If bot traffic returns from other countries:

1. **Cloudflare** (more advanced)
   - Better bot detection
   - Challenge pages (CAPTCHA)
   - Rate limiting per IP

2. **Cloudflare Workers** (custom logic)
   - JavaScript-based filtering
   - More flexible than Vercel

**For now:** Vercel Firewall is enough and doesn't add complexity.

---

_Document created during indexing issue resolution (2026-03-13)_
