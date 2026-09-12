import "server-only";
import { isIP } from "node:net";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptJson, encryptJson } from "./crypto";
import { ApiError, normalizeMac } from "./mac";
import { xtreamPlaylist, type XtreamLogin } from "./xtream";

export const MAX_PLAYLIST_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

/** "upload" only remains so playlists saved by the earlier file-upload flow keep working. */
export type DeviceSourceType = "url" | "xtream" | "upload";
type PlaylistSecret = { content?: string; sourceUrl?: string; xtream?: XtreamLogin };

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

const fields = "id,device_mac,name,source_type,enabled,sort_order,access_count,access_token,last_accessed_at,created_at,updated_at";

/** The access token is what keeps the TV URL unguessable, so it is only ever returned to the signed-in device. */
export const publicPlaylist = (row: DevicePlaylistRow) => ({
  id: row.id,
  device_mac: row.device_mac,
  name: row.name,
  source_type: row.source_type,
  enabled: row.enabled,
  access_count: row.access_count,
  last_accessed_at: row.last_accessed_at,
  created_at: row.created_at,
  playlistPath: `/api/devices/${encodeURIComponent(row.device_mac)}/playlists/${encodeURIComponent(row.id)}/playlist.m3u?key=${encodeURIComponent(row.access_token)}`,
});

function assertM3u(content: string): string {
  const normalized = content.replace(/^\uFEFF/, "").trim();
  if (!normalized || Buffer.byteLength(normalized, "utf8") > MAX_PLAYLIST_BYTES) throw new ApiError("The playlist must be smaller than 10 MB.", 413);
  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.some((line) => line.toUpperCase() === "#EXTM3U") && !lines.some((line) => line.toUpperCase().startsWith("#EXTINF:"))) {
    throw new ApiError("That link did not return a valid M3U playlist.", 400);
  }
  return normalized.endsWith("\n") ? normalized : `${normalized}\n`;
}

/** Blocks credentials-in-URL, odd ports, and private ranges so this endpoint cannot be used to probe the internal network. */
function assertSafeUrl(value: string, label: string): string {
  let parsed: URL;
  try { parsed = new URL(value.trim()); } catch { throw new ApiError(`Enter a valid ${label}.`, 400); }
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password || (parsed.port && !["80", "443"].includes(parsed.port))) {
    throw new ApiError(`The ${label} must use HTTP(S) without embedded credentials or non-standard ports.`, 400);
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const version = isIP(host);
  const privateIpv4 = version === 4 && (() => {
    const parts = host.split(".").map(Number);
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
  })();
  const privateIpv6 = version === 6 && (host === "::1" || host === "::" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:"));
  if (host === "localhost" || host.endsWith(".local") || privateIpv4 || privateIpv6) throw new ApiError(`Private or local addresses are not allowed for the ${label}.`, 400);
  return parsed.toString();
}

async function fetchPlaylist(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(assertSafeUrl(url, "playlist link"), {
      redirect: "manual",
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "audio/x-mpegurl, application/vnd.apple.mpegurl, text/plain, */*" },
    });
    if (response.status >= 300 && response.status < 400) throw new ApiError("Redirecting links are not accepted. Use the final playlist URL.", 400);
    if (!response.ok) throw new ApiError(`The playlist link returned HTTP ${response.status}.`, 400);
    if (Number(response.headers.get("content-length") || 0) > MAX_PLAYLIST_BYTES) throw new ApiError("That playlist is larger than 10 MB.", 413);
    const reader = response.body?.getReader();
    if (!reader) return assertM3u(await response.text());
    // Streamed so a server that lies about content-length still cannot exhaust memory.
    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_PLAYLIST_BYTES) { await reader.cancel(); throw new ApiError("That playlist is larger than 10 MB.", 413); }
      chunks.push(Buffer.from(next.value));
    }
    return assertM3u(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new ApiError("The playlist link timed out.", 408);
    throw error;
  } finally { clearTimeout(timer); }
}

