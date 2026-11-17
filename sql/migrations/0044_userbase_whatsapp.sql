-- 0044_userbase_whatsapp.sql
-- ⚠ APPLY MANUALLY in the Supabase SQL editor (no migration runner).
--   Rollback: 0044_userbase_whatsapp.rollback.sql.
--
-- WhatsApp bot (OpenClaw on the Skatehive Mac mini) as a partner app client
-- ('whatsapp' in USERBASE_APP_CLIENTS). People link their WhatsApp number to
-- their userbase account and then post snaps by message.
--
-- Trust model (fail closed):
--   * The phone number is never stored. The API keeps only
--     HMAC-SHA256(WHATSAPP_PHONE_PEPPER, digits) — 64 hex chars.
--   * The sender's number comes from the WhatsApp gateway (the message's real
--     sender), never from text the person typed.
--   * Linking needs BOTH sides: a logged-in user creates a short-lived code
--     on the site (code_hash stored, raw code never stored), and the bot
--     confirms it with the sender's phone hash. The confirm RPC consumes the
--     code and writes the link in one transaction.
--   * One phone <-> one user. Linking a phone that was linked elsewhere moves
--     it; a user linking a new phone replaces the old one.
--   * Only service_role touches any of it (RLS on, no policies).
--
-- Safe to run more than once; one transaction; additive.

begin;

create table if not exists public.userbase_whatsapp_links (
  phone_hash text primary key
    constraint userbase_whatsapp_links_phone_hash_format
      check (phone_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null unique
    references public.userbase_users(id) on delete cascade,
  linked_at timestamptz not null default now()
);

create table if not exists public.userbase_whatsapp_link_codes (
  code_hash text primary key
    constraint userbase_whatsapp_link_codes_hash_format
      check (code_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null
    references public.userbase_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists userbase_whatsapp_link_codes_user_idx
  on public.userbase_whatsapp_link_codes (user_id, created_at desc);

create table if not exists public.userbase_whatsapp_posts (
  id bigserial primary key,
  user_id uuid not null
    references public.userbase_users(id) on delete cascade,
  author text not null,
  permlink text not null,
  created_at timestamptz not null default now(),
  constraint userbase_whatsapp_posts_unique unique (author, permlink)
);

create index if not exists userbase_whatsapp_posts_user_day_idx
  on public.userbase_whatsapp_posts (user_id, created_at desc);

alter table public.userbase_whatsapp_links enable row level security;
alter table public.userbase_whatsapp_link_codes enable row level security;
alter table public.userbase_whatsapp_posts enable row level security;

revoke all on public.userbase_whatsapp_links from anon, authenticated;
revoke all on public.userbase_whatsapp_link_codes from anon, authenticated;
revoke all on public.userbase_whatsapp_posts from anon, authenticated;

-- Consume a link code and bind the phone to the code's user, atomically.
-- Returns the user id, or raises UB410 (unknown / expired / used code).
create or replace function public.userbase_whatsapp_link_confirm(
  p_code_hash text,
  p_phone_hash text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  if p_code_hash !~ '^[0-9a-f]{64}$' or p_phone_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid input' using errcode = 'UB422';
  end if;

  update public.userbase_whatsapp_link_codes
     set used_at = now()
   where code_hash = p_code_hash
     and used_at is null
     and expires_at > now()
  returning user_id into v_user;

  if v_user is null then
    raise exception 'code expired or used' using errcode = 'UB410';
  end if;

  delete from public.userbase_whatsapp_links
   where phone_hash = p_phone_hash or user_id = v_user;

  insert into public.userbase_whatsapp_links (phone_hash, user_id)
  values (p_phone_hash, v_user);

  return v_user;
end;
$$;

revoke all on function public.userbase_whatsapp_link_confirm(text, text) from public, anon, authenticated;
grant execute on function public.userbase_whatsapp_link_confirm(text, text) to service_role;

commit;
