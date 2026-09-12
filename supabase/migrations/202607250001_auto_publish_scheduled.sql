-- Automatically publish scheduled posts once their publish time has passed.
-- Requires the pg_cron extension. In Supabase: Database -> Extensions -> enable "pg_cron",
-- then run this migration (SQL editor or CLI).

create extension if not exists pg_cron;

-- Promote any scheduled post whose publish time has arrived.
create or replace function public.publish_due_scheduled_posts()
returns void
language sql
security definer
set search_path = public
as $$
  update public.posts
     set status = 'published'
   where status = 'scheduled'
     and published_at is not null
     and published_at <= now();
$$;

-- Schedule it to run every 5 minutes (re-runnable: removes an existing job first).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'publish-due-scheduled-posts') then
    perform cron.unschedule('publish-due-scheduled-posts');
  end if;
end $$;

select cron.schedule(
  'publish-due-scheduled-posts',
  '*/5 * * * *',
  $$select public.publish_due_scheduled_posts();$$
);
