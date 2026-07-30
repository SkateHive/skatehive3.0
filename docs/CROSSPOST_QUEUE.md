# Cross-post curation queue

An Instagram cross-post no longer publishes on the spot. It lands in a review
queue and the social-media team decides **if** and **when** it ships, from the
SkateHive portal (separate repo).

```
SnapComposer ──▶ POST /api/instagram/post ──▶ userbase_crosspost_queue
                                                status = pending_review
                                                       │
                            Portal reads the queue ────┤
                            Portal publishes to IG ────┤
                            Portal writes the outcome ─┘
                                                       │
                            userbase_notifications ────┴─▶ the author
```

**The portal owns publishing.** It reads the queue over a scoped Postgres role
(`portal_curation`, migration 0031), runs its own Instagram pipeline with
transcode and retry, and writes the result back onto the row. This app's job is
to file the request, guard it, and tell the author what happened.

> **Farcaster does not queue.** The portal reviews Instagram only, so a queued
> cast would sit in `pending_review` with nobody to review it. It also posts to
> the user's own account rather than the shared brand one, which was always the
> weaker case for curation. See `CURATED_TARGETS` in `lib/crosspost/queue.ts`.

---

## Why the split

| Concern | Where it lives |
|---|---|
| Author gates (own snap, 100 HP, rate limits) | request time, `/api/instagram/post` |
| What gets posted (caption, media) | frozen into `payload` at request time |
| Whether and when it gets posted | the portal |
| Publishing to Instagram | the portal's pipeline |
| Telling the author | `userbase_notifications`, rendered by this app |

The payload stored on the row is the **finished publish input** — caption
already built, media URLs already validated. The portal may edit the caption
and collaborators before publishing, but it never has to re-derive anything.

---

## Statuses

| Status | Written by | Meaning |
|---|---|---|
| `pending_review` | app | Waiting for the curation team. The default. |
| `approved` | portal | Claimed — publishing now, or scheduled for later. |
| `publishing` | **app only** | An immediate publish is in flight (see below). |
| `published` | portal | Live. `result` holds the IDs. |
| `rejected` | portal | Curator passed. **Frees the slot** — the author can request again. |
| `failed` | portal / app | Publish errored. `publish_error` has the reason; retryable. |

The portal's transitions are `pending_review → approved` and then
`approved → published | failed`.

`publishing` is **exclusively** this app's compare-and-swap, used when the kill
switch is off and the request publishes inline. It is the guard that stops two
writers from double-posting, so the portal must never write it — migration 0031
enforces that in the RLS policy (`with check (status <> 'publishing')`) rather
than trusting convention.

A partial unique index on `(target, hive_author, hive_permlink)` covering
`pending_review / approved / publishing / published` means one active request
per snap per platform. Rejected and failed rows don't hold the slot, so an
author can ask again after a rejection.

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

### `POST /api/crosspost/queue/{id}/reject`

```jsonc
{ "note": "clip is too dark, ask for a re-upload" }
```

Frees the slot so the author can request the same snap again later, and writes
the author a `crosspost_rejected` notification.

### There is no approve endpoint

There used to be. It published to Instagram from this app, which is now the
portal's job — and keeping both alive meant an admin could approve an item the
portal had already claimed and scheduled, posting it twice to @skatehive.
Removed rather than guarded, since nothing calls it.

The app still publishes inline in exactly one case: the kill switch being off
for that user (`publishQueueItemNow`), which is the pre-queue behavior.

---

## Auth

The portal talks to Supabase as **`portal_curation`** (migration 0031):
`SELECT`/`UPDATE` on the queue, `INSERT` on notifications, nothing else.

### Why not the service-role key

Because that key opens every `userbase_*` table — `userbase_hive_keys` (users'
encrypted Hive posting keys), sessions, magic links, 2000+ profiles. With it, a
compromised portal is an account-takeover event. With `portal_curation`, the
worst case is a mangled cross-post queue.

It is one line of config on the portal's side, so there is no good reason to
run on the master key.

### Wiring it up

PostgREST connects as `authenticator` and switches into whatever role the JWT's
`role` claim names — exactly how the anon and service_role keys work. So the
portal mints its own key rather than being handed one:

```js
// Sign with the project's JWT secret (Settings → API → JWT Secret), HS256.
jwt.sign(
  { role: "portal_curation", iss: "supabase", iat: now, exp: now + YEARS },
  SUPABASE_JWT_SECRET
);
```

Send it as both `apikey` and `Authorization: Bearer <jwt>`. Everything else in
the portal's Supabase client stays the same.

