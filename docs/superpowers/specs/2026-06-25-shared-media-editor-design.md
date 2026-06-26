# Shared Media Editor (Phase A) — Design

**Date:** 2026-06-25
**Status:** Draft for review
**Scope:** Phase A of the unified cross-post composer. Standalone, shippable on its own.

## Background & vision

We are evolving the snap/cross-post flow toward **one unified stepped composer** that opens when a user posts and has marked cross-post targets (Instagram, Farcaster, …), with a conditional step per network. The eventual steps:

1. **Media** (shared) — trim + crop/position + cover frame
2. **SkateHive** — caption/tags/community
3. **Instagram** *(if selected)* — caption + collaborators + IG preview (already built)
4. **Farcaster / others** *(if selected)*
5. **Review & publish**

This doc covers **Phase A only: the shared Media editor**. Phases B (wizard shell), C (fold IG dialog in as a step), and D (Farcaster + unified publish) are future specs.

### Hard constraint carried into all phases
The **moderator "Force post to Instagram"** action ([Snap.tsx:451](../../../components/homepage/Snap.tsx), 3-dot menu) **keeps using the standalone `InstagramCrossPostDialog`** (`mode="moderator"`). That component stays reusable — invoked standalone for moderators, and later embedded as the Instagram *step* for self-posts. Phase A must not break it.

## Goal

Let a user crop/position their media and choose a cover at post time, so the **same** processed media + **one** cover serve SkateHive, Instagram, and Farcaster — no per-network re-upload.

## Scope (Phase A)

| Media | What the user can do | What gets posted |
|-------|----------------------|------------------|
| **Photo** | Pick aspect (Original / 1:1 / 4:5), pan + zoom | The **cropped image** (re-uploaded) |
| **Video** | Trim (existing) + pick cover frame + crop/position that **cover** (Original / 1:1 / 4:5) | The **trimmed video** (unchanged) + the **cropped cover** |

**Out of scope for Phase A (deferred):**
- Re-encoding/cropping the **video pixels** to a new aspect (heavy: per-frame canvas re-encode). Video plays as trimmed; only the cover is cropped.
- The wizard shell and per-social steps (Phases B–D).
- Multi-image per-image crop UX beyond cropping each image as it is added.

## Key decisions

1. **Aspect presets:** `Original` (default, no crop) · `1:1` · `4:5`. 4:5 is Instagram's tallest feed crop; Original keeps current behavior when the user does nothing.
2. **Crop is optional.** Default is Original → byte-identical to today's flow. No forced step.
3. **Output:** longest side ≈ 1080px, JPEG quality ~0.9. IG-friendly, small.
4. **One cover everywhere.** The video cover lives in `json_metadata.thumbnail[0]` (as today) and is also passed to Instagram as the reel `cover_url`.
5. **Reuse, don't rebuild.** Generalize the existing `ImageCropper` (react-easy-crop) and `ThumbnailCapture`; reuse `uploadToIpfsSmart`.

## Architecture

### Units & responsibilities

**1. `ImageCropper` — generalize (components/shared/ImageCropper.tsx)**
- Today: hard-codes 1000×1300 output and a magazine title; `aspectRatio` prop exists but the canvas ignores it ([ImageCropper.tsx:53-66](../../../components/shared/ImageCropper.tsx)).
- Change:
  - Derive output dimensions from the chosen aspect + a `maxDimension` (default 1080), instead of fixed 1000×1300.
  - Add optional `aspectOptions?: { label: string; value: number | null }[]` → renders a preset selector inside the modal; `null` = Original (no crop / passthrough). When omitted, behaves as a single fixed aspect (back-compat).
  - Add `outputMaxDimension?: number` (default 1080) and `outputFileName?: string`.
  - Keep the existing `{ isOpen, onClose, imageSrc, onCropComplete, aspectRatio, title }` contract working so **EditProfile's magazine-cover call is unchanged** (it passes `aspectRatio={1000/1300}` and expects a `File`; we keep that path by treating an explicit `aspectRatio` with no `aspectOptions` as fixed, and letting EditProfile keep 1000×1300 via an explicit `outputMaxDimension`/dims override).
- Output unchanged in shape: returns a `File` (JPEG) to `onCropComplete`.
- Responsibility: pure crop UI → cropped `File`. It does **not** upload (caller decides). EditProfile uploads in its callback; SnapComposer will too.

