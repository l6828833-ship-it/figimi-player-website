import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeMac } from "./mac";

/**
 * The 6-digit key shown beside the MAC on the Android TV activation screen.
 *
 * Derived rather than registered: the app may never have contacted this site before
 * a user opens the dashboard, so there is nothing to look a stored key up against.
 * Both sides compute the same HMAC over the MAC and fold it to six digits, which
 * lets the TV display a valid key offline with nothing persisted.
 *
 * Two limits worth stating plainly. Six digits is only a million combinations, so
 * `loginDevice` locks a device after repeated wrong keys — that lockout is the real
 * defence, not the key's length. And the shared secret ships inside the APK, so it
 * stops someone using a MAC they glimpsed, not a reverse engineer. Per-device
 * secrets issued by this server would be stronger and need the app to register once.
 *
 * Must stay identical to `DeviceKey.SHARED_SECRET` in the Android app.
 */
const secret = () => process.env.FIGIMI_DEVICE_KEY_SECRET?.trim() || "figimi-device-key-v1-shared-secret";

export const usesDefaultDeviceKeySecret = () => !process.env.FIGIMI_DEVICE_KEY_SECRET?.trim();

export function deriveDeviceKey(macValue: string): string {
  const mac = normalizeMac(macValue);
  const digest = createHmac("sha256", secret()).update(`figimi-device-key-v1:${mac}`).digest();
  return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

/** Ignores spaces or dashes a user might type between the digits. */
export function verifyDeviceKey(macValue: string, provided: string): boolean {
  const expected = deriveDeviceKey(macValue);
  const candidate = provided.trim().replace(/[^0-9]/g, "");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(candidate, "utf8"));
}
