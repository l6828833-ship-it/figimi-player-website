import { isIP } from "node:net";
import { randomBytes } from "node:crypto";
import { db } from "./db.js";
import { decryptJson, encryptJson } from "./crypto.js";
import { fetchXtreamItems, xtreamPlaybackUrl } from "./providers.js";
import type { ProviderRow } from "./types.js";

export const MAX_PLAYLIST_BYTES = 10 * 1024 * 1024;
const PLAYLIST_TIMEOUT_MS = 15_000;

/** "upload" only still exists so playlists saved by the earlier file-upload flow keep working. */
export type DeviceSourceType = "url" | "xtream" | "upload";
type DevicePlaylistSecret = { content?: string; sourceUrl?: string; xtream?: { host: string; username: string; password: string } };
export type DevicePlaylistRow = {
  id: string;
  device_mac: string;
  name: string;
  source_type: DeviceSourceType;
  enabled: boolean;
  sort_order: number;
  access_count: number;
  access_token: string;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string;
};

const failure = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

export function normalizeMac(value: string): string {
  const compact = value.trim().replace(/[.\-:\s]/g, "").toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(compact)) throw failure("Enter a valid 12-digit MAC address.", 400);
  if (/^0+$/.test(compact) || /^F+$/.test(compact) || Number.parseInt(compact.slice(0, 2), 16) % 2 === 1) {
    throw failure("Enter a valid unicast device MAC address.", 400);
  }
  return compact.match(/.{2}/g)!.join(":");
}

function assertM3u(content: string): string {
  const normalized = content.replace(/^\uFEFF/, "").trim();
  if (!normalized || Buffer.byteLength(normalized, "utf8") > MAX_PLAYLIST_BYTES) throw failure("The playlist must be smaller than 10 MB.", 413);
  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.some((line) => line.toUpperCase() === "#EXTM3U") && !lines.some((line) => line.toUpperCase().startsWith("#EXTINF:"))) {
    throw failure("The uploaded file is not a valid M3U playlist.", 400);
  }
  return normalized.endsWith("\n") ? normalized : `${normalized}\n`;
}

/** Blocks credentials-in-URL, odd ports, and anything resolving to a private range. */
function assertSafeUrl(value: string, label: string): string {
  let parsed: URL;
  try { parsed = new URL(value.trim()); } catch { throw failure(`Enter a valid ${label}.`, 400); }
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password || (parsed.port && !["80", "443"].includes(parsed.port))) {
    throw failure(`${label} must use HTTP(S) without embedded credentials or non-standard ports.`, 400);
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const ipVersion = isIP(host);
  const privateIpv4 = ipVersion === 4 && (() => {
    const parts = host.split(".").map(Number);
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
  })();
  const privateIpv6 = ipVersion === 6 && (host === "::1" || host === "::" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:"));
  if (host === "localhost" || host.endsWith(".local") || privateIpv4 || privateIpv6) throw failure(`Private or local addresses are not allowed for the ${label}.`, 400);
  return parsed.toString();
}

async function fetchPlaylist(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PLAYLIST_TIMEOUT_MS);
  try {
    const response = await fetch(assertSafeUrl(url, "playlist URL"), { redirect: "manual", signal: controller.signal, headers: { Accept: "audio/x-mpegurl, application/vnd.apple.mpegurl, text/plain, */*" } });
    if (response.status >= 300 && response.status < 400) throw failure("Playlist URL redirects are not allowed. Use the final URL.", 400);
    if (!response.ok) throw failure(`Playlist URL returned HTTP ${response.status}.`, 400);
    if (Number(response.headers.get("content-length") || 0) > MAX_PLAYLIST_BYTES) throw failure("The remote playlist is larger than 10 MB.", 413);
    const reader = response.body?.getReader();
    if (!reader) return assertM3u(await response.text());
    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_PLAYLIST_BYTES) { await reader.cancel(); throw failure("The remote playlist is larger than 10 MB.", 413); }
      chunks.push(Buffer.from(next.value));
    }
    return assertM3u(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw failure("Playlist URL timed out.", 408);
    throw error;
  } finally { clearTimeout(timer); }
}

/**
 * Renders an Xtream login as a plain M3U so the TV can consume one URL format for
 * every source type. Series are omitted because a series is a container of
 * episodes, not a single playable stream; the app's native Xtream mode handles those.
 */
async function xtreamPlaylist(secret: NonNullable<DevicePlaylistSecret["xtream"]>): Promise<string> {
  const provider = { id: "device", name: "device", kind: "xtream", endpoint: secret.host, enabled: true, sync_status: "ready", sync_error: null, last_sync_at: null, title_count: 0, category_count: 0 } as ProviderRow;
  const items = await fetchXtreamItems(provider, { username: secret.username, password: secret.password });
  const lines = ["#EXTM3U"];
  for (const item of items) {
    if (item.kind === "series" || item.locator.type !== "xtream") continue;
    const attributes = [`tvg-id="${item.epgId || ""}"`, `tvg-logo="${item.posterUrl || ""}"`, `group-title="${item.groupName || item.categoryName || "Uncategorised"}"`].join(" ");
    lines.push(`#EXTINF:-1 ${attributes},${item.title}`);
    lines.push(xtreamPlaybackUrl(provider, { username: secret.username, password: secret.password }, item.locator));
  }
  if (lines.length === 1) throw failure("The Xtream login returned no live or movie streams.", 400);
  return `${lines.join("\n")}\n`;
}

