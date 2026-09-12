-- ============================================================================
-- Promote a Supabase Auth user to the "admin" role for the Figimi admin panel.
-- ============================================================================
--
-- IMPORTANT: run these FIRST, in this exact order, or you'll get
-- 'relation "public.profiles" does not exist':
--   1. supabase/migrations/202607220001_initial_schema.sql   (creates tables)
--   2. supabase/migrations/202607220002_auth_profile_trigger.sql
--   3. supabase/seed.sql                                     (page content)
--   4. Supabase dashboard -> Authentication -> Providers -> enable "Email".
--   5. Authentication -> Users -> "Add user" -> create your account.
--
-- Then replace the email below with your real login email and run this file
-- in the Supabase SQL editor.
--
-- This insert-or-update works whether or not the profile row already exists
-- (so it's safe even if the account was created before the trigger).
-- ----------------------------------------------------------------------------

insert into public.profiles (id, username, role)
select u.id, 'admin', 'admin'
from auth.users u
where u.email = 'you@example.com'
on conflict (id) do update
  set role = 'admin',
      username = coalesce(public.profiles.username, 'admin');

-- Verify it worked (should show one row with role = admin):
select p.id, u.email, p.username, p.role
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'you@example.com';
