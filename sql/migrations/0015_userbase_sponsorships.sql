-- 0015_userbase_sponsorships.sql
-- Sponsorship system: tracks Hive account creation sponsorships from OG users to lite accounts

create table if not exists public.userbase_sponsorships (
  id uuid primary key default gen_random_uuid(),
  lite_user_id uuid not null references public.userbase_users(id) on delete cascade,
  sponsor_user_id uuid not null references public.userbase_users(id) on delete set null,
  hive_username text not null,
  cost_type text not null check (cost_type in ('hive_transfer', 'account_token')),
  cost_amount numeric(10,3),
  hive_tx_id text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(lite_user_id)
);

-- Index for finding pending sponsorships to process
create index if not exists userbase_sponsorships_status_idx
on public.userbase_sponsorships(status, created_at)
where status = 'pending';

-- Index for finding sponsorships by sponsor (for leaderboard, user stats)
create index if not exists userbase_sponsorships_sponsor_user_id_idx
on public.userbase_sponsorships(sponsor_user_id);

-- Index for recent sponsorships (for feed, activity tracking)
create index if not exists userbase_sponsorships_created_at_idx
on public.userbase_sponsorships(created_at desc);

-- Index for looking up sponsorship by Hive username
create index if not exists userbase_sponsorships_hive_username_idx
on public.userbase_sponsorships(lower(hive_username));

-- Add sponsorship tracking columns to identities table
alter table public.userbase_identities
  add column if not exists is_sponsored boolean default false,
  add column if not exists sponsor_user_id uuid references public.userbase_users(id) on delete set null;

-- Index for finding sponsored identities
create index if not exists userbase_identities_sponsored_idx
on public.userbase_identities(is_sponsored)
where is_sponsored = true;

-- Index for finding identities by sponsor
create index if not exists userbase_identities_sponsor_user_id_idx
on public.userbase_identities(sponsor_user_id)
where sponsor_user_id is not null;

comment on table public.userbase_sponsorships is 'Tracks Hive account sponsorships where OG users sponsor lite accounts';
comment on column public.userbase_sponsorships.lite_user_id is 'The lite account being sponsored';
comment on column public.userbase_sponsorships.sponsor_user_id is 'The OG user providing the sponsorship (nullable if sponsor deleted)';
comment on column public.userbase_sponsorships.hive_username is 'The Hive username created for the sponsored account';
comment on column public.userbase_sponsorships.cost_type is 'Payment method: hive_transfer (3 HIVE) or account_token (RC delegation)';
comment on column public.userbase_sponsorships.cost_amount is 'Amount in HIVE if using hive_transfer method';
comment on column public.userbase_sponsorships.hive_tx_id is 'Hive blockchain transaction ID for the account creation';
comment on column public.userbase_sponsorships.status is 'Processing status: pending → processing → completed/failed';
