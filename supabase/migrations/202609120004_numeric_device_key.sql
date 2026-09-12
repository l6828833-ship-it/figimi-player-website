-- A 6-digit device key is only a million combinations, so failed sign-ins are
-- counted per device and the device locks temporarily. Without this the key would
-- be brute-forceable in minutes.
alter table public.iptv_devices add column if not exists failed_attempts integer not null default 0;
alter table public.iptv_devices add column if not exists locked_until timestamptz;

-- Playlists are added as an M3U link or an Xtream login. 'upload' stays permitted
-- only so rows created by the earlier file-upload flow remain valid; the API no
-- longer creates them.
alter table public.iptv_device_playlists drop constraint if exists iptv_device_playlists_source_type_check;
alter table public.iptv_device_playlists add constraint iptv_device_playlists_source_type_check
  check (source_type in ('url', 'xtream', 'upload'));
