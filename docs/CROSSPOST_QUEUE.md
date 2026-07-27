# Cross-post curation queue

Every user-initiated cross-post now lands in a review queue instead of going
straight to Instagram or Farcaster. The social-media/curation team decides
**if** and **when** each one ships, from the SkateHive portal (separate repo).

```
SnapComposer ──▶ POST /api/instagram/post  ──┐
                 POST /api/farcaster/cast  ──┴─▶ userbase_crosspost_queue
                                                   status = pending_review
                                                          │
   Portal ──▶ GET  /api/crosspost/queue ────────────────── │ (the inbox)
          ──▶ POST /api/crosspost/queue/{id}/approve ──────┴─▶ Meta / Neynar
          ──▶ POST /api/crosspost/queue/{id}/reject
```

**The portal never touches Meta, Neynar or Supabase directly.** It drives this
API, so the publishing credentials stay in one place (this repo). Building the
portal screen means calling four endpoints — nothing more.

---

## Why the split

| Concern | Where it lives |
|---|---|
| Author gates (own snap, 100 HP, rate limits) | request time, `/api/instagram/post` |
| What gets posted (caption, embeds, media) | frozen into `payload` at request time |
| Whether it gets posted at all | curator, at approve time |
| Meta / Neynar credentials | this repo only |

The payload stored on the row is the **finished publish input**. The approve
endpoint is a dumb executor — it never re-derives content, so what the curator
reviews is exactly what the platform receives.

The one thing re-resolved at publish time is the **Farcaster signer**: it's read
from `userbase_identities` when the cast actually goes out, so a signer the user
revoked while the item sat in review fails loudly instead of posting.

---

## Statuses

| Status | Meaning |
|---|---|
| `pending_review` | Waiting for the curation team. The default. |
| `approved` | Reserved for a future "schedule for later" flow. |
| `publishing` | A publish is in flight (compare-and-swap guard). |
| `published` | Live on the platform. `result` holds the IDs. |
| `rejected` | Curator passed. **Frees the slot** — the author can request again. |
| `failed` | Publish attempt errored. `publish_error` has the reason; retryable. |

A partial unique index on `(target, hive_author, hive_permlink)` covering
`pending_review / approved / publishing / published` means one active request
per snap per platform. Rejected and failed rows don't hold the slot.

---

## Endpoints

All four require curator auth (below). All return JSON.

### `GET /api/crosspost/queue`

The inbox.

| Query | Default | Notes |
|---|---|---|
| `status` | `pending_review` | comma-separated, or `all` |
| `target` | both | `instagram` \| `farcaster` |
| `author` | — | filter by Hive author |
| `limit` | `50` | 1–100 |
| `offset` | `0` | |
| `order` | `oldest` | `oldest` (FIFO) \| `newest` |

```json
{
  "success": true,
  "total": 12,
  "limit": 50,
  "offset": 0,
  "items": [
    {
      "id": "uuid",
      "target": "instagram",
      "status": "pending_review",
      "hive_author": "skater",
      "hive_permlink": "kickflip-5-stair",
      "requested_by_handle": "skater",
      "payload": {
        "caption": "…",
        "collaborators": ["skater.ig"],
        "image_url": null,
        "video_url": "https://ipfs.skatehive.app/ipfs/…",
        "ig_media_type": "REELS",
        "permalink_url": "https://skatehive.app/post/skater/kickflip-5-stair"
      },
      "requester": { "handle": "skater", "display_name": "…", "avatar_url": "…" },
      "created_at": "2026-07-27T18:04:11Z"
    }
  ]
}
```

### `GET /api/crosspost/queue/{id}`

One item in full, plus `requester`. For the review screen.

### `POST /api/crosspost/queue/{id}/approve`

Publishes **now**. All body fields optional — last-minute curator edits:

```jsonc
{
  "caption": "…",              // Instagram legenda override (≤2200)
  "collaborators": ["handle"], // Instagram Collab handles (≤3)
  "text": "…",                 // Farcaster cast text override (≤1024)
  "channel_id": "skateboard",  // Farcaster channel (whitelisted)
  "note": "bumped for the weekend push"
}
```

Only these keys are honored — the portal can't rewrite `hive_author` or the
media URLs after the author's gates ran.

```json
{ "success": true, "queue_id": "uuid", "status": "published",
  "target": "instagram", "approved_by": "curator",
  "result": { "ig_media_id": "…", "ig_permalink": "https://instagram.com/p/…" } }
```

On failure: `502` with `{ "error": "...", "status": "failed" }`. The row is left
`failed` with the message, so the portal can show it and retry later.

`409` means someone else already published it or is publishing right now — the
item is compare-and-swapped into `publishing` before any network call, so two
curators clicking Approve at once can't double-post. The swap pins `updated_at`
as an optimistic lock, so whoever writes first wins and the other matches zero
rows.

