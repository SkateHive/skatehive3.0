# Skatehive — IPFS & Image Upload Architecture

> Reference for agents and developers. Covers every upload path, display optimization strategy, and Pinata feature integrations.

---

## Table of Contents

1. [Storage Backends Overview](#1-storage-backends-overview)
2. [Pinata / IPFS Upload Paths](#2-pinata--ipfs-upload-paths)
3. [Hive Image Service Upload](#3-hive-image-service-upload)
4. [Pinata Groups](#4-pinata-groups)
5. [Keyvalue Metadata Standard](#5-keyvalue-metadata-standard)
6. [Image Display Optimization](#6-image-display-optimization)
7. [Pinata Hot Swaps (Profile Picture Versioning)](#7-pinata-hot-swaps-profile-picture-versioning)
8. [Gateway Analytics](#8-gateway-analytics)
9. [Webhooks (Enterprise Only)](#9-webhooks-enterprise-only)
10. [Environment Variables](#10-environment-variables)
11. [Decision Guide: Which Backend to Use?](#11-decision-guide-which-backend-to-use)

---

## 1. Storage Backends Overview

| Backend | Used For | Max Size | Permanent? | Public? |
|---|---|---|---|---|
| **Pinata / IPFS** | Videos, post images, thumbnails, all compose content | 150 MB | ✅ Forever | ✅ Yes |
| **Hive Images** (`images.hive.blog`) | Profile avatars, cover photos | 15 MB | ⚠️ Centralized | ✅ Yes |

**Key principle:** IPFS is preferred for content permanence. Hive Images is used for profile pictures because it requires a Hive cryptographic signature (anti-spam), but all post content goes to IPFS.

**Gateway:** All IPFS content is served through `ipfs.skatehive.app` (custom Pinata gateway, configured via `NEXT_PUBLIC_IPFS_GATEWAY`).

---

## 2. Pinata / IPFS Upload Paths

There are three upload paths, all ultimately landing on Pinata's API. They are selected automatically based on file size.

### Path A — Server Proxy (`/api/pinata`)

For files **≤ 4 MB**.

```
Client → POST /api/pinata → Pinata API → returns IpfsHash
```

- Edge Runtime (no Vercel body size limit)
- Rate limited per IP
- Adds `source`, `creator`, `fileType`, `groupId` server-side
- File: `app/api/pinata/route.ts`

### Path B — Direct JWT Upload (client → Pinata)

For files **> 4 MB**, or when Path A returns 413.

```
Client → GET /api/pinata/signed-url → get temp JWT
Client → POST https://api.pinata.cloud/pinning/pinFileToIPFS (with temp JWT)
```

- Bypasses Vercel entirely — no 4.5 MB body limit
- Progress tracking via XHR `upload.progress` events
- Temp JWT is single-use, 30-minute expiry
- Client sets the metadata/keyvalues directly
- Files: `app/api/pinata/signed-url/route.ts`, `lib/utils/ipfsUpload.ts`

### Path C — composeUtils Direct (`uploadToIpfs`)

Used by the markdown editor and image compressor hook.

```
Client → if ≤ 4MB: POST /api/pinata
         if > 4MB: GET /api/pinata/signed-url → POST Pinata directly
```

- File: `lib/markdown/composeUtils.ts` — `uploadToIpfs(blob, fileName)`
- Returns a gateway URL string (not a full result object)
- Appends file extension to the IPFS URL automatically

### Which function to call from components

```typescript
// General-purpose (videos, large files, with progress tracking):
import { uploadToIpfsSmart } from "@/lib/utils/ipfsUpload";
const result = await uploadToIpfsSmart(file, {
  fileName: "kickflip.mp4",
  creator: hiveUsername,
  onProgress: (pct) => setProgress(pct),
  metadata: { post_permlink: "my-post" },
});
// result.url = "https://ipfs.skatehive.app/ipfs/Qm..."
// result.IpfsHash = "Qm..."

// Video upload (wraps uploadToIpfsSmart with device info):
import { uploadToIPFS } from "@/lib/utils/videoUpload";
const result = await uploadToIPFS(file, hiveUsername, undefined, onProgress);

// Markdown editor images (returns URL string directly):
import { uploadToIpfs } from "@/lib/markdown/composeUtils";
const url = await uploadToIpfs(blob, "image.jpg");
```

### Mobile / Large Video Route

For the mobile app (or files up to 135 MB):

```
POST /api/pinata-mobile
```

- 10-minute timeout, 135 MB limit
- File: `app/api/pinata-mobile/route.ts`

---

## 3. Hive Image Service Upload

Used exclusively for **profile avatars and cover photos**.

### How it works

Hive Images requires a cryptographic signature to upload. This prevents spam.

```
1. Read file → SHA256 hash of file bytes
2. Sign hash with HIVE_POSTING_KEY (server-side)  →  signature string
3. XHR upload to:  https://images.hive.blog/{APP_ACCOUNT}/{signature}
4. Returns:  { url: "https://images.hive.blog/..." }
```

### Functions

```typescript
// lib/utils/imageUpload.ts
import { getFileSignature, uploadImage } from "@/lib/utils/imageUpload";

const signature = await getFileSignature(file);
const url = await uploadImage(file, signature, index, setUploadProgress);

// With retry logic:
import { uploadToHiveImagesWithRetry } from "@/lib/utils/imageUpload";
const result = await uploadToHiveImagesWithRetry(imageDataUrl, "avatar.jpg");
// result.url = "https://images.hive.blog/..."
```

### Server route fallback

```
POST /api/upload-image
```

Used if the direct client XHR fails. Takes `file` + `signature`, proxies to Hive Images.

### Display

Hive avatars are served via:

```
https://images.hive.blog/u/{username}/avatar/small   (64×64)
https://images.hive.blog/u/{username}/avatar/medium  (128×128)
https://images.hive.blog/u/{username}/avatar/large   (256×256)
```

```typescript
import { optimizeAvatarUrl } from "@/lib/utils/imageOptimize";
const url = optimizeAvatarUrl("xvlad", "sm"); // → images.hive.blog/u/xvlad/avatar/small
```

---

## 4. Pinata Groups

Files are automatically assigned to groups at upload time based on MIME type.

| Group | Env Var | MIME Types | Content |
|---|---|---|---|
| `skatehive-videos` | `PINATA_GROUP_VIDEOS` | `video/*` | All uploaded videos |
| `skatehive-images` | `PINATA_GROUP_IMAGES` | `image/*`, other | Post images, thumbnails |
| `skatehive-avatars` | `PINATA_GROUP_AVATARS` | — | Profile pictures (manual) |

### Setup (run once)

```bash
npx tsx scripts/setup-pinata-groups.ts
```

This creates the three groups in Pinata and prints the group IDs. Copy them to `.env.local` and Vercel dashboard.

### How groups are assigned

```typescript
// lib/pinata/groups.ts
import { groupIdForMimeType } from "@/lib/pinata/groups";

const groupId = groupIdForMimeType("video/mp4"); // → PINATA_GROUP_VIDEOS value
const groupId = groupIdForMimeType("image/jpeg"); // → PINATA_GROUP_IMAGES value
```

Groups are passed via `pinataOptions.groupId` in the upload FormData. If the env var isn't set, the file uploads without a group (no error, just unorganized).

---

## 5. Keyvalue Metadata Standard

Every IPFS upload must include these keyvalues for searchability and attribution.

### Standard keyvalues

| Key | Value | Set by |
|---|---|---|
| `source` | `"webapp"` | All paths (mobile app will set `"mobileapp"`) |
| `creator` | Hive username or `"anonymous"` | All paths |
| `fileType` | MIME type string, e.g. `"video/mp4"` | All paths |
| `uploadDate` | ISO 8601 timestamp | All paths |
| `app` | `"skatehive"` | composeUtils path |
| `type` | `"video"` \| `"image"` \| `"file"` | composeUtils path |
| `size` | File size in bytes as string | composeUtils path |

### Optional keyvalues (add when available)

| Key | Value | Notes |
|---|---|---|
| `post_permlink` | Hive post permlink | Link file to a specific post |
| `platform` | `"web"` \| `"mobile"` | Device category |
| `deviceInfo` | e.g. `"desktop/macOS/Chrome"` | From `getDetailedDeviceInfo()` |
| `thumbnailUrl` | IPFS URL of video thumbnail | Video uploads only |

### Querying files by keyvalue

```typescript
// Via /api/pinata/metadata/[hash] — returns a single file's metadata
const res = await fetch(`/api/pinata/metadata/${cid}`);
// { name, keyvalues, cid, size, createdAt }

// Via Pinata API directly (server-side)
const res = await fetch(
  `https://api.pinata.cloud/data/pinList?metadata[keyvalues]=${JSON.stringify({
    creator: { value: "xvlad", op: "eq" },
  })}&pageLimit=100`,
  { headers: { Authorization: `Bearer ${PINATA_JWT}` } }
);
```

---

## 6. Image Display Optimization

All image URLs go through `optimizeImageUrl()` before being rendered. The strategy differs by source.

### IPFS images → Pinata `img-*` query params

IPFS images are served from `ipfs.skatehive.app` with Pinata's native edge optimization. **Do not route IPFS images through the Hive proxy** — it was a known bug (now fixed) that caused double-proxying.

```typescript
// lib/utils/imageOptimize.ts
import { optimizeImageUrl, IMAGE_SIZES } from "@/lib/utils/imageOptimize";

// Feed card thumbnail (640×360, cover crop, WebP)
optimizeImageUrl(ipfsUrl, 640, 360)
// → https://ipfs.skatehive.app/ipfs/{CID}?img-width=640&img-height=360&img-fit=cover&img-format=webp&img-quality=75&img-onerror=redirect

// Full-width inline image (768px wide, scale-down)
optimizeImageUrl(ipfsUrl, 768, 0)
// → https://ipfs.skatehive.app/ipfs/{CID}?img-width=768&img-fit=scale-down&img-format=webp&img-quality=75&img-onerror=redirect

// Small avatar (64×64, cover crop)
optimizeImageUrl(ipfsUrl, 64, 64)
// → https://ipfs.skatehive.app/ipfs/{CID}?img-width=64&img-height=64&img-fit=cover&img-format=webp&img-quality=75&img-onerror=redirect
```

**Pinata `img-*` param reference:**

| Param | Effect | Used values |
|---|---|---|
| `img-width` | Resize to target width (px) | From `IMAGE_SIZES` presets |
| `img-height` | Resize to target height (px) | From `IMAGE_SIZES` presets |
| `img-fit` | `cover` (both dims) or `scale-down` (width only) | Auto-selected |
| `img-format` | Convert to `webp` | Always `webp` |
| `img-quality` | Compression, 1–100 | `75` |
| `img-onerror` | `redirect` = fall back to original on error | Always set |

**GIFs are never optimized** (img-format=webp would strip animation).

### Standard dimension presets

```typescript
IMAGE_SIZES.FEED_CARD     = { w: 640,  h: 360 }  // Feed card thumbnails
IMAGE_SIZES.SIDEBAR_THUMB = { w: 320,  h: 180 }  // Sidebar thumbnails
IMAGE_SIZES.HERO          = { w: 1280, h: 720 }  // Full-width hero images
IMAGE_SIZES.INLINE        = { w: 768,  h: 0   }  // Markdown inline images
IMAGE_SIZES.AVATAR_SM     = { w: 64,   h: 64  }  // Small avatar
IMAGE_SIZES.AVATAR_LG     = { w: 128,  h: 128 }  // Large avatar
```

### Hive-hosted images → Hive proxy resize

```
https://images.hive.blog/{W}x{H}/{original_url}
```

The Hive proxy resizes on the edge and serves WebP when the browser supports it.

### External images → Hive proxy

Same `images.hive.blog/{W}x{H}/` pattern applied to external URLs.

### Raw IPFS URL (no optimization)

```typescript
import { ipfsGatewayUrl } from "@/lib/utils/imageOptimize";
const url = ipfsGatewayUrl("Qm...");
// → https://ipfs.skatehive.app/ipfs/Qm...
```

Use this only when you explicitly want the raw file (e.g., for video `src`, download links, or when passing to a video player).

---

## 7. Pinata Hot Swaps (Profile Picture Versioning)

Hot Swaps let you redirect one CID to another on `ipfs.skatehive.app` without changing any stored URLs. Perfect for profile picture updates — all existing Hive posts that reference the old CID continue to work on other IPFS gateways, but the Skatehive gateway transparently serves the new version.

### Prerequisites

Install the Hot Swaps plugin on `ipfs.skatehive.app`:
> Pinata Dashboard → Plugins Marketplace → Hot Swaps → select gateway

### Usage

```typescript
// lib/pinata/hotswap.ts — "use server" functions

import { swapCid, getSwapHistory, removeSwap } from "@/lib/pinata/hotswap";

// When user uploads a new profile picture:
await swapCid({ originalCid: oldAvatarCid, newCid: newAvatarCid });
// Now: ipfs.skatehive.app/ipfs/{oldCid} → transparently serves newCid

// Check what a CID currently resolves to:
const history = await getSwapHistory(cid);

// Revert to original (e.g. user deletes profile picture):
await removeSwap(originalCid);
```

### Swap history

```typescript
// Returns array of all swaps registered for a CID
const history = await getSwapHistory("Qm...");
// [{ cid: "Qm...", swappedTo: "bafy...", createdAt: "..." }]
```

---

## 8. Gateway Analytics

```
GET /api/pinata/analytics
```

Returns gateway request/bandwidth stats for Skatehive content.

### Query parameters

| Param | Default | Description |
|---|---|---|
| `creator` | — | Filter to a specific uploader's files |
| `days` | `30` | Rolling window (max 365) |
| `by` | `requests` | `requests` or `bandwidth` |
| `limit` | `10` | Max results (max 50) |

### Examples

```typescript
// Top 10 most-requested files in last 30 days
const res = await fetch('/api/pinata/analytics');

// All of xvlad's files sorted by requests this month
const res = await fetch('/api/pinata/analytics?creator=xvlad&days=30&by=requests');

// Top bandwidth consumers this week
const res = await fetch('/api/pinata/analytics?days=7&by=bandwidth&limit=20');
```

### Response shape

```json
{
  "analytics": [
    { "cid": "bafy...", "requests": 1847, "bandwidth": 2456789 }
  ],
  "creator": "xvlad",
  "days": 30,
  "by": "requests",
  "total": 5
}
```

---

## 9. Webhooks (Enterprise Only)

The webhook endpoint exists at `POST /api/pinata/webhook` but requires a Pinata Enterprise plan to activate.

File: `app/api/pinata/webhook/route.ts`

When Pinata Enterprise is available, register:
- URL: `https://skatehive.app/api/pinata/webhook`
- Events: `file.pinned`, `file.unpinned`
- Set `PINATA_WEBHOOK_SECRET` from the signing secret shown in dashboard

The handler verifies Svix HMAC signatures and logs events. Extend the `file.pinned` case to:
- Index new files in the database (creator → CID mapping)
- Notify users their upload is confirmed on the IPFS network
- Trigger post-processing (thumbnail generation, etc.)

---

## 10. Environment Variables

```bash
# Required
PINATA_JWT=                    # Pinata API key (keep secret, server-only)
NEXT_PUBLIC_IPFS_GATEWAY=      # Gateway host, default: ipfs.skatehive.app

# Pinata groups (created via: npx tsx scripts/setup-pinata-groups.ts)
PINATA_GROUP_VIDEOS=           # UUID of skatehive-videos group
PINATA_GROUP_IMAGES=           # UUID of skatehive-images group
PINATA_GROUP_AVATARS=          # UUID of skatehive-avatars group

# Pinata webhooks (Enterprise plan required)
PINATA_WEBHOOK_SECRET=         # Svix signing secret from Pinata dashboard

# Hive Images (for profile picture uploads)
HIVE_POSTING_KEY=              # Used to sign image upload requests
```

---

## 11. Decision Guide: Which Backend to Use?

```
New content to upload?
├── Is it a profile avatar or cover photo?
│   └── YES → Hive Images (getFileSignature + uploadImage)
│              Reason: Hive requires auth signature for these; 15MB is enough
│
└── Is it video / post image / any other content?
    └── YES → IPFS / Pinata
               ├── Need progress tracking? → uploadToIpfsSmart()
               ├── Simple image in markdown editor? → uploadToIpfs() from composeUtils
               └── Video file? → uploadToIPFS() from videoUpload (wraps uploadToIpfsSmart)

Displaying an image?
├── Is it from ipfs.skatehive.app or any /ipfs/ URL?
│   └── YES → optimizeImageUrl(src, w, h)  ← uses Pinata img-* params
│              DO NOT route through images.hive.blog (causes double-proxy)
│
├── Is it a Hive avatar?
│   └── YES → optimizeAvatarUrl(username, "sm"|"md"|"lg")
│
└── Is it an external URL?
    └── YES → optimizeImageUrl(src, w, h)  ← routes through images.hive.blog proxy

Updating a profile picture?
└── Upload new image to IPFS → swapCid({ originalCid, newCid })
    Existing links stay valid on all IPFS gateways, skatehive.app serves the new version
```

---

## File Map

| File | Role |
|---|---|
| `lib/pinata/groups.ts` | Group ID constants, `groupIdForMimeType()` helper |
| `lib/pinata/hotswap.ts` | `swapCid`, `getSwapHistory`, `removeSwap` server actions |
| `lib/utils/ipfsUpload.ts` | `uploadToIpfsSmart` — main upload entry point |
| `lib/utils/videoUpload.ts` | `uploadToIPFS` — video-specific wrapper |
| `lib/markdown/composeUtils.ts` | `uploadToIpfs` — markdown editor path |
| `lib/utils/imageUpload.ts` | Hive Images upload (avatars/covers) |
| `lib/utils/imageOptimize.ts` | `optimizeImageUrl`, `optimizeAvatarUrl`, `optimizeThumbnailUrl` |
| `app/api/pinata/route.ts` | Proxy for ≤4MB files |
| `app/api/pinata/signed-url/route.ts` | Issues temp JWT for direct large uploads |
| `app/api/pinata/analytics/route.ts` | Gateway analytics endpoint |
| `app/api/pinata/webhook/route.ts` | Pinata webhook receiver (Enterprise) |
| `app/api/pinata/metadata/[hash]/route.ts` | Fetch a file's keyvalue metadata by CID |
| `app/api/upload-image/route.ts` | Fallback proxy for Hive Images uploads |
| `scripts/setup-pinata-groups.ts` | One-time script to create Pinata groups |
