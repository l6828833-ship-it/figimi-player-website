import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, normalizeMac } from "./mac";
import { daysUntil, isExpired, TRIAL_DAYS } from "./devices";

/** Offered as buttons in the admin panel, so the common terms need no date picking. */
export const SUBSCRIPTION_PRESETS = [
  { months: 1, label: "1 month" },
  { months: 2, label: "2 months" },
  { months: 3, label: "3 months" },
  { months: 4, label: "4 months" },
  { months: 5, label: "5 months" },
  { months: 6, label: "6 months" },
  { months: 7, label: "7 months" },
  { months: 8, label: "8 months" },
  { months: 9, label: "9 months" },
  { months: 10, label: "10 months" },
  { months: 11, label: "11 months" },
  { months: 12, label: "1 year" },
  { months: 24, label: "2 years" },
] as const;

export type AdminDevice = {
  mac: string;
  label: string | null;
  plan: string;
  subscriptionExpiresAt: string | null;
  daysRemaining: number | null;
  expired: boolean;
  blocked: boolean;
  loginCount: number;
  lastLoginAt: string | null;
  firstSeenAt: string | null;
  notes: string | null;
  playlistCount: number;
};

/** The tabs above the devices table; "expiring" is the list an operator chases for renewals. */
export const DEVICE_FILTERS = ["all", "active", "expiring", "trial", "expired", "blocked", "lifetime"] as const;
export type DeviceFilter = (typeof DEVICE_FILTERS)[number];

const SELECT = "device_mac,label,plan,subscription_expires_at,disabled,login_count,last_login_at,first_seen_at,notes";

function toAdminDevice(device: Record<string, unknown>, playlistCount: number): AdminDevice {
  const expiresAt = (device.subscription_expires_at as string | null) ?? null;
  return {
    mac: device.device_mac as string,
    label: (device.label as string | null) ?? null,
    plan: (device.plan as string) || "trial",
    subscriptionExpiresAt: expiresAt,
    daysRemaining: daysUntil(expiresAt),
    expired: isExpired(expiresAt),
    blocked: Boolean(device.disabled),
    loginCount: Number(device.login_count || 0),
    lastLoginAt: (device.last_login_at as string | null) ?? null,
    firstSeenAt: (device.first_seen_at as string | null) ?? null,
    notes: (device.notes as string | null) ?? null,
    playlistCount,
  };
}

export function matchesFilter(device: AdminDevice, filter: DeviceFilter): boolean {
  switch (filter) {
    case "active":
      return !device.blocked && !device.expired;
    case "expiring":
      return !device.blocked && !device.expired && device.plan !== "lifetime" && device.daysRemaining !== null && device.daysRemaining <= 7;
    case "trial":
      return device.plan === "trial" && !device.blocked;
    case "expired":
      return device.expired && !device.blocked;
    case "blocked":
      return device.blocked;
    case "lifetime":
      return device.plan === "lifetime";
    default:
      return true;
  }
}

/**
 * Search and filter applied in memory rather than in SQL.
 *
 * The table is one row per TV sold, so a single read serves the list, the filter counts,
 * and the dashboard at once; querying per tab would mean several round trips for the
 * same rows. Search deliberately ignores MAC separators so `001a79` finds `00:1A:79:…`.
 */
export function filterDevices(devices: AdminDevice[], options: { search?: string; filter?: DeviceFilter } = {}): AdminDevice[] {
  let rows = devices;

  const search = options.search?.trim().toLowerCase();
  if (search) {
    const compact = search.replace(/[.\-:\s]/g, "");
    rows = rows.filter((device) =>
      device.mac.toLowerCase().replace(/:/g, "").includes(compact) ||
      (device.label || "").toLowerCase().includes(search) ||
      (device.notes || "").toLowerCase().includes(search));
  }

  const filter = options.filter || "all";
  if (filter !== "all") rows = rows.filter((device) => matchesFilter(device, filter));
  return rows;
}

