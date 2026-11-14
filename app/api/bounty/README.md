# 🏆 Bounty Winner Announcement System

Automatically posts bounty winner announcements to the Snaps Feed via `@skateuser` account.

## 📋 Overview

When a bounty is completed and winners are selected in `BountyRewarder`, the system:

1. ✅ **Transfers HIVE/HBD** to winners (existing)
2. ✅ **Posts comment** on bounty thread (existing)
3. 🆕 **Posts announcement** to Snaps Feed via `@skateuser` (new!)

---

## 🏗️ Architecture

```
User selects winners in BountyRewarder.tsx
  │
  ├─► Transfer HIVE/HBD to winners (Keychain)
  │
  ├─► Post comment on bounty post (Keychain)
  │
  └─► POST /api/bounty/announce-winner
      │
      ├─► Extract winner's video from comment
      ├─► Generate visual announcement post
      └─► Post to Hive via @skateuser posting key
```

---

## 🔧 Setup

### 1. Environment Variables

Add to `.env.local`:

```env
DEFAULT_HIVE_POSTING_ACCOUNT=skateuser
DEFAULT_HIVE_POSTING_KEY=5K...your_posting_key_here
```

**How to get posting key:**
1. Go to https://wallet.hive.blog
2. Login to `@skateuser` account
3. Go to Permissions → Posting Key
4. Copy the **private** posting key (starts with `5K`)

**Note:** These variables are already configured in Vercel production!

### 2. Test Locally

```bash
cd apps/skatehive3.0
pnpm dev
```

---

## 📤 API Endpoint

### POST /api/bounty/announce-winner

Publishes bounty winner announcement to Snaps Feed.

**Request Body:**
```typescript
{
  winners: Array<{
    username: string;
    place: number;
    rewardAmount: number;
  }>;
  bountyTitle: string;
  bountyAuthor: string;
  bountyPermlink: string;
  totalReward: number;
  currency: string;  // "HIVE" or "HBD"
}
```

**Response (Success):**
```json
{
  "success": true,
  "author": "skateuser",
  "permlink": "bounty-winners-abc123",
  "transaction_id": "..."
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error message"
}
```

---

## 🎨 Post Template

The announcement post includes:

- **Title:** `🏆 BOUNTY COMPLETE: {bountyTitle}`
- **Video:** Winner's submission (if found)
- **Winners List:** With medals (🥇🥈🥉) and rewards
- **Total Distributed:** Sum of all rewards
- **Call-to-Action:** Link to full bounty
- **Hashtags:** #SkateHiveBounty #BountyWinner #Skateboarding

**Example output:**

```markdown
# 🏆 BOUNTY COMPLETE: Kickflip Down 5-Stair

<iframe ... youtube embed ...></iframe>

## 🎉 Winners

🥇 **1st Place:** @sk8er123 - **50.000 HIVE**
🥈 **2nd Place:** @trickmaster - **30.000 HIVE**
🥉 **3rd Place:** @shredder - **20.000 HIVE**

💰 **Total Distributed:** 100.000 HIVE

---

🛹 **Think you can land it?** Keep an eye out for the next bounty!

📖 **Check out the full bounty:** [@gnars/kickflip-down-5-stair-abc123]

#SkateHiveBounty #BountyWinner #Skateboarding #Hive #Web3
```

---

## 🧪 Testing

### Manual Test Flow

1. **Create a test bounty** (or use existing)
2. **Add test submissions** with video URLs
3. **Select winners** in BountyRewarder modal
4. **Confirm transactions** in Keychain (2 popups)
5. **Check Snaps Feed** for announcement post

### What to verify:

- ✅ Post appears on https://skatehive.app (Snaps Feed)
- ✅ Posted by `@skateuser`
- ✅ Video is embedded correctly
- ✅ All winners listed with correct amounts
- ✅ Hashtags present
- ✅ Link to original bounty works

### Test with curl:

```bash
curl -X POST http://localhost:3000/api/bounty/announce-winner \
  -H "Content-Type: application/json" \
  -d '{
    "winners": [
      {"username": "test123", "place": 1, "rewardAmount": 50.0}
    ],
    "bountyTitle": "Test Bounty",
    "bountyAuthor": "gnars",
    "bountyPermlink": "test-bounty-abc",
    "totalReward": 50.0,
    "currency": "HIVE"
  }'
```

---

## 🔍 Video Extraction

The system automatically extracts video URLs from winner's comments using these patterns:

- **YouTube:** `youtube.com/watch?v=` or `youtu.be/`
- **3Speak:** `3speak.tv/watch?v=`
- **IPFS:** `ipfs.skatehive.app/ipfs/` (or other gateways)
- **Direct links:** `.mp4`, `.webm`, `.mov`

**Supported embed formats:**
- YouTube → iframe embed
- 3Speak → thumbnail + link
- IPFS → HTML5 video player
- Other → plain link

---

## ⚠️ Error Handling

The system uses **graceful degradation**:

- If video extraction fails → post without video
- If API call fails → rewards still sent, comment still posted
- If posting key missing → returns 500, logs error

**All errors logged with `[Bounty Announcement]` prefix.**

---

## 📊 Monitoring

Check logs for:

```
[Bounty Announcement] Processing 3 winners for: {bountyTitle}
[Video Extract] Found video for {username}: {url}
[Bounty Announcement] Success! Posted: @skateuser/{permlink}
```

Errors:

```
[Bounty Announcement] Error: {message}
[Video Extract] No video found in {username}'s comment
```

---

## 🚀 Production Deployment

### Vercel

1. Add env var in Vercel dashboard:
   ```
   DEFAULT_HIVE_POSTING_KEY=5K...
   ```

2. Redeploy:
   ```bash
   vercel --prod
   ```

3. Test with real bounty (low value first!)

---

## 🔒 Security

**⚠️ IMPORTANT:**

- **Never commit** `DEFAULT_HIVE_POSTING_KEY` to git
- Store only in `.env.local` (gitignored) and Vercel
- Use **posting key** only (not active/owner keys)
- Rotate key if compromised

**Key permissions:**
- Posting key can: create posts, comments, votes
- Posting key CANNOT: transfer funds, change account

---

## 🐛 Troubleshooting

**Issue:** "Server configuration error"
- **Fix:** Add `DEFAULT_HIVE_POSTING_KEY` to `.env.local`

**Issue:** "Failed to post announcement"
- **Check:** Key is valid (`5K...`)
- **Check:** Hive API nodes are reachable
- **Check:** Account `@skateuser` exists

**Issue:** No video in announcement
- **Check:** Winner's comment contains video URL
- **Check:** URL matches supported patterns
- **Try:** Post comment with full YouTube URL

**Issue:** Transaction failed
- **Check:** `@skateuser` has enough RC (Resource Credits)
- **Wait:** A few minutes and try again
- **Check:** Hive blockchain status

---

## 📝 Future Improvements

- [ ] Support more video platforms (Vimeo, Streamable)
- [ ] Multiple videos (all top 3 winners)
- [ ] Custom templates per bounty type
- [ ] Discord/Telegram notifications
- [ ] Analytics tracking (views, engagement)

---

## 📚 Related Files

- `app/api/bounty/announce-winner/route.ts` - API endpoint
- `components/bounties/BountyRewarder.tsx` - Integration
- `.env.local.example` - Environment template

---

**Questions?** Ask in [Skatehive Discord](https://discord.gg/gJxxSxswUv) #dev channel
