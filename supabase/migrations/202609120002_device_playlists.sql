-- MAC-linked playlists managed from the Figimi website.
-- Playlist contents and source URLs are encrypted by the Cloud Run API.
-- RLS is enabled without public policies; only the service-role backend accesses these tables.

create table if not exists public.iptv_device_playlists (
  id uuid primary key default gen_random_uuid(),
  device_mac text not null check (device_mac ~ '^[0-9A-F]{2}(:[0-9A-F]{2}){5}$'),
  name text not null check (char_length(name) between 1 and 120),
  source_type text not null check (source_type in ('upload', 'url')),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  access_count integer not null default 0,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(device_mac, name)
);

create table if not exists public.iptv_device_playlist_secrets (
  playlist_id uuid primary key references public.iptv_device_playlists(id) on delete cascade,
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  key_version integer not null default 1,
  updated_at timestamptz not null default now()
);

create index if not exists iptv_device_playlists_mac_order
  on public.iptv_device_playlists(device_mac, enabled, sort_order, created_at);
create index if not exists iptv_device_playlists_last_accessed
  on public.iptv_device_playlists(last_accessed_at desc);

create or replace function public.touch_iptv_device_playlist_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists iptv_device_playlists_updated_at on public.iptv_device_playlists;
create trigger iptv_device_playlists_updated_at before update on public.iptv_device_playlists
for each row execute function public.touch_iptv_device_playlist_updated_at();

drop trigger if exists iptv_device_playlist_secrets_updated_at on public.iptv_device_playlist_secrets;
create trigger iptv_device_playlist_secrets_updated_at before update on public.iptv_device_playlist_secrets
for each row execute function public.touch_iptv_device_playlist_updated_at();

alter table public.iptv_device_playlists enable row level security;
alter table public.iptv_device_playlist_secrets enable row level security;
