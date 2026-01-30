-- 0016_userbase_hive_keys.sql
-- Encrypted Hive posting keys for sponsored or manually linked accounts

create table if not exists public.userbase_hive_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.userbase_users(id) on delete cascade,
  hive_username text not null,
  encrypted_posting_key text not null,
  encryption_iv text not null,
  encryption_auth_tag text not null,
  key_type text not null default 'sponsored' check (key_type in ('sponsored', 'user_provided')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique(user_id)
);

-- Index for looking up by Hive username
create index if not exists userbase_hive_keys_hive_username_idx
on public.userbase_hive_keys(lower(hive_username));

-- Index for tracking key usage
create index if not exists userbase_hive_keys_last_used_at_idx
on public.userbase_hive_keys(last_used_at desc nulls last);

-- Index for finding sponsored keys
create index if not exists userbase_hive_keys_key_type_idx
on public.userbase_hive_keys(key_type)
where key_type = 'sponsored';

comment on table public.userbase_hive_keys is 'Encrypted Hive posting keys for sponsored accounts or manually linked accounts';
comment on column public.userbase_hive_keys.user_id is 'The userbase user who owns this key (unique constraint - one key per user)';
comment on column public.userbase_hive_keys.hive_username is 'The Hive account username this key belongs to';
comment on column public.userbase_hive_keys.encrypted_posting_key is 'AES-256-GCM encrypted posting key (base64)';
comment on column public.userbase_hive_keys.encryption_iv is 'Initialization vector for AES-GCM (base64, 12 bytes)';
comment on column public.userbase_hive_keys.encryption_auth_tag is 'Authentication tag for AES-GCM (base64, 16 bytes)';
comment on column public.userbase_hive_keys.key_type is 'Source of the key: sponsored (created via sponsorship) or user_provided (manually set)';
comment on column public.userbase_hive_keys.last_used_at is 'Last time this key was used to sign a transaction';
