-- 0034_userbase_invites.sql
-- ⚠ APPLY MANUALLY in the Supabase SQL editor — this repo has no migration
--   runner. Until this runs, /api/userbase/invites returns 503 and the Hive
--   flow simply logs no attribution; neither one breaks.
-- Invite attribution, for both paths out of /invite:
--   * lite  — a Skatehive account created for a friend, who logs in by email
--   * hive  — a real Hive account paid for and signed by the inviter
-- Before this, nothing recorded who brought whom in. The lite path also needs
-- it as its rate-limit source: counting a sender's rows over the last day is
-- the only cap that holds across serverless instances.

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
  created_at timestamptz not null default now()
);

-- Rate limit fast path: a sender's invites inside the trailing window.
create index if not exists userbase_invites_inviter_recent_idx
  on public.userbase_invites(inviter_user_id, created_at desc);

-- "Who did this account bring in", and the reverse lookup from an invitee.
create index if not exists userbase_invites_invitee_idx
  on public.userbase_invites(invitee_user_id)
  where invitee_user_id is not null;

alter table public.userbase_invites enable row level security;
alter table public.userbase_invites force row level security;

create policy "Service role can manage userbase_invites"
  on public.userbase_invites
  for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

revoke all on table public.userbase_invites from anon, authenticated;
