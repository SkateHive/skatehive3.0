-- 0016_userbase_hive_keys_rls.sql
-- RLS for userbase_hive_keys (strict security for encrypted keys)

alter table public.userbase_hive_keys enable row level security;
alter table public.userbase_hive_keys force row level security;

-- Service role can manage all keys (for encryption/decryption during posting)
create policy "Service role can manage userbase_hive_keys" on public.userbase_hive_keys
  for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- Users can view their own key metadata (but NOT the encrypted key itself via client)
-- Note: This is for displaying account status in settings, not for decryption
create policy "Users can view their own key info" on public.userbase_hive_keys
  for select
  using (auth.uid()::text = user_id::text);

-- Revoke all default permissions from anon and authenticated
-- Only service role should have access to encrypted keys
revoke all on table public.userbase_hive_keys from anon, authenticated;

-- Grant minimal select to authenticated users (for viewing their own metadata)
-- Actual key decryption happens server-side only via service role
grant select (id, user_id, hive_username, key_type, created_at, updated_at, last_used_at)
  on table public.userbase_hive_keys to authenticated;

comment on policy "Service role can manage userbase_hive_keys" on public.userbase_hive_keys is
  'Service role has full access for server-side encryption/decryption operations';

comment on policy "Users can view their own key info" on public.userbase_hive_keys is
  'Users can view metadata about their keys but not the encrypted values (server-side only)';
