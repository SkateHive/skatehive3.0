-- 0033_spotmap_thumbnails.sql
-- Widget-safe thumbnails for spotmap_spots.
--
-- Problem: spotmap_spots.thumbnail holds the source photo URL at full size
-- (Google My Maps PNGs up to ~4MB, Hive JPEGs ~1MB). The iOS widget decodes
-- up to 5 of these (~42MB) against a ~30MB extension memory limit, so images
-- go missing or the widget gets killed.
--
-- Fix: two new columns, neither ever written by the sync jobs (syncHive.ts,
-- syncGoogleKml.ts, sync-one) so a re-sync can never clobber an admin edit
-- or a generated thumbnail.
--   - thumbnail_override: admin-set replacement for the source thumbnail,
--     set via PATCH /api/admin/spotmap/spot/[id].
--   - thumbnail_small: a small (<=400px) CDN or re-hosted URL for list/map/
--     widget rendering. Populated by the api's thumbnail generation, not by
--     this migration.
--
-- Read routes (api + web mirror) return:
--   thumbnail: coalesce(thumbnail_override, thumbnail)
--   thumbnail_small: thumbnail_small, falling back to the coalesced
--     thumbnail above when null.

alter table public.spotmap_spots
  add column if not exists thumbnail_override text null,
  add column if not exists thumbnail_small text null;
