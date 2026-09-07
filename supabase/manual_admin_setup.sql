-- Run this in the Supabase SQL editor as postgres.
-- Replace the email with the admin account you want to restore.

with target_user as (
  select id
  from auth.users
  where email = 'admin@gmail.com'
  limit 1
)
insert into public.admin_roles (user_id, role)
select id, 'admin'
from target_user
on conflict (user_id) do update
set role = excluded.role,
    created_at = now();

-- If the auth user does not exist yet, create the account first through the auth UI or sign-up flow.