export async function listDevicePlaylists(macValue: string): Promise<DevicePlaylistRow[]> {
  const mac = normalizeMac(macValue);
  const { data, error } = await createAdminClient()
    .from("iptv_device_playlists")
    .select(fields)
    .eq("device_mac", mac)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
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
  if (!name || name.length > 120) throw new ApiError("Playlist name must be between 1 and 120 characters.", 400);

  let secret: PlaylistSecret;
  if (input.sourceType === "url") {
    if (!input.sourceUrl) throw new ApiError("Enter an M3U playlist link.", 400);
    secret = { sourceUrl: assertSafeUrl(input.sourceUrl, "playlist link") };
    // Checked now so a dead or non-M3U link fails while the user is still looking at the form.
    await fetchPlaylist(secret.sourceUrl!);
  } else {
    if (!input.host || !input.username || !input.password) throw new ApiError("Xtream host, username, and password are all required.", 400);
    secret = { xtream: { host: assertSafeUrl(input.host, "Xtream host"), username: input.username.trim(), password: input.password } };
    await xtreamPlaylist(secret.xtream!);
  }

  const client = createAdminClient();
  const { data: row, error } = await client
    .from("iptv_device_playlists")
    .insert({ device_mac: mac, name, source_type: input.sourceType, sort_order: 0, access_token: randomBytes(16).toString("hex") })
    .select(fields)
    .single();
  if (error || !row) {
    if (error?.code === "23505") throw new ApiError("This device already has a playlist with that name.", 409);
    throw error || new Error("Could not create the playlist.");
  }
  const encrypted = encryptJson(secret);
  const { error: secretError } = await client
    .from("iptv_device_playlist_secrets")
    .insert({ playlist_id: row.id, ciphertext: encrypted.ciphertext, iv: encrypted.iv, auth_tag: encrypted.authTag, key_version: encrypted.keyVersion });
  if (secretError) { await client.from("iptv_device_playlists").delete().eq("id", row.id); throw secretError; }
  return publicPlaylist(row as DevicePlaylistRow);
}

export async function playlistContent(macValue: string, playlistId: string, accessToken: string): Promise<{ content: string; name: string }> {
  const mac = normalizeMac(macValue);
  // Rejected before touching the database: a request with no token can never succeed.
  if (!accessToken) throw new ApiError("Playlist not found.", 404);
  const client = createAdminClient();
  const { data: row, error } = await client.from("iptv_device_playlists").select("id,name,enabled,access_count,access_token").eq("id", playlistId).eq("device_mac", mac).maybeSingle();
  if (error) throw error;
  // A wrong token is reported as "not found" so the endpoint reveals nothing about which IDs exist.
  if (!row || !row.enabled || !accessToken || row.access_token !== accessToken) throw new ApiError("Playlist not found.", 404);

  const { data: secretRow, error: secretError } = await client.from("iptv_device_playlist_secrets").select("ciphertext,iv,auth_tag,key_version").eq("playlist_id", playlistId).single();
  if (secretError || !secretRow) throw new Error("The playlist source is missing.");
  const secret = decryptJson<PlaylistSecret>({ ciphertext: secretRow.ciphertext, iv: secretRow.iv, authTag: secretRow.auth_tag, keyVersion: secretRow.key_version });

  const content = secret.content ? secret.content : secret.xtream ? await xtreamPlaylist(secret.xtream) : await fetchPlaylist(secret.sourceUrl || "");
  await client.from("iptv_device_playlists").update({ access_count: Number(row.access_count || 0) + 1, last_accessed_at: new Date().toISOString() }).eq("id", playlistId);
  return { content, name: row.name };
}

/** Scoped by MAC when a device is acting, so a session can only touch its own playlists. */
export async function setDevicePlaylistEnabled(id: string, enabled: boolean, macValue?: string) {
  let query = createAdminClient().from("iptv_device_playlists").update({ enabled }).eq("id", id);
  if (macValue) query = query.eq("device_mac", normalizeMac(macValue));
  const { data, error } = await query.select(fields).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError("Playlist not found.", 404);
  return publicPlaylist(data as DevicePlaylistRow);
}

export async function deleteDevicePlaylist(id: string, macValue?: string) {
  let query = createAdminClient().from("iptv_device_playlists").delete().eq("id", id);
  if (macValue) query = query.eq("device_mac", normalizeMac(macValue));
  const { error } = await query;
  if (error) throw error;
}
