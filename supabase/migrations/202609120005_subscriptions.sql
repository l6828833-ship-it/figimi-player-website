-- Subscriptions: the player is sold per device, and a playlist can carry its own
-- shorter term (for example a reseller's one-month line on a device with a year left).
-- Both are nullable: null means "no expiry recorded", which is treated as active so
-- existing devices are not locked out by this migration.

alter table public.iptv_devices add column if not exists plan text not null default 'trial'
  check (plan in ('trial', 'paid', 'lifetime'));
alter table public.iptv_devices add column if not exists subscription_expires_at timestamptz;
alter table public.iptv_devices add column if not exists activated_at timestamptz;
alter table public.iptv_devices add column if not exists notes text;

-- Per-playlist expiry, independent of the device's own subscription.
alter table public.iptv_device_playlists add column if not exists expires_at timestamptz;

create index if not exists iptv_devices_subscription_expiry
  on public.iptv_devices(subscription_expires_at);
create index if not exists iptv_device_playlists_expiry
  on public.iptv_device_playlists(expires_at);

-- Devices that predate this migration get the standard trial window from their first
-- sign-in, so the dashboard has a date to show instead of an empty state.
update public.iptv_devices
set subscription_expires_at = coalesce(first_seen_at, now()) + interval '7 days',
    activated_at = coalesce(activated_at, first_seen_at, now())
where subscription_expires_at is null;
