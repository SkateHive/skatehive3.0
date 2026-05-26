-- 0023_spotmap_synthetic_author.sql
-- Give every spotmap_spots row a (hive_author, hive_permlink) pair so the
-- existing /spot/[author]/[permlink] route can serve both Hive-sourced
-- spots and Google-My-Maps-sourced spots from one URL pattern.
--
-- KML spots are NOT real Hive posts. We populate them with a reserved
-- synthetic author ('skatehive-map') and use the row uuid as the
-- "permlink". The /spot route is taught (in app code) to fall back to
-- spotmap_spots when the Hive RPC returns 404.

create or replace function public.spotmap_spots_fill_synthetic_author()
returns trigger
language plpgsql
as $$
begin
  if new.source = 'google_my_maps' and new.hive_author is null then
    new.hive_author := 'skatehive-map';
    new.hive_permlink := new.id::text;
  end if;
  return new;
end;
$$;

drop trigger if exists spotmap_spots_synth_author on public.spotmap_spots;
create trigger spotmap_spots_synth_author
  before insert or update on public.spotmap_spots
  for each row execute function public.spotmap_spots_fill_synthetic_author();

-- One-time backfill of existing rows.
update public.spotmap_spots
set hive_author = 'skatehive-map',
    hive_permlink = id::text
where source = 'google_my_maps'
  and hive_author is null;
