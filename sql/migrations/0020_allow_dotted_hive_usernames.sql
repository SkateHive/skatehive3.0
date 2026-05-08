-- 0020_allow_dotted_hive_usernames.sql
-- Allow valid Hive usernames that contain dots, e.g. couzzi.skt

ALTER TABLE public.userbase_hive_keys
DROP CONSTRAINT IF EXISTS valid_hive_username;

ALTER TABLE public.userbase_hive_keys
ADD CONSTRAINT valid_hive_username
CHECK (
  hive_username ~* '^[a-z0-9][a-z0-9.-]{1,14}[a-z0-9]$' AND
  hive_username !~ '\.\.' AND
  LENGTH(hive_username) BETWEEN 3 AND 16
);

COMMENT ON CONSTRAINT valid_hive_username ON public.userbase_hive_keys IS
'Validates Hive username format (3-16 chars, lowercase, numbers, dashes, dots; no leading/trailing dot and no double dots)';

ALTER TABLE public.userbase_sponsorships
DROP CONSTRAINT IF EXISTS valid_sponsorship_hive_username;

ALTER TABLE public.userbase_sponsorships
ADD CONSTRAINT valid_sponsorship_hive_username
CHECK (
  hive_username ~* '^[a-z0-9][a-z0-9.-]{1,14}[a-z0-9]$' AND
  hive_username !~ '\.\.' AND
  LENGTH(hive_username) BETWEEN 3 AND 16
);

COMMENT ON CONSTRAINT valid_sponsorship_hive_username ON public.userbase_sponsorships IS
'Validates sponsored Hive username format (3-16 chars, lowercase, numbers, dashes, dots; no leading/trailing dot and no double dots)';
