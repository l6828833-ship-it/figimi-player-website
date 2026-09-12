-- Device-key login for the website playlist dashboard, plus Xtream playlist sources.
-- Sessions store only a SHA-256 hash of the bearer token.

create table if not exists public.iptv_devices (
  device_mac text primary key check (device_mac ~ '^[0-9A-F]{2}(:[0-9A-F]{2}){5}$'),
  label text,
  disabled boolean not null default false,
  login_count integer not null default 0,
  first_seen_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.iptv_device_sessions (
  token_hash text primary key,
  device_mac text not null check (device_mac ~ '^[0-9A-F]{2}(:[0-9A-F]{2}){5}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists iptv_device_sessions_mac on public.iptv_device_sessions(device_mac);
create index if not exists iptv_device_sessions_expiry on public.iptv_device_sessions(expires_at);

-- Xtream logins join uploaded files and remote M3U URLs as a playlist source.
alter table public.iptv_device_playlists drop constraint if exists iptv_device_playlists_source_type_check;
alter table public.iptv_device_playlists add constraint iptv_device_playlists_source_type_check
  check (source_type in ('upload', 'url', 'xtream'));

-- Unguessable per-playlist token so the TV endpoint cannot be enumerated from a MAC alone.
alter table public.iptv_device_playlists add column if not exists access_token text;
update public.iptv_device_playlists set access_token = encode(gen_random_bytes(16), 'hex') where access_token is null;
alter table public.iptv_device_playlists alter column access_token set not null;

alter table public.iptv_devices enable row level security;
alter table public.iptv_device_sessions enable row level security;
