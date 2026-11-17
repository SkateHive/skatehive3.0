-- 0044_userbase_whatsapp.rollback.sql
-- Removes the WhatsApp link tables and RPC. Deletes every phone link and the
-- WhatsApp post log (posts on Hive are untouched).

begin;

drop function if exists public.userbase_whatsapp_snap_settle(bigint, text);
drop function if exists public.userbase_whatsapp_snap_reserve(uuid, text, text, integer);
drop function if exists public.userbase_whatsapp_link_confirm(text, text);
drop table if exists public.userbase_whatsapp_posts;
drop table if exists public.userbase_whatsapp_link_codes;
drop table if exists public.userbase_whatsapp_links;

commit;
