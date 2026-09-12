import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyDeviceKey } from "./device-key";
import { TRIAL_DAYS } from "./devices";
import { ApiError, normalizeMac } from "./mac";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 8;
const LOCKOUT_MS = 15 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function loginDevice(macValue: string, deviceKey: string): Promise<{ token: string; mac: string; expiresAt: string }> {
  const mac = normalizeMac(macValue);
  const client = createAdminClient();
  const { data: device } = await client.from("iptv_devices").select("device_mac,disabled,login_count,failed_attempts,locked_until").eq("device_mac", mac).maybeSingle();
  if (device?.disabled) throw new ApiError("This device has been disabled. Contact support.", 403);

  if (device?.locked_until && new Date(device.locked_until).getTime() > Date.now()) {
    const minutes = Math.ceil((new Date(device.locked_until).getTime() - Date.now()) / 60_000);
    throw new ApiError(`Too many incorrect keys. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, 429);
  }

  if (!verifyDeviceKey(mac, deviceKey)) {
    const attempts = Number(device?.failed_attempts || 0) + 1;
    const lockedUntil = attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS).toISOString() : null;
    await client.from("iptv_devices").upsert({ device_mac: mac, failed_attempts: lockedUntil ? 0 : attempts, locked_until: lockedUntil }, { onConflict: "device_mac" });
    throw new ApiError("That device key does not match this MAC address.", 401);
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const { error } = await client.from("iptv_device_sessions").insert({ token_hash: hashToken(token), device_mac: mac, expires_at: expiresAt });
  if (error) throw error;

  const now = new Date().toISOString();
  // A device seen for the first time starts its trial now, so the dashboard has a real
  // term to display and a paid plan set later by an admin is never overwritten here.
  const firstTime = !device;
  await client.from("iptv_devices").upsert(
    {
      device_mac: mac,
      last_login_at: now,
      login_count: Number(device?.login_count || 0) + 1,
      failed_attempts: 0,
      locked_until: null,
      ...(firstTime
        ? { plan: "trial", activated_at: now, subscription_expires_at: new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString() }
        : {}),
    },
    { onConflict: "device_mac" },
  );
  await client.from("iptv_device_sessions").delete().lt("expires_at", new Date().toISOString());
  return { token, mac, expiresAt };
}

const bearer = (request: Request) => {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
};

/** Resolves the MAC owning the request's bearer token, or throws 401. */
export async function requireDevice(request: Request): Promise<string> {
  const token = bearer(request);
  if (!token) throw new ApiError("Sign in with your MAC address and device key.", 401);
  const client = createAdminClient();
  const { data, error } = await client.from("iptv_device_sessions").select("device_mac,expires_at").eq("token_hash", hashToken(token)).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError("Your session has expired. Sign in again.", 401);
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    await client.from("iptv_device_sessions").delete().eq("token_hash", hashToken(token));
    throw new ApiError("Your session has expired. Sign in again.", 401);
  }
  return data.device_mac as string;
}

export async function logoutDevice(request: Request): Promise<void> {
  const token = bearer(request);
  if (token) await createAdminClient().from("iptv_device_sessions").delete().eq("token_hash", hashToken(token));
}
