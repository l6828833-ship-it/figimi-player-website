import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ApiError } from "./mac";

export type EncryptedValue = { ciphertext: string; iv: string; authTag: string; keyVersion: number };

/**
 * AES-256-GCM under IPTV_CREDENTIALS_KEY, so playlist sources and Xtream logins are
 * never stored in the clear.
 *
 * A missing or malformed key is reported as a deployment problem rather than a
 * generic failure: it is not something the visitor can fix, and the previous opaque
 * message made a simple unset variable look like a broken feature.
 */
function key(): Buffer {
  const raw = process.env.IPTV_CREDENTIALS_KEY?.trim();
  if (!raw) throw new ApiError("This site is missing its encryption key (IPTV_CREDENTIALS_KEY). Set it in the hosting environment and redeploy.", 503);
  const value = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (value.length !== 32) throw new ApiError("IPTV_CREDENTIALS_KEY must decode to exactly 32 bytes. Generate one with: openssl rand -hex 32", 503);
  return value;
}

export function encryptJson(value: unknown): EncryptedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64url"), iv: iv.toString("base64url"), authTag: cipher.getAuthTag().toString("base64url"), keyVersion: 1 };
}

export function decryptJson<T>(value: EncryptedValue): T {
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(value.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(value.authTag, "base64url"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64url")), decipher.final()]).toString("utf8");
  return JSON.parse(plaintext) as T;
}
