import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, normalizeMac } from "./mac";
import { daysUntil, isExpired } from "./devices";

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

export async function listDevices(): Promise<AdminDevice[]> {
  const client = createAdminClient();
  const [{ data: devices, error }, { data: playlists }] = await Promise.all([
    client.from("iptv_devices").select("device_mac,plan,subscription_expires_at,disabled,login_count,last_login_at,first_seen_at,notes").order("last_login_at", { ascending: false, nullsFirst: false }),
    client.from("iptv_device_playlists").select("device_mac"),
  ]);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of playlists || []) counts.set(row.device_mac, (counts.get(row.device_mac) || 0) + 1);

  return (devices || []).map((device) => {
    const expiresAt = (device.subscription_expires_at as string | null) ?? null;
    return {
      mac: device.device_mac as string,
      plan: (device.plan as string) || "trial",
      subscriptionExpiresAt: expiresAt,
      daysRemaining: daysUntil(expiresAt),
      expired: isExpired(expiresAt),
      blocked: Boolean(device.disabled),
      loginCount: Number(device.login_count || 0),
      lastLoginAt: (device.last_login_at as string | null) ?? null,
      firstSeenAt: (device.first_seen_at as string | null) ?? null,
      notes: (device.notes as string | null) ?? null,
      playlistCount: counts.get(device.device_mac as string) || 0,
    };
  });
}

/**
 * Adds [months] to a device's term.
 *
 * Extends from the current expiry when the subscription is still running, so renewing
 * early does not cost the customer the days they already paid for; an expired or new
 * device starts from today instead.
 */
export async function extendSubscription(macValue: string, months: number) {
  const mac = normalizeMac(macValue);
  if (!Number.isInteger(months) || months < 1 || months > 24) throw new ApiError("Choose a duration between 1 and 24 months.", 400);

  const client = createAdminClient();
  const { data: device } = await client.from("iptv_devices").select("subscription_expires_at").eq("device_mac", mac).maybeSingle();

  const current = device?.subscription_expires_at ? new Date(device.subscription_expires_at as string) : null;
  const start = current && current.getTime() > Date.now() ? current : new Date();
  const next = new Date(start);
  next.setMonth(next.getMonth() + months);

  const { error } = await client.from("iptv_devices").upsert(
    { device_mac: mac, plan: "paid", subscription_expires_at: next.toISOString() },
    { onConflict: "device_mac" },
  );
  if (error) throw error;
  return next.toISOString();
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

export async function setNotes(macValue: string, notes: string) {
  const mac = normalizeMac(macValue);
  const { error } = await createAdminClient()
    .from("iptv_devices")
    .upsert({ device_mac: mac, notes: notes.trim().slice(0, 500) || null }, { onConflict: "device_mac" });
  if (error) throw error;
}
