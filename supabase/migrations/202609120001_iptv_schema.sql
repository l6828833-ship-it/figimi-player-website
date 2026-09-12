-- Figimi IPTV catalog and provider schema.
-- Provider credentials and stream locators are encrypted by the Cloud Run API.
-- No public RLS policy is created for these tables; API access is intentional.

create table if not exists public.iptv_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('m3u', 'xtream')),
  endpoint text not null,
  enabled boolean not null default true,
  sync_status text not null default 'never' check (sync_status in ('never', 'syncing', 'ready', 'error')),
  sync_error text,
  last_sync_at timestamptz,
  title_count integer not null default 0,
  category_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.iptv_provider_secrets (
  provider_id uuid primary key references public.iptv_providers(id) on delete cascade,
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  key_version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.iptv_categories (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.iptv_providers(id) on delete cascade,
  name text not null,
  slug text not null,
  kind text not null check (kind in ('live', 'movie', 'series')),
  sort_order integer not null default 0,
  title_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique(provider_id, slug, kind)
);

create table if not exists public.iptv_titles (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.iptv_providers(id) on delete cascade,
  category_id uuid references public.iptv_categories(id) on delete set null,
  external_id text not null,
  kind text not null check (kind in ('live', 'movie', 'series')),
  title text not null,
  slug text not null,
  poster_url text,
  group_name text,
  epg_id text,
  sort_order integer not null default 0,
  locator_ciphertext text not null,
  locator_iv text not null,
  locator_auth_tag text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_id, external_id, kind)
);

create index if not exists iptv_categories_provider_kind_order
  on public.iptv_categories(provider_id, kind, sort_order);
create index if not exists iptv_titles_provider_kind_order
  on public.iptv_titles(provider_id, kind, sort_order);
create index if not exists iptv_titles_category_order
  on public.iptv_titles(category_id, sort_order);
create index if not exists iptv_titles_search
  on public.iptv_titles using gin (to_tsvector('simple', title || ' ' || coalesce(group_name, '')));

create or replace function public.touch_iptv_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists iptv_providers_updated_at on public.iptv_providers;
create trigger iptv_providers_updated_at before update on public.iptv_providers
for each row execute function public.touch_iptv_updated_at();
drop trigger if exists iptv_titles_updated_at on public.iptv_titles;
create trigger iptv_titles_updated_at before update on public.iptv_titles
for each row execute function public.touch_iptv_updated_at();

alter table public.iptv_providers enable row level security;
alter table public.iptv_provider_secrets enable row level security;
alter table public.iptv_categories enable row level security;
alter table public.iptv_titles enable row level security;

-- Only the service-role backend reads/writes provider and title data. The frontend
-- never queries these tables directly, preventing secret bypass and enforcing one
-- API boundary for catalog/playback authorization.
