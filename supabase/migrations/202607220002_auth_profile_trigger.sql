-- Create a non-privileged profile whenever Supabase Auth creates a user.
-- Promote trusted users to admin explicitly after creation.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, role)
  values (new.id, nullif(lower(new.raw_user_meta_data ->> 'username'), ''), 'editor')
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