**2. Photo crop integration — `SnapComposer.tsx`**
- All still-image entry points already funnel through `uploadImageWithFallback` ([SnapComposer.tsx:443](../../../components/homepage/SnapComposer.tsx)) from: file select (~516), gif/webp (~558), generated gif (~606), paste (~1273), drop (~1453).
- Add a single `pendingCropImage` state + one `ImageCropper` instance mounted in the composer.
- For **still images only** (`image/*` that is **not** gif/webp — animated formats skip cropping), route the local blob into the cropper first; `onCropComplete(file)` then calls the existing `uploadImageWithFallback(file, …)` and pushes to `compressedImages`. GIF/WebP/HEIC keep today's direct path.
- Net effect: cropped image URL lands in `compressedImages[0].url`, which already flows to `json_metadata.images` and to the IG context `imageUrl` ([SnapComposer.tsx:1075](../../../components/homepage/SnapComposer.tsx)).

**3. Video cover editing — `VideoTrimModal.tsx` + `ThumbnailCapture.tsx`**
- Today: a cover frame is auto-captured mid-trim and re-capturable via `ThumbnailCapture`; uploaded to IPFS; returned as `TrimmedVideoFile.thumbnailUrl`.
- Change:
  - Keep frame capture. Add a "Crop cover" affordance that opens the generalized `ImageCropper` on the captured frame (data URL), with the same Original/1:1/4:5 presets.
  - On crop confirm, upload the cropped cover via `uploadThumbnail`/`uploadToIpfsSmart` and use that as `thumbnailUrl`.
- No change to the trimmed-video pipeline. `thumbnailUrl` continues to flow into `json_metadata.thumbnail[0]` and the IG context.

**4. Instagram reel cover wiring — `lib/instagram/graph.ts` + routes**
- `publishReelToInstagram` already accepts `coverUrl` → `cover_url` ([graph.ts:38,178](../../../lib/instagram/graph.ts)).
- Pass the snap's `thumbnail[0]` through the publish routes (`/api/instagram/post`, `/api/instagram/force-post`) as `coverUrl` for REELS. Small, additive; falls back to current behavior if absent.

### Data flow

```
add photo ─► ImageCropper (optional crop) ─► uploadImageWithFallback ─► compressedImages[0].url
                                                                          │
add video ─► VideoTrimModal ─► trim ─► createTrimmedVideo ─► videoUrl     │
                          └─► capture frame ─► ImageCropper(cover) ─► uploadThumbnail ─► thumbnailUrl
                                                                          │
                                       json_metadata { images:[…], thumbnail:[cover] }
                                                                          │
                       ┌──────────────────────────────────────────────────┘
                       ▼
   CrossPostContext { imageUrl: images[0] || cover, videoUrl, … }  ──► IG dialog/step
                                                              cover ──► reel cover_url
```

## Error handling
- Crop canvas/`toBlob` failure → toast + fall back to uploading the **original** image (never block posting on a crop failure).
- Cover crop failure → keep the previously captured (uncropped) cover.
- Upload failure → existing `uploadImageWithFallback`/`uploadThumbnail` error paths (toasts) unchanged.
- `react-easy-crop` already handles cross-origin via the data URL/object URL we pass.

## Testing
- **Unit:** `getCroppedImg` output dimensions for each aspect (Original passthrough, 1:1, 4:5) and `maxDimension` cap; filename/quality. (Canvas mockable; follows existing `lib/**/__tests__` tsx-test pattern.)
- **Manual:**
  - Photo snap: add image → crop 1:1 → verify posted image + IG preview use the cropped URL; "Original" → unchanged bytes.
  - Video snap: trim → pick + crop cover → verify `thumbnail[0]` is the cropped cover and IG reel preview/cover match.
  - Regression: EditProfile magazine-cover crop still outputs 1000×1300.
  - Regression: moderator Force-post dialog still works standalone.

## Affected files
- `components/shared/ImageCropper.tsx` (generalize)
- `components/homepage/SnapComposer.tsx` (photo crop routing)
- `components/homepage/VideoTrimModal.tsx`, `components/homepage/ThumbnailCapture.tsx` (cover crop)
- `lib/instagram/graph.ts` + `app/api/instagram/post/route.ts` + `app/api/instagram/force-post/route.ts` (reel `cover_url`)
- `components/profile/EditProfile.tsx` (verify/adjust call to keep 1000×1300)

## Open questions
- None blocking. Aspect set fixed at Original/1:1/4:5 for Phase A (9:16 can be added later if reels need a taller cover).