Migration 0031 does the two things that make this work: `GRANT portal_curation
TO authenticator` (without it PostgREST can't assume the role at all), and RLS
policies `TO portal_curation` on both tables — the existing policies are
service-role-only, so GRANTs alone would still read zero rows.

One thing the scoped role buys structurally: its update policy carries
`with check (status <> 'publishing')`, so the database refuses to let the
portal write the app's compare-and-swap status. On the service-role key that
guard doesn't apply — RLS is bypassed — and it goes back to being a convention.

**A logged-in SkateHive admin** — userbase session cookie plus a linked Hive
handle on `ADMIN_USERS` — can still hit the HTTP endpoints above, for working
the queue from inside the app. `CROSSPOST_PORTAL_TOKEN` also still authorizes
them server-to-server.

---

## Rolling it out (and backing it out)

`CROSSPOST_QUEUE_ENABLED` is the switch. The day the queue turns on, every
cross-post stops publishing and waits for a curator — so it ships **off** and
gets flipped once the portal's review screen is live.

```bash
CROSSPOST_QUEUE_ENABLED=              # off: publish immediately (pre-queue behavior)
CROSSPOST_QUEUE_ENABLED=true          # everyone goes through review
CROSSPOST_QUEUE_ENABLED=alice,bob     # only these Hive handles — canary
```

Suggested order, so no step is visible to users until you want it to be:

1. Apply migrations `0029`, `0030` and `0031`
2. Mint the `portal_curation` JWT and switch the portal off the service-role
   key (see Auth above) — do it now, while the queue is still empty and a
   mistake costs nothing
3. Deploy with the switch **off** — nothing changes for anyone
4. Run the portal's preflight against the real (empty) tables, on the new key.
   It checks every column, a queue UPDATE and a notification INSERT, so it also
   proves the role has what it needs
5. Set the switch to your own handle, run one cross-post end to end —
   rejection first (exercises the database and the notification without
   publishing anything), then a photo, then a Reel
6. Set it to `true`

Until step 1 the portal's queue tab is inert: the tables don't exist, so it
shows a message and publishes nothing.

With the switch off the request still files a queue row and immediately
publishes it, so there is only ever one code path talking to Meta. Those rows
carry `review_note = "auto-published (curation queue disabled)"` and no
reviewer, which is how you tell them apart later.

> **Drain before you switch off.** Items already in `pending_review` are not
> released when the switch flips — they stay queued, nobody approves them, and
> their authors are never told. Approve or reject what's in the queue first.

> **Vercel needs a redeploy** for an environment variable change to take
> effect. Backing out is "change the variable and redeploy", not instant — but
> it beats a code revert, which would strand whatever is already queued.

## Environment

```bash
# New — shared secret between this repo and the portal
CROSSPOST_PORTAL_TOKEN=<long random string>

# New — the rollout switch above. Ship it off.
CROSSPOST_QUEUE_ENABLED=

# Already required, unchanged
ADMIN_USERS=curator1,curator2          # or NEXT_PUBLIC_ADMIN_USERS
SUPABASE_URL= / SUPABASE_SERVICE_ROLE_KEY=
NEYNAR_API_KEY=
# …plus the existing Meta/Instagram Graph vars
```

---

## The author finds out

SkateHive's notification page reads Hive's `bridge.account_notifications` —
blockchain events only. A curation decision has no Hive counterpart, so
migration `0030` adds `userbase_notifications`, an app-owned store, and the
page renders it as a **"From SkateHive"** section above the Hive list. The
sidebar badge sums both sources.

| `type` | Written by | When | `metadata` used |
|---|---|---|---|
| `crosspost_queued` | app | the request is filed | — |
| `crosspost_rejected` | portal | curator passed | `note` — quoted, in whatever language it was written |
| `crosspost_scheduled` | portal | approved for a future time | `scheduled_for` — ISO 8601, rendered in the reader's timezone |
| `crosspost_published` | portal | it is live | `ig_permalink` (also in `link`) |
| `crosspost_failed` | portal / app | publishing gave up | — |

All carry `queue_id`, `target` and `hive_permlink`.

**`crosspost_queued` is the app's alone**, and it matters more than it looks.
Without it, marking cross-post produces nothing the author can point at, maybe
for days — indistinguishable from a bug. They click again, hit the duplicate
guard, and an action that never gave feedback starts returning an error. The
composer's toast covers the moment; this row is what they find later. The
portal can't write it: at click time it doesn't know the request exists.

There is deliberately no notification for "approved, publishing now" — the post
lands within minutes and `crosspost_published` follows with the link. Only a
schedule more than ~15 minutes out sends `crosspost_scheduled` first.

The copy is rebuilt client-side from `type` + `metadata`
(`lib/notifications/localizeCrossPost.ts`), so it follows the reader's language
across all four locales; the stored `title`/`body` are an English fallback.

Writing a notification never blocks the action: `lib/notifications/appNotifications.ts`
swallows and logs its errors, so a failed insert can't 500 the caller.

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
