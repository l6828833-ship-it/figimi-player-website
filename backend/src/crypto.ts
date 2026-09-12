import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { config } from "./config.js";

export type EncryptedValue = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

function key(): Buffer {
  const raw = config.credentialsKey();
  const value = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (value.length !== 32) throw new Error("IPTV_CREDENTIALS_KEY must decode to 32 bytes.");
  return value;
}

export function encryptJson(value: unknown): EncryptedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
    keyVersion: 1,
  };
}

export function decryptJson<T>(value: EncryptedValue): T {
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(value.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(value.authTag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext) as T;
}
