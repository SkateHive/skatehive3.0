-- Disable partner logins and revert the API context filter before rollback.
-- Do not turn partner codes into first-party codes by dropping their scope.
begin;
delete from public.userbase_email_otps where app_id <> '';
drop index if exists public.idx_userbase_email_otps_app_email_created;
alter table public.userbase_email_otps drop column if exists app_id;
commit;
