-- Payments are recorded per device so the admin panel can answer "who paid, how much,
-- and until when" from one place. Amounts are stored in the currency they were taken in
-- rather than converted, because a reseller taking cash in two currencies would otherwise
-- see invented totals.
--
-- This table is a ledger of what the operator collected outside the site (cash, transfer,
-- PayPal, card terminal). It is not a payment gateway and holds no card data.

create table if not exists public.iptv_device_payments (
  id uuid primary key default gen_random_uuid(),
  device_mac text not null check (device_mac ~ '^[0-9A-F]{2}(:[0-9A-F]{2}){5}$'),
  amount numeric(10, 2) not null check (amount >= 0 and amount <= 100000),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  method text not null default 'cash' check (method in ('cash', 'card', 'paypal', 'bank', 'crypto', 'reseller', 'other')),
  months integer not null default 0 check (months >= 0 and months <= 120),
  status text not null default 'paid' check (status in ('paid', 'pending', 'refunded')),
  reference text check (reference is null or char_length(reference) <= 120),
  note text check (note is null or char_length(note) <= 500),
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists iptv_device_payments_mac_paid
  on public.iptv_device_payments(device_mac, paid_at desc);
create index if not exists iptv_device_payments_paid_at
  on public.iptv_device_payments(paid_at desc);

-- A human name for the customer, shown beside the MAC in the admin panel. The column
-- already exists on older installs; this keeps fresh databases in step.
alter table public.iptv_devices add column if not exists label text;

alter table public.iptv_device_payments enable row level security;

-- No public policy: only the service-role backend (admin panel server actions) reads or
-- writes this ledger. Customers never see other people's payments.