export async function listDevices(options: { search?: string; filter?: DeviceFilter } = {}): Promise<AdminDevice[]> {
  const client = createAdminClient();
  const [{ data: devices, error }, { data: playlists }] = await Promise.all([
    client.from("iptv_devices").select(SELECT).order("last_login_at", { ascending: false, nullsFirst: false }),
    client.from("iptv_device_playlists").select("device_mac"),
  ]);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of playlists || []) counts.set(row.device_mac, (counts.get(row.device_mac) || 0) + 1);

  const rows = (devices || []).map((device) => toAdminDevice(device, counts.get(device.device_mac as string) || 0));
  return filterDevices(rows, options);
}

export type AdminDeviceDetail = AdminDevice & {
  activatedAt: string | null;
  lockedUntil: string | null;
  sessionCount: number;
  playlists: {
    id: string;
    name: string;
    sourceType: string;
    enabled: boolean;
    accessCount: number;
    lastAccessedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
  }[];
};

export async function getDevice(macValue: string): Promise<AdminDeviceDetail | null> {
  const mac = normalizeMac(macValue);
  const client = createAdminClient();
  const [{ data: device }, { data: playlists }, { count: sessionCount }] = await Promise.all([
    client.from("iptv_devices").select(`${SELECT},activated_at,locked_until`).eq("device_mac", mac).maybeSingle(),
    // Never selects the encrypted source or access token: playlist secrets must not
    // reach the admin browser.
    client.from("iptv_device_playlists").select("id,name,source_type,enabled,access_count,last_accessed_at,expires_at,created_at").eq("device_mac", mac).order("created_at", { ascending: false }),
    client.from("iptv_device_sessions").select("token_hash", { count: "exact", head: true }).eq("device_mac", mac),
  ]);
  if (!device) return null;

  const rows = playlists || [];
  return {
    ...toAdminDevice(device, rows.length),
    activatedAt: (device.activated_at as string | null) ?? null,
    lockedUntil: (device.locked_until as string | null) ?? null,
    sessionCount: sessionCount || 0,
    playlists: rows.map((playlist) => ({
      id: playlist.id as string,
      name: playlist.name as string,
      sourceType: playlist.source_type as string,
      enabled: Boolean(playlist.enabled),
      accessCount: Number(playlist.access_count || 0),
      lastAccessedAt: (playlist.last_accessed_at as string | null) ?? null,
      expiresAt: (playlist.expires_at as string | null) ?? null,
      createdAt: playlist.created_at as string,
    })),
  };
}

/**
 * Moves a device's term by [months]: positive adds, negative takes away.
 *
 * Adding works from the current expiry while the subscription is still running, so
 * renewing early never costs the customer days they already paid for; an expired or new
 * device starts from today instead.
 *
 * Removing works from the current expiry too, and is floored at today — a term can be cut
 * back to "ends now" but never to a date in the past, which would report a nonsense
 * "expired 3 months ago" on the TV. Taking months off a lifetime device ends it now,
 * since a lifetime has no date to subtract from.
 */
export async function adjustSubscription(macValue: string, months: number) {
  const mac = normalizeMac(macValue);
  if (!Number.isInteger(months) || months === 0 || Math.abs(months) > 120) {
    throw new ApiError("Enter a whole number of months from -120 to 120, and not 0.", 400);
  }

  const client = createAdminClient();
  const { data: device } = await client.from("iptv_devices").select("subscription_expires_at,plan").eq("device_mac", mac).maybeSingle();

  const now = new Date();
  const current = device?.subscription_expires_at ? new Date(device.subscription_expires_at as string) : null;
  const start = current && current.getTime() > now.getTime() ? current : now;
  const next = new Date(start);
  next.setMonth(next.getMonth() + months);
  const capped = next.getTime() < now.getTime() ? now : next;

  const { error } = await client.from("iptv_devices").upsert(
    // Paying for months makes a device paid. Taking months off leaves the plan as it was,
    // except for lifetime, which stops being a lifetime the moment it has an end date.
    { device_mac: mac, plan: months > 0 ? "paid" : device?.plan === "lifetime" ? "paid" : device?.plan || "trial", subscription_expires_at: capped.toISOString() },
    { onConflict: "device_mac" },
  );
  if (error) throw error;
  return capped.toISOString();
}

