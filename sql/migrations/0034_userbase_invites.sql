-- 0034_userbase_invites.sql
-- ⚠ APPLY MANUALLY in the Supabase SQL editor — this repo has no migration
--   runner. Until this runs, /api/userbase/invites returns 503 and the Hive
--   flow simply logs no attribution; neither one breaks.
-- Invite attribution, for both paths out of /invite:
--   * lite  — a Skatehive account created for a friend, who logs in by email
--   * hive  — a real Hive account paid for and signed by the inviter
-- Before this, nothing recorded who brought whom in. The lite path also needs
-- it as its rate-limit source: counting a sender's rows over the last day is
-- the only cap that holds across serverless instances. The count and the claim
-- happen together in userbase_reserve_invite, so concurrent requests cannot
-- slip past the cap between them.
--
-- Safe to run more than once, and runs as one transaction: either all of it
-- lands or none of it does. Additive, except that duplicate hive rows left by
-- an earlier version of this migration are collapsed to the oldest one before
-- the unique index on hive_username is built.
--
-- Not covered: userbase_merge_users does not move invites or invited_by onto
-- the surviving account (nor does it for the tables added since 0019). Rows
-- stay on the merged-away account; nothing is lost, but it needs a follow-up
-- migration written against the live function definition.

begin;

-- Direct lineage for lite accounts. Denormalized on purpose — "who brought this
-- skater in" is a one-column read on the profile, not a join.
alter table public.userbase_users
  add column if not exists invited_by uuid
  references public.userbase_users(id) on delete set null;

create index if not exists userbase_users_invited_by_idx
  on public.userbase_users(invited_by)
  where invited_by is not null;

create table if not exists public.userbase_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_user_id uuid not null references public.userbase_users(id) on delete cascade,
  kind text not null check (kind in ('lite', 'hive')),
  -- Lowercased address the invite went to. Kept in clear: the inviter typed it,
  -- support needs it to chase a bounced invite, and it is already in the mail log.
  invitee_email text not null,
  -- Set for kind = 'lite': the account this invite created.
  invitee_user_id uuid references public.userbase_users(id) on delete set null,
  -- Set for kind = 'hive': the account name broadcast to the chain.
  hive_username text,
  created_at timestamptz not null default now(),
  -- A hive invite is only worth keeping if it says which account it paid for.
  constraint userbase_invites_hive_named
    check (kind <> 'hive' or hive_username is not null)
);

-- Rate limit fast path: a sender's invites inside the trailing window.
create index if not exists userbase_invites_inviter_recent_idx
  on public.userbase_invites(inviter_user_id, created_at desc);

-- "Who did this account bring in", and the reverse lookup from an invitee.
-- A resend to an invitee who never signed in adds another lite row for the same
-- invitee_user_id (it spends a slot of the daily cap like any invite), so count
-- people with count(distinct invitee_user_id), not count(*).
create index if not exists userbase_invites_invitee_idx
  on public.userbase_invites(invitee_user_id)
  where invitee_user_id is not null;

-- One attribution row per Hive account, so a retried invite mail cannot log
-- the same account twice. Deliberately not partial: the route upserts on this
-- column, and PostgREST can only target a plain unique index. Lite rows leave
-- it null, and nulls never collide.
--
-- An earlier version of this migration had no such index, and its route logged
-- a row per retry, so one account can already have several. Building the index
-- over those would fail and roll the whole migration back; keep the oldest.
delete from public.userbase_invites dup
using public.userbase_invites keep
where dup.hive_username is not null
  and dup.hive_username = keep.hive_username
  and (dup.created_at, dup.id) > (keep.created_at, keep.id);

create unique index if not exists userbase_invites_hive_username_key
  on public.userbase_invites(hive_username);

alter table public.userbase_invites enable row level security;
alter table public.userbase_invites force row level security;

drop policy if exists "Service role can manage userbase_invites"
  on public.userbase_invites;

create policy "Service role can manage userbase_invites"
  on public.userbase_invites
  for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

revoke all on table public.userbase_invites from anon, authenticated;

-- Count-and-claim one lite invite slot as a single step.
--
-- Counting from the route and inserting afterwards left a gap: N requests fired
-- together all read the same count, all passed, and all sent — the daily cap
-- held only for senders polite enough to wait. The advisory lock serialises
-- each inviter's reservations for the length of this transaction, so the count
-- a request sees always includes every slot claimed before it. Different
-- inviters never wait on each other.
--
-- Returns one row: the new reservation id, or null when the cap is spent, and
-- how many slots were already in use.
create or replace function public.userbase_reserve_invite(
  p_inviter uuid,
  p_invitee_email text,
  p_invitee_user_id uuid,
  p_limit integer,
  p_window_hours integer
)
returns table (reservation_id uuid, used integer)
language plpgsql
set search_path = public
as $$
declare
  v_used integer;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('userbase_invites:' || p_inviter::text, 0)
  );

  select count(*)::integer into v_used
  from public.userbase_invites i
  where i.inviter_user_id = p_inviter
    and i.created_at >= now() - make_interval(hours => p_window_hours);

  if v_used >= p_limit then
    return query select null::uuid, v_used;
    return;
  end if;

  return query
    insert into public.userbase_invites
      (inviter_user_id, kind, invitee_email, invitee_user_id)
    values
      (p_inviter, 'lite', p_invitee_email, p_invitee_user_id)
    returning userbase_invites.id, v_used;
end;
$$;

revoke all on function public.userbase_reserve_invite(uuid, text, uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.userbase_reserve_invite(uuid, text, uuid, integer, integer)
  to service_role;

commit;
