import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import { config } from "./config.js";
import { db } from "./db.js";
import { normalizeMac } from "./device-playlists.js";

/**
 * Device keys are derived, not registered.
 *
 * The Android TV app has no account and cannot be assumed to have contacted this
 * API before a user logs into the website, so the key it shows on screen has to be
 * computable on both sides from the device MAC alone. Both sides therefore run the
 * same HMAC over the MAC with a shared secret, reduced to six digits so it can be
 * read off a TV. Six digits is a small keyspace, which is why [loginDevice] locks a
 * device after repeated wrong keys instead of relying on the key's length.
 *
 * Security limit worth stating plainly: the shared secret ships inside the Android
 * app, so a determined attacker who unpacks the APK can derive the key for any MAC
 * they already know. It stops casual guessing of another user's MAC, not a reverse
 * engineer. Registering devices against a server-issued secret is the stronger
 * design and is the intended follow-up.
 */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 8;
const LOCKOUT_MS = 15 * 60 * 1000;

const failure = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

/** Six digits, so it can be read off a TV and typed on a phone. */
export function deriveDeviceKey(macValue: string): string {
  const mac = normalizeMac(macValue);
  const digest = createHmac("sha256", config.deviceKeySecret()).update(`figimi-device-key-v1:${mac}`).digest();
  return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

/** Ignores spaces or dashes a user might type between the digits. */
export function verifyDeviceKey(macValue: string, provided: string): boolean {
  const expected = deriveDeviceKey(macValue);
  const candidate = provided.trim().replace(/[^0-9]/g, "");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(candidate, "utf8"));
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function loginDevice(macValue: string, deviceKey: string): Promise<{ token: string; mac: string; expiresAt: string }> {
  const mac = normalizeMac(macValue);
  const client = db();
  const { data: device } = await client.from("iptv_devices").select("device_mac,disabled,login_count,failed_attempts,locked_until").eq("device_mac", mac).maybeSingle();
  if (device?.disabled) throw failure("This device has been disabled. Contact support.", 403);

  // A six-digit key is small enough to guess exhaustively, so wrong attempts are
  // counted per device and the device locks for a while once they add up.
  if (device?.locked_until && new Date(device.locked_until).getTime() > Date.now()) {
    const minutes = Math.ceil((new Date(device.locked_until).getTime() - Date.now()) / 60_000);
    throw failure(`Too many incorrect keys. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, 429);
  }

  if (!verifyDeviceKey(mac, deviceKey)) {
    const attempts = Number(device?.failed_attempts || 0) + 1;
    const lockedUntil = attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS).toISOString() : null;
    await client.from("iptv_devices").upsert(
      { device_mac: mac, failed_attempts: lockedUntil ? 0 : attempts, locked_until: lockedUntil },
      { onConflict: "device_mac" },
    );
    throw failure("That device key does not match this MAC address.", 401);
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const { error } = await client.from("iptv_device_sessions").insert({ token_hash: hashToken(token), device_mac: mac, expires_at: expiresAt });
  if (error) throw error;
  await client.from("iptv_devices").upsert(
    { device_mac: mac, last_login_at: new Date().toISOString(), login_count: Number(device?.login_count || 0) + 1, failed_attempts: 0, locked_until: null },
    { onConflict: "device_mac" },
  );
  await client.from("iptv_device_sessions").delete().lt("expires_at", new Date().toISOString());
  return { token, mac, expiresAt };
}

/** Resolves the MAC owning the bearer token, or throws 401. */
export async function requireDevice(headers: IncomingHttpHeaders): Promise<string> {
  const header = typeof headers.authorization === "string" ? headers.authorization : "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw failure("Sign in with your MAC address and device key.", 401);
  const { data, error } = await db().from("iptv_device_sessions").select("device_mac,expires_at").eq("token_hash", hashToken(token)).maybeSingle();
  if (error) throw error;
  if (!data) throw failure("Your session has expired. Sign in again.", 401);
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    await db().from("iptv_device_sessions").delete().eq("token_hash", hashToken(token));
    throw failure("Your session has expired. Sign in again.", 401);
  }
  return data.device_mac as string;
}

export async function logoutDevice(headers: IncomingHttpHeaders): Promise<void> {
  const header = typeof headers.authorization === "string" ? headers.authorization : "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (token) await db().from("iptv_device_sessions").delete().eq("token_hash", hashToken(token));
}
