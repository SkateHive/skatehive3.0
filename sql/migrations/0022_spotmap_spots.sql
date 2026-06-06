-- 0022_spotmap_spots.sql
-- Auxiliary store of skate spots aggregated from multiple sources so the
-- /map and /map/globe views can render thousands of spots from a single
-- indexed query instead of hammering the Hive RPC on every page load.
--
-- Two sources are unified into one shape:
--   - 'hive'             : a Hive comment tagged 'skatespot'. source_id = author/permlink.
--   - 'google_my_maps'   : a Placemark in the curated Skatehive Google My Map (KML feed).
--                          source_id = KML feature id (Google's stable per-placemark id).
--
-- Sync is triggered manually by an admin via /api/admin/spotmap/sync; rows
-- are upserted on (source, source_id). No RLS — table is server-read-only
-- and exposed via /api/spotmap with the service role key.

create table if not exists public.spotmap_spots (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('hive', 'google_my_maps')),
  source_id text not null,

  -- Display fields (parsed/normalised at sync time)
  name text not null,
  description text,
  lat double precision not null,
  lng double precision not null,
  address text,
  thumbnail text,
  images jsonb,            -- [{url, caption}] for hive spots, [] otherwise

  -- Hive-specific (null for google_my_maps rows)
  hive_author text,
  hive_permlink text,
  hive_created timestamptz,        -- post's `created` (UTC)
  hive_last_update timestamptz,    -- post's `last_update`

  -- Google-specific (null for hive rows)
  kml_feature_id text,             -- duplicates source_id when source='google_my_maps'
  kml_description text,            -- raw description HTML from the placemark

  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),

  unique (source, source_id)
);

-- Geospatial-ish lookup. We don't need PostGIS; a btree on lat,lng is enough
-- for bbox filters at the scale we're targeting.
create index if not exists spotmap_spots_latlng_idx on public.spotmap_spots (lat, lng);
create index if not exists spotmap_spots_source_idx on public.spotmap_spots (source);

-- For the incremental Hive crawl: we walk newest-first and stop when we
-- hit hive_created <= MAX(hive_created). This index makes that cheap.
create index if not exists spotmap_spots_hive_created_idx
  on public.spotmap_spots (hive_created desc nulls last)
  where source = 'hive';

-- Touch updated_at on every row update.
create or replace function public.spotmap_spots_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists spotmap_spots_touch_updated_at on public.spotmap_spots;
create trigger spotmap_spots_touch_updated_at
  before update on public.spotmap_spots
  for each row execute function public.spotmap_spots_touch_updated_at();
