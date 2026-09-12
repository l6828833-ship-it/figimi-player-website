-- Figimi Tools initial Supabase schema
create extension if not exists pgcrypto;

create type public.post_status as enum ('draft', 'scheduled', 'published');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  role text not null default 'editor' check (role in ('editor', 'admin')),
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  meta_description text not null default '' check (char_length(meta_description) <= 320),
  seo_title text,
  featured_image text,
  featured_image_alt text not null default '',
  og_image text,
  category text not null default 'Guides',
  tags text[] not null default '{}',
  author text not null default 'Figimi Editorial',
  body text not null default '',
  status public.post_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publication_date_required check (status = 'draft' or published_at is not null)
);
create index posts_publication_idx on public.posts(status, published_at desc);

create table public.tool_pages (
  slug text primary key check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  description text not null default '',
  intro text not null default '',
  how_to jsonb not null default '[]'::jsonb check (jsonb_typeof(how_to) = 'array'),
  faq jsonb not null default '[]'::jsonb check (jsonb_typeof(faq) = 'array'),
  seo_title text not null default '',
  seo_description text not null default '' check (char_length(seo_description) <= 320),
  og_image text,
  updated_at timestamptz not null default now()
);

create table public.content_pages (
  slug text primary key,
  title text not null,
  description text not null default '',
  body text not null default '',
  seo_title text,
  og_image text,
  updated_at timestamptz not null default now()
);

create table public.site_settings (
  id smallint primary key default 1 check (id = 1),
  analytics_id text not null default '',
  adsense_client_id text not null default '',
  google_tag_id text not null default '',
  head_code text not null default '',
  body_code text not null default '',
  updated_at timestamptz not null default now()
);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  path text not null unique,
  url text not null,
  alt_text text not null default '',
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger posts_updated before update on public.posts for each row execute procedure public.set_updated_at();
create trigger tools_updated before update on public.tool_pages for each row execute procedure public.set_updated_at();
create trigger content_updated before update on public.content_pages for each row execute procedure public.set_updated_at();
create trigger settings_updated before update on public.site_settings for each row execute procedure public.set_updated_at();

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.profiles where id = auth.uid() and role in ('admin','editor')) $$;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.tool_pages enable row level security;
alter table public.content_pages enable row level security;
alter table public.site_settings enable row level security;
alter table public.media enable row level security;

create policy "Public can read due posts" on public.posts for select using (status = 'published' or (status = 'scheduled' and published_at <= now()) or public.is_admin());
create policy "Public can read tool pages" on public.tool_pages for select using (true);
create policy "Public can read content pages" on public.content_pages for select using (true);
create policy "Public can read site settings" on public.site_settings for select using (true);
create policy "Editors manage posts" on public.posts for all using (public.is_admin()) with check (public.is_admin());
create policy "Editors manage tools" on public.tool_pages for all using (public.is_admin()) with check (public.is_admin());
create policy "Editors manage content" on public.content_pages for all using (public.is_admin()) with check (public.is_admin());
create policy "Editors manage settings" on public.site_settings for all using (public.is_admin()) with check (public.is_admin());
create policy "Editors read profiles" on public.profiles for select using (public.is_admin());
create policy "Admins manage media records" on public.media for all using (public.is_admin()) with check (public.is_admin());
create policy "Public can read media records" on public.media for select using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy "Public media read" on storage.objects for select using (bucket_id = 'media');
create policy "Editors upload media" on storage.objects for insert with check (bucket_id = 'media' and public.is_admin());
create policy "Editors update media" on storage.objects for update using (bucket_id = 'media' and public.is_admin());
create policy "Editors delete media" on storage.objects for delete using (bucket_id = 'media' and public.is_admin());

insert into public.site_settings (id) values (1) on conflict do nothing;