export async function setLifetime(macValue: string) {
  const mac = normalizeMac(macValue);
  const { error } = await createAdminClient().from("iptv_devices").upsert(
    { device_mac: mac, plan: "lifetime", subscription_expires_at: null },
    { onConflict: "device_mac" },
  );
  if (error) throw error;
}

/** Ends the term now, without deleting the device or its playlists. */
export async function expireNow(macValue: string) {
  const mac = normalizeMac(macValue);
  const { error } = await createAdminClient()
    .from("iptv_devices")
    .update({ subscription_expires_at: new Date().toISOString() })
    .eq("device_mac", mac);
  if (error) throw error;
}

export async function setBlocked(macValue: string, blocked: boolean) {
  const mac = normalizeMac(macValue);
  const client = createAdminClient();
  const { error } = await client.from("iptv_devices").upsert({ device_mac: mac, disabled: blocked }, { onConflict: "device_mac" });
  if (error) throw error;
  // Blocking also drops live sessions, otherwise an already signed-in dashboard keeps
  // working until its token expires.
  if (blocked) await client.from("iptv_device_sessions").delete().eq("device_mac", mac);
}

/**
 * Removes the device record and its playlists.
 *
 * Note this does not stop a blocked device from returning: the row is recreated on next
 * contact with a fresh trial. Blocking is the tool for shutting a device out; deletion is
 * for clearing test data.
 */
export async function deleteDevice(macValue: string) {
  const mac = normalizeMac(macValue);
  const client = createAdminClient();
  await client.from("iptv_device_playlists").delete().eq("device_mac", mac);
  await client.from("iptv_device_sessions").delete().eq("device_mac", mac);
  const { error } = await client.from("iptv_devices").delete().eq("device_mac", mac);
  if (error) throw error;
}

/**
 * Registers a TV before it ever contacts the service, so a customer can be sold a term
 * in the shop and find the app already activated on first boot.
 */
export async function createDevice(macValue: string, months: number, label?: string) {
  const mac = normalizeMac(macValue);
  const client = createAdminClient();
  const { data: existing } = await client.from("iptv_devices").select("device_mac").eq("device_mac", mac).maybeSingle();
  if (existing) throw new ApiError("That device already exists. Open it to change its subscription.", 409);

  const now = new Date();
  const expires = new Date(now);
  if (months > 0) expires.setMonth(expires.getMonth() + months);
  else expires.setTime(now.getTime() + TRIAL_DAYS * 86_400_000);

  const { error } = await client.from("iptv_devices").insert({
    device_mac: mac,
    label: label?.trim().slice(0, 120) || null,
    plan: months > 0 ? "paid" : "trial",
    activated_at: now.toISOString(),
    first_seen_at: now.toISOString(),
    subscription_expires_at: expires.toISOString(),
  });
  if (error) throw error;
  return mac;
}

/** The customer name shown beside the MAC; a MAC alone is impossible to recognise. */
export async function setLabel(macValue: string, label: string) {
  const mac = normalizeMac(macValue);
  const { error } = await createAdminClient()
    .from("iptv_devices")
    .upsert({ device_mac: mac, label: label.trim().slice(0, 120) || null }, { onConflict: "device_mac" });
  if (error) throw error;
}

export async function setNotes(macValue: string, notes: string) {
  const mac = normalizeMac(macValue);
  const { error } = await createAdminClient()
    .from("iptv_devices")
    .upsert({ device_mac: mac, notes: notes.trim().slice(0, 500) || null }, { onConflict: "device_mac" });
  if (error) throw error;
}
