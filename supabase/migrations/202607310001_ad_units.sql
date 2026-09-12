-- Provider-agnostic ad areas: each placement stores raw code from any ad
-- network instead of being hardcoded to Google AdSense.
create table if not exists public.ad_units (
  placement text primary key,
  name text not null default '',
  code text not null default '',
  adsense_slot text not null default '',
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

drop trigger if exists ad_units_updated on public.ad_units;
create trigger ad_units_updated before update on public.ad_units for each row execute procedure public.set_updated_at();

alter table public.ad_units enable row level security;

drop policy if exists "Public can read ad units" on public.ad_units;
create policy "Public can read ad units" on public.ad_units for select using (true);

drop policy if exists "Editors manage ad units" on public.ad_units;
create policy "Editors manage ad units" on public.ad_units for all using (public.is_admin()) with check (public.is_admin());

-- Extra ads.txt lines so non-AdSense networks can be authorised too.
alter table public.site_settings add column if not exists ads_txt text not null default '';