**Stuck-row escape.** Publishing a Reel can block for minutes, so a request
dying mid-publish is realistic. A row left in `publishing` for more than
`STALE_PUBLISHING_MS` (10 min) becomes claimable again — without that it would
be unapprovable forever, with no fix but manual SQL. The approve route also
declares `maxDuration = 300` so the platform's default ceiling doesn't cause
the timeout in the first place.

### `POST /api/crosspost/queue/{id}/reject`

```jsonc
{ "note": "clip is too dark, ask for a re-upload" }
```

Frees the slot so the author can request the same snap again later.

---

## Auth

Two accepted callers.

**1. The portal (server-to-server)** — set `CROSSPOST_PORTAL_TOKEN` in both
repos and send:

```
x-skatehive-portal-token: <CROSSPOST_PORTAL_TOKEN>
x-skatehive-curator: <hive-handle>     # who clicked, for the audit trail
```

Keep this on the portal's **server** side (route handler / server action). It's
a full publish credential — never ship it to the browser.

**2. A logged-in SkateHive admin** — userbase session cookie + a linked Hive
handle on `ADMIN_USERS`. Lets the queue be worked from inside the app without
the portal.

---

## Environment

```bash
# New — shared secret between this repo and the portal
CROSSPOST_PORTAL_TOKEN=<long random string>

# Already required, unchanged
ADMIN_USERS=curator1,curator2          # or NEXT_PUBLIC_ADMIN_USERS
SUPABASE_URL= / SUPABASE_SERVICE_ROLE_KEY=
NEYNAR_API_KEY=
# …plus the existing Meta/Instagram Graph vars
```

---

## The author finds out

Approve and reject both write a notification for the requesting author, so a
decision is never silent.

SkateHive's notification page reads Hive's `bridge.account_notifications` —
blockchain events only. A curation decision has no Hive counterpart, so
migration `0030` adds `userbase_notifications`, an app-owned store, and the
page renders it as a **"From SkateHive"** section above the Hive list. The
sidebar badge sums both sources.

| Event | Notification |
|---|---|
| Approved + published | *"Your snap is live on Instagram 🎉"* — links to the published post |
| Rejected | *"Your Instagram cross-post wasn't picked up"* — quotes the curator's `note` when there is one |
| Approved but the platform refused | *"…couldn't be published"* — carries the error, since causes like a revoked Farcaster signer are the author's to fix |

Writing a notification never blocks the action: `lib/notifications/appNotifications.ts`
swallows and logs its errors, so a failed insert can't 500 a curator's approve.

Notifications are marked read simply by opening the page — there's no
custom_json to broadcast like the Hive ones, so there's no reason to make the
user click a button.

**Delivery caveat:** app notifications resolve the reader from the **userbase
session cookie**. A Keychain-only user who never signed into userbase won't see
them, even though their queue row has a `user_id`. They'd need to sign in once.

Endpoints: `GET /api/userbase/notifications` (list + `unread_count`),
`POST /api/userbase/notifications` with `{ all: true }` or `{ ids: [...] }`.

---

## What did NOT change

- **`/api/instagram/force-post`** still publishes immediately. That route is the
  moderator's own hands — the curation team *is* the approval step, so making it
  queue behind itself would be a loop.
- **`userbase_instagram_posts`** is still the IG publication registry: dedupe,
  the per-user 24h cap and the composer preview all read it. The queue writes
  into it on a successful publish.
- **Hive posting itself.** The snap goes to Hive immediately, as always. Only
  the cross-posts wait for review.

---

## Notes for whoever builds the portal screen

- Poll `GET /api/crosspost/queue?status=pending_review&order=oldest`. There's no
  webhook.
- Render `payload` directly — it's what the platform will receive. For Instagram
  the useful preview fields are `caption`, `collaborators`, `video_url` /
  `image_url`, `ig_media_type`; for Farcaster, `text`, `embeds`, `channel_id`.
- `permalink_url` in the payload links back to the snap on SkateHive, so a
  curator can see it in context before deciding.
- Approve is **not** idempotent-safe to spam: treat a `409` as "someone beat you
  to it" and refresh the list.
- A `failed` item can be approved again once the cause is fixed (expired media,
  revoked signer, Meta rate limit).

---

## Follow-ups not built here

- **Scheduling.** `approved` exists as a status but nothing consumes it. A
  "publish at 18:00" flow would set `approved` + a `scheduled_for` column and
  need a cron worker to drain it. Today approval publishes immediately.
- **Push / email.** Notifications are in-app only — the user has to open
  SkateHive to see them. `userbase_notifications` rows are the natural trigger
  if a push or email channel is added later.
- **"My pending cross-posts" view.** The author can see the outcome once a
  curator decides, but has no way to check what's still in review.