const fields = "id,device_mac,name,source_type,enabled,sort_order,access_count,access_token,last_accessed_at,created_at,updated_at";
export const publicPlaylist = (row: DevicePlaylistRow) => ({
  id: row.id,
  device_mac: row.device_mac,
  name: row.name,
  source_type: row.source_type,
  enabled: row.enabled,
  access_count: row.access_count,
  last_accessed_at: row.last_accessed_at,
  created_at: row.created_at,
  playlistPath: `/api/v1/devices/${encodeURIComponent(row.device_mac)}/playlists/${encodeURIComponent(row.id)}/playlist.m3u?key=${encodeURIComponent(row.access_token)}`,
});

export async function listDevicePlaylists(macValue: string, includeDisabled = true) {
  const mac = normalizeMac(macValue);
  let query = db().from("iptv_device_playlists").select(fields).eq("device_mac", mac).order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (!includeDisabled) query = query.eq("enabled", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as DevicePlaylistRow[];
}

export async function listAllDevicePlaylists() {
  const { data, error } = await db().from("iptv_device_playlists").select(fields).order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as DevicePlaylistRow[];
}

export type CreatePlaylistInput = {
  mac: string;
  name: string;
  sourceType: "url" | "xtream";
  sourceUrl?: string;
  host?: string;
  username?: string;
  password?: string;
};

export async function createDevicePlaylist(input: CreatePlaylistInput) {
  const mac = normalizeMac(input.mac);
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name || name.length > 120) throw failure("Playlist name must be between 1 and 120 characters.", 400);

  let secret: DevicePlaylistSecret;
  if (input.sourceType === "url") {
    if (!input.sourceUrl) throw failure("Enter an M3U playlist URL.", 400);
    // Fetched now so a dead or non-M3U link fails while the user can still fix it.
    secret = { sourceUrl: assertSafeUrl(input.sourceUrl, "playlist URL") };
    await fetchPlaylist(secret.sourceUrl!);
  } else {
    if (!input.host || !input.username || !input.password) throw failure("Xtream host, username, and password are all required.", 400);
    secret = { xtream: { host: assertSafeUrl(input.host, "Xtream host"), username: input.username.trim(), password: input.password } };
    // Verified before storing so a bad login fails at the point the user can fix it.
    await xtreamPlaylist(secret.xtream!);
  }

  const client = db();
  const accessToken = randomBytes(16).toString("hex");
  const { data: row, error } = await client
    .from("iptv_device_playlists")
    .insert({ device_mac: mac, name, source_type: input.sourceType, sort_order: 0, access_token: accessToken })
    .select(fields)
    .single();
  if (error || !row) {
    if (error?.code === "23505") throw failure("This device already has a playlist with that name.", 409);
    throw error || new Error("Could not create the playlist.");
  }
  const encrypted = encryptJson(secret);
  const { error: secretError } = await client.from("iptv_device_playlist_secrets").insert({ playlist_id: row.id, ciphertext: encrypted.ciphertext, iv: encrypted.iv, auth_tag: encrypted.authTag, key_version: encrypted.keyVersion });
  if (secretError) { await client.from("iptv_device_playlists").delete().eq("id", row.id); throw secretError; }
  return publicPlaylist(row as DevicePlaylistRow);
}

export async function playlistContent(macValue: string, playlistId: string, accessToken: string): Promise<{ content: string; name: string }> {
  const mac = normalizeMac(macValue);
  const client = db();
  const { data: row, error } = await client.from("iptv_device_playlists").select("id,name,enabled,access_count,access_token").eq("id", playlistId).eq("device_mac", mac).maybeSingle();
  if (error) throw error;
  if (!row || !row.enabled || !accessToken || row.access_token !== accessToken) throw failure("Playlist not found.", 404);
  const { data: secretRow, error: secretError } = await client.from("iptv_device_playlist_secrets").select("ciphertext,iv,auth_tag,key_version").eq("playlist_id", playlistId).single();
  if (secretError || !secretRow) throw new Error("Playlist source is missing.");
  const secret = decryptJson<DevicePlaylistSecret>({ ciphertext: secretRow.ciphertext, iv: secretRow.iv, authTag: secretRow.auth_tag, keyVersion: secretRow.key_version });
  const content = secret.content ? secret.content : secret.xtream ? await xtreamPlaylist(secret.xtream) : await fetchPlaylist(secret.sourceUrl || "");
  void client.from("iptv_device_playlists").update({ access_count: Number(row.access_count || 0) + 1, last_accessed_at: new Date().toISOString() }).eq("id", playlistId);
  return { content, name: row.name };
}

/** Scoped by MAC so a device session can only change its own playlists. */
export async function setDevicePlaylistEnabled(id: string, enabled: boolean, macValue?: string) {
  let query = db().from("iptv_device_playlists").update({ enabled }).eq("id", id);
  if (macValue) query = query.eq("device_mac", normalizeMac(macValue));
  const { data, error } = await query.select(fields).maybeSingle();
  if (error) throw error;
  if (!data) throw failure("Playlist not found.", 404);
  return publicPlaylist(data as DevicePlaylistRow);
}

export async function deleteDevicePlaylist(id: string, macValue?: string) {
  let query = db().from("iptv_device_playlists").delete().eq("id", id);
  if (macValue) query = query.eq("device_mac", normalizeMac(macValue));
  const { error } = await query;
  if (error) throw error;
}
