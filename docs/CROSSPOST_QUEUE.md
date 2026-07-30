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

## There is no HTTP API for the queue

An earlier design had this app expose list / detail / approve / reject
endpoints for the portal to drive. The portal reads and writes the tables
directly instead, so those routes were removed rather than left as a second way
in — approve in particular was a live double-post risk, since an admin could
have published an item the portal had already claimed and scheduled.

**The table is the contract.** The portal's queries go straight at
`userbase_crosspost_queue` and `userbase_notifications`; the schema below is
what it can rely on.

This app still publishes inline in exactly one case: the kill switch being off
for that user (`publishQueueItemNow`), which is the pre-queue behavior.

### What the portal reads and writes

| | Columns |
|---|---|
| **reads** | `id`, `user_id`, `requested_by_handle`, `target`, `hive_author`, `hive_permlink`, `status`, `payload`, `reviewed_by_handle`, `reviewed_at`, `review_note`, `attempts`, `published_at`, `publish_error`, `result`, `created_at`, `updated_at` |
| **writes** | `payload`, `status`, `reviewed_by_handle`, `reviewed_at`, `review_note`, `published_at`, `publish_error`, `result`, `updated_at` |
| **never writes** | `status = 'publishing'` — the app's compare-and-swap |

It filters `target = 'instagram'` on every query. `reviewed_by_user_id` stays
null; the portal doesn't resolve the uuid from a handle.

`payload` for an Instagram item:

```jsonc
{
  "caption": "…",                 // ≤2200, editable by the curator
  "collaborators": ["skater.ig"], // IG Collab handles, ≤3
  "image_url": null,
  "video_url": "https://ipfs.skatehive.app/ipfs/…",
  "media_items": [{ "type": "video", "url": "…" }],  // 2+ = carousel
  "ig_media_type": "REELS",       // IMAGE | REELS | CAROUSEL
  "permalink_url": "https://skatehive.app/post/skater/kickflip"
}
```

---

## Auth

The portal reads and writes both tables over **PostgREST with the userbase
service-role key** it already has (`SUPABASE_USERBASE_URL` +
`SUPABASE_USERBASE_SERVICE_ROLE_KEY`). No new credential, no new environment
variable — the portal's deployment can't take one.

RLS stays enabled on both tables; `service_role` bypasses it.

### The tradeoff, stated plainly

That key opens every `userbase_*` table, not just these two —
`userbase_hive_keys` (users' encrypted Hive posting keys), sessions, magic
links, 2000+ profiles. A compromised portal is therefore an account-takeover
risk, not just a mangled cross-post queue.

It also means one guarantee is weaker than it looks: `status = 'publishing'` is
this app's compare-and-swap, and the portal must never write it. With a scoped
role that would be enforced by an RLS `with check`; on the service-role key RLS
is bypassed, so it is back to being a convention both sides keep.

**Migration 0031 is the fix, and it is written but not applied.** It creates a
`portal_curation` role that can touch only these two tables, grants it to
`authenticator` so PostgREST can switch into it, and adds the matching
policies. Adopting it needs one thing the portal doesn't have today: somewhere
to put a second key. If that constraint ever lifts, run 0031 and have the
portal sign a JWT with `{"role": "portal_curation"}` against the project's JWT
secret — everything else in its Supabase client stays the same.

There is no in-app path for a curator. Reviewing happens in the portal; this
app only enqueues and notifies.

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

1. Apply migrations `0029` and `0030`. **Not 0031** — see Auth above; it is
   kept for the day the portal can hold a second key. This is what unblocks the
   portal, and it can happen before the code ships: empty tables affect nobody
2. Deploy with the switch **off** — nothing changes for anyone
3. Run the portal's preflight without `--read-only`. It checks every column and
   exercises a queue UPDATE and a notification INSERT, which is the first real
   verification either side has had
4. Set the switch to your own handle and go in this order: a **rejection**
   first — it exercises the database and the notification without publishing
   anything — then a photo, then a Reel
5. Set it to `true`

Migrations run manually, one file at a time:

```bash
node scripts/database/run-migration.js sql/migrations/0029_userbase_crosspost_queue.sql
```

It reads `DATABASE_URL` from `.env.local` and wraps the file in a transaction.
Merging a PR does not apply anything.

If the portal still reports `PGRST205` a minute after step 1, PostgREST hasn't
picked up the new tables yet:

```sql
NOTIFY pgrst, 'reload schema';
```

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
# The only new variable. The rollout switch above — ship it off.
CROSSPOST_QUEUE_ENABLED=

# Already required, unchanged
SUPABASE_URL= / SUPABASE_SERVICE_ROLE_KEY=
NEYNAR_API_KEY=
# …plus the existing Meta/Instagram Graph vars
```

The portal needs nothing new either: it reuses the userbase Supabase URL and
service-role key it already had.

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

## Things to keep in mind when touching this

- **`payload` is what the platform receives.** It's frozen at request time and
  the curator edits it in place; nothing re-derives it later. Changing its shape
  means changing the portal too.
- **Media is referenced, not stored.** `payload` holds IPFS URLs. An item that
  sits in review for weeks can outlive its media — the longer the queue, the
  more likely a preview breaks and the publish fails.
- **Nothing prunes the table.** Published, rejected and failed rows stay
  forever. Fine at this volume; worth an archive job eventually.
- **A `failed` item can be retried** once the cause is fixed (expired media,
  Meta rate limit). It doesn't hold the dedupe slot.
- **`crosspost_queued` is the app's alone** — see above. If the enqueue path
  moves, that notification has to move with it.

---

## Follow-ups not built

- **Push / email.** Notifications are in-app only, so the author has to open
  SkateHive to see them. `userbase_notifications` rows are the natural trigger
  if a channel is added later.
- **"My pending cross-posts" view.** The author gets told when a decision
  lands, but can't check what's still in review.
- **Farcaster curation.** It publishes immediately because nobody reviews it.
  If that changes, add it to `CURATED_TARGETS` and give the portal a screen —
  in that order, or the rows strand.
- **Scoped database role.** Migration 0031, written and unapplied. See Auth.
