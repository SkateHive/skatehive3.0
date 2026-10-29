-- 0035_spotmap_medium_mirror.sql
-- Medium image variant and preserved original for spotmap_spots.
--
-- Canonical copy of the schema recorded in skatehive-api PR #50
-- (src/lib/userbase/migrations/spotmap_medium_mirror.sql). spotmap_spots is
-- web-owned, so this file is the one to apply.
--
-- Problem: the spot detail hero loads full-size source images (Google My Maps
-- PNGs up to ~16MB), and Google-hosted spot images are expiring.
--
-- Fix: two new nullable columns, no defaults, no backfill here.
--   - thumbnail_medium: ~800px variant for the detail hero.
--   - image_original_mirror: IPFS copy of the original source image.
--
-- Both are written only by the api's spotmap image mirror script, via a
-- reviewed SQL file. The sync jobs (syncHive.ts, syncGoogleKml.ts, sync-one)
-- and the mobile upsert never write them, so a re-sync never clobbers them.
-- thumbnail, thumbnail_override and thumbnail_small are not touched.
--
-- Old clients are unaffected: web reads select explicit columns, and the api
-- falls back to thumbnail_override / thumbnail when thumbnail_medium is null.
--
-- Rollback (drops any mirrored URLs written since; the api falls back cleanly
-- when thumbnail_medium is missing):
--   alter table public.spotmap_spots
--     drop column if exists thumbnail_medium,
--     drop column if exists image_original_mirror;

alter table public.spotmap_spots
  add column if not exists thumbnail_medium text null,
  add column if not exists image_original_mirror text null;
