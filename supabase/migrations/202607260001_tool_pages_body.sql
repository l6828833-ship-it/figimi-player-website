-- Add a free-form Markdown content body to tool pages.
-- This lets editors add substantial, unique SEO content to each tool page
-- (beyond the short intro, how-to steps, and FAQ) directly from the admin.
alter table public.tool_pages
  add column if not exists body text not null default '';
