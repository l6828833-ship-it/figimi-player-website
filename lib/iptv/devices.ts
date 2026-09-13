import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeMac } from "./mac";

/** New devices get a trial so the dashboard always has a real date to show. */
export const TRIAL_DAYS = 7;

export type DeviceSummary = {
  mac: string;
  plan: "trial" | "paid" | "lifetime";
  subscriptionExpiresAt: string | null;
  activatedAt: string | null;
  daysRemaining: number | null;
  expired: boolean;
  disabled: boolean;
  loginCount: number;
  lastLoginAt: string | null;
  firstSeenAt: string | null;
  playlistCount: number;
  activePlaylistCount: number;
};

/**
 * Whole days left, rounded up, so the last partial day still reads as "1 day left"
 * rather than "0" while the subscription is genuinely still valid.
 */
export function daysUntil(value: string | null): number | null {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
}

/** A null expiry means no term was recorded, which is treated as active rather than expired. */
export const isExpired = (value: string | null): boolean => (value ? new Date(value).getTime() <= Date.now() : false);

/**
 * Records this device and starts its trial the first time it is ever seen.
 *
 * The trial lives here rather than on the device precisely so deleting or reinstalling
 * the app cannot restart it: the MAC is derived from the hardware, so the same TV comes
 * back to the same row and the same end date. A blocked device stays blocked for the
 * same reason.
 *
 * Returns null when the device is blocked, so callers can refuse without a second query.
 */
export async function touchDevice(macValue: string): Promise<{ blocked: boolean }> {
  const mac = normalizeMac(macValue);
  const client = createAdminClient();
  const { data: existing } = await client
    .from("iptv_devices")
    .select("device_mac,disabled")
    .eq("device_mac", mac)
    .maybeSingle();

  if (existing) return { blocked: Boolean(existing.disabled) };

  const now = new Date();
  // Nothing is overwritten for a known device: an admin's paid term must survive the
  // app checking in.
  await client.from("iptv_devices").insert({
    device_mac: mac,
    plan: "trial",
    activated_at: now.toISOString(),
    first_seen_at: now.toISOString(),
    subscription_expires_at: new Date(now.getTime() + TRIAL_DAYS * 86_400_000).toISOString(),
  });
  return { blocked: false };
}

export async function deviceSummary(macValue: string): Promise<DeviceSummary> {
  const mac = normalizeMac(macValue);
  const client = createAdminClient();
  const [{ data: device }, { data: playlists }] = await Promise.all([
    client.from("iptv_devices").select("device_mac,plan,subscription_expires_at,activated_at,disabled,login_count,last_login_at,first_seen_at").eq("device_mac", mac).maybeSingle(),
    client.from("iptv_device_playlists").select("id,enabled,expires_at").eq("device_mac", mac),
  ]);

  const expiresAt = (device?.subscription_expires_at as string | null) ?? null;
  const rows = playlists || [];
  return {
    mac,
    plan: (device?.plan as DeviceSummary["plan"]) || "trial",
    subscriptionExpiresAt: expiresAt,
    activatedAt: (device?.activated_at as string | null) ?? null,
    daysRemaining: daysUntil(expiresAt),
    expired: isExpired(expiresAt),
    disabled: Boolean(device?.disabled),
    loginCount: Number(device?.login_count || 0),
    lastLoginAt: (device?.last_login_at as string | null) ?? null,
    firstSeenAt: (device?.first_seen_at as string | null) ?? null,
    playlistCount: rows.length,
    activePlaylistCount: rows.filter((row) => row.enabled && !isExpired(row.expires_at as string | null)).length,
  };
}
