import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import { config } from "./config.js";
import { requireAdmin } from "./auth.js";
import { db } from "./db.js";
import { encryptedSecret, locatorFromRow, syncProvider } from "./sync.js";
import { fetchXtreamEpisodes, xtreamPlaybackUrl } from "./providers.js";
import { createDevicePlaylist, deleteDevicePlaylist, listAllDevicePlaylists, listDevicePlaylists, playlistContent, publicPlaylist, setDevicePlaylistEnabled } from "./device-playlists.js";
import { loginDevice, logoutDevice, requireDevice } from "./device-auth.js";
import type { ProviderRow, TitleRow, XtreamSecret } from "./types.js";

const providerInput = z.object({ name: z.string().trim().min(1).max(120), kind: z.enum(["m3u", "xtream"]), endpoint: z.string().url(), sourceUrl: z.string().url().optional(), username: z.string().trim().optional(), password: z.string().optional() });
const devicePlaylistInput = z.object({
  name: z.string().trim().min(1).max(120),
  sourceType: z.enum(["url", "xtream"]),
  sourceUrl: z.string().max(2048).optional(),
  host: z.string().max(2048).optional(),
  username: z.string().max(256).optional(),
  password: z.string().max(256).optional(),
});
const deviceLoginInput = z.object({ mac: z.string().min(1).max(32), deviceKey: z.string().min(1).max(16) });
const devicePlaylistPatch = z.object({ enabled: z.boolean() });
const json = (response: ServerResponse, status: number, value: unknown) => { response.statusCode = status; response.setHeader("Content-Type", "application/json; charset=utf-8"); response.end(JSON.stringify(value)); };
const publicRequests = new Map<string, { startedAt: number; count: number }>();
function enforcePublicRateLimit(request: IncomingMessage): void {
  const now = Date.now();
  const key = String(request.headers["x-forwarded-for"] || request.socket.remoteAddress || "unknown").split(",")[0].trim();
  const previous = publicRequests.get(key);
  if (!previous || now - previous.startedAt >= 10 * 60_000) { publicRequests.set(key, { startedAt: now, count: 1 }); return; }
  previous.count += 1;
  if (previous.count > 20) throw Object.assign(new Error("Too many playlist changes. Try again later."), { statusCode: 429 });
}

function cors(request: IncomingMessage, response: ServerResponse): boolean {
  const origin = typeof request.headers.origin === "string" ? request.headers.origin : "";
  if (origin && config.corsOrigins.includes(origin)) response.setHeader("Access-Control-Allow-Origin", origin);
  else if (!origin) response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  if (request.method === "OPTIONS") { response.statusCode = 204; response.end(); return true; }
  return false;
}

async function body(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const value = Buffer.from(chunk);
    size += value.length;
    if (size > 256 * 1024) throw Object.assign(new Error("Request body is too large."), { statusCode: 413 });
    chunks.push(value);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 }); }
}

async function catalog(url: URL): Promise<unknown> {
  const providerId = url.searchParams.get("providerId");
  const kind = url.searchParams.get("kind");
  const categoryId = url.searchParams.get("categoryId");
  const query = url.searchParams.get("q")?.trim();
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || 40)));
  let titleQuery = db().from("iptv_titles").select("id,kind,title,slug,poster_url,group_name,epg_id,sort_order,metadata", { count: "exact" }).order("sort_order", { ascending: true }).range((page - 1) * pageSize, page * pageSize - 1);
  if (providerId) titleQuery = titleQuery.eq("provider_id", providerId);
  if (kind && ["live", "movie", "series"].includes(kind)) titleQuery = titleQuery.eq("kind", kind);
  if (categoryId) titleQuery = titleQuery.eq("category_id", categoryId);
  if (query) titleQuery = titleQuery.ilike("title", `%${query}%`);
  const [{ data: titles, count, error: titleError }, { data: categories, error: categoryError }] = await Promise.all([
    titleQuery,
    db().from("iptv_categories").select("id,provider_id,name,slug,kind,sort_order,title_count").order("sort_order", { ascending: true }),
  ]);
  if (titleError) throw titleError;
  if (categoryError) throw categoryError;
  return { titles: titles || [], categories: categories || [], page, pageSize, total: count || 0 };
}

async function playback(titleId: string, url: URL): Promise<unknown> {
  const { data: title, error } = await db().from("iptv_titles").select("*").eq("id", titleId).single();
  if (error || !title) throw Object.assign(new Error("Title not found."), { statusCode: 404 });
  const { data: provider, error: providerError } = await db().from("iptv_providers").select("*").eq("id", title.provider_id).single();
  if (providerError || !provider) throw new Error("Provider not found.");
  const { data: secret, error: secretError } = await db().from("iptv_provider_secrets").select("*").eq("provider_id", title.provider_id).single();
  if (secretError || !secret) throw new Error("Provider credentials are missing.");
  const locator = locatorFromRow(title as TitleRow);
  if (locator.type === "m3u") return { url: locator.url, kind: title.kind, title: title.title };
  const secretValue = (await import("./crypto.js")).decryptJson<XtreamSecret>({ ciphertext: secret.ciphertext, iv: secret.iv, authTag: secret.auth_tag, keyVersion: secret.key_version });
  if (locator.kind === "series") {
    const episodeId = url.searchParams.get("episodeId");
    if (!episodeId) throw Object.assign(new Error("Select an episode before playback."), { statusCode: 400 });
    return { url: `${String(provider.endpoint).replace(/\/+$/, "")}/series/${encodeURIComponent(secretValue.username)}/${encodeURIComponent(secretValue.password)}/${encodeURIComponent(episodeId)}.mp4`, kind: "series", title: title.title };
  }
  return { url: xtreamPlaybackUrl(provider as ProviderRow, secretValue, locator), kind: title.kind, title: title.title };
}

async function episodes(titleId: string): Promise<unknown> {
  const { data: title } = await db().from("iptv_titles").select("*").eq("id", titleId).single();
  if (!title || title.kind !== "series") throw Object.assign(new Error("Series not found."), { statusCode: 404 });
  const { data: provider } = await db().from("iptv_providers").select("*").eq("id", title.provider_id).single();
  const { data: secret } = await db().from("iptv_provider_secrets").select("*").eq("provider_id", title.provider_id).single();
  if (!provider || !secret) throw new Error("Provider credentials are missing.");
  const locator = locatorFromRow(title as TitleRow);
  if (locator.type !== "xtream") return { episodes: [] };
  const value = (await import("./crypto.js")).decryptJson<XtreamSecret>({ ciphertext: secret.ciphertext, iv: secret.iv, authTag: secret.auth_tag, keyVersion: secret.key_version });
  return { episodes: await fetchXtreamEpisodes(provider as ProviderRow, value, locator.externalId) };
}

/** Device dashboard: everything here is scoped to the MAC behind the session token. */
async function device(request: IncomingMessage, response: ServerResponse, pathname: string): Promise<void> {
  if (pathname === "/api/v1/device/login" && request.method === "POST") {
    enforcePublicRateLimit(request);
    const input = deviceLoginInput.parse(await body(request));
    json(response, 200, await loginDevice(input.mac, input.deviceKey));
    return;
  }
  if (pathname === "/api/v1/device/logout" && request.method === "POST") {
    await logoutDevice(request.headers);
    json(response, 200, { ok: true });
    return;
  }
  const mac = await requireDevice(request.headers);
  if (pathname === "/api/v1/device/playlists") {
    if (request.method === "GET") { json(response, 200, { mac, playlists: (await listDevicePlaylists(mac)).map(publicPlaylist) }); return; }
    if (request.method === "POST") {
      enforcePublicRateLimit(request);
      const input = devicePlaylistInput.parse(await body(request));
      json(response, 201, { playlist: await createDevicePlaylist({ ...input, mac }) });
      return;
    }
    json(response, 405, { error: "Method not allowed." });
    return;
  }
  const match = pathname.match(/^\/api\/v1\/device\/playlists\/([^/]+)$/);
  if (!match) { json(response, 404, { error: "Not found." }); return; }
  const playlistId = decodeURIComponent(match[1]);
  if (request.method === "PATCH") {
    const input = devicePlaylistPatch.parse(await body(request));
    json(response, 200, { playlist: await setDevicePlaylistEnabled(playlistId, input.enabled, mac) });
    return;
  }
  if (request.method === "DELETE") { await deleteDevicePlaylist(playlistId, mac); json(response, 200, { ok: true }); return; }
  json(response, 405, { error: "Method not allowed." });
}

async function admin(request: IncomingMessage, response: ServerResponse, pathname: string): Promise<void> {
  await requireAdmin(request.headers);
  if (request.method === "GET" && pathname === "/api/v1/admin/providers") {
    const { data, error } = await db().from("iptv_providers").select("id,name,kind,endpoint,enabled,sync_status,sync_error,last_sync_at,title_count,category_count").order("created_at", { ascending: false });
    if (error) throw error;
    json(response, 200, { providers: data || [] });
    return;
  }
  if (request.method === "GET" && pathname === "/api/v1/admin/device-playlists") {
    json(response, 200, { playlists: (await listAllDevicePlaylists()).map(publicPlaylist) });
    return;
  }
  const deviceMatch = pathname.match(/^\/api\/v1\/admin\/device-playlists(?:\/([^/]+))?$/);
  if (deviceMatch) {
    const playlistId = deviceMatch[1] ? decodeURIComponent(deviceMatch[1]) : undefined;
    if (!playlistId || request.method === "POST" || request.method === "PATCH") {
      if (!playlistId || request.method !== "PATCH") { json(response, 405, { error: "Method not allowed." }); return; }
      const input = devicePlaylistPatch.parse(await body(request));
      json(response, 200, { playlist: await setDevicePlaylistEnabled(playlistId, input.enabled) });
      return;
    }
    if (request.method === "DELETE") { await deleteDevicePlaylist(playlistId); json(response, 200, { ok: true }); return; }
    json(response, 405, { error: "Method not allowed." });
    return;
  }
  const match = pathname.match(/^\/api\/v1\/admin\/providers(?:\/([^/]+))?(?:\/sync)?$/);
  if (!match) { json(response, 404, { error: "Not found." }); return; }
  const providerId = match[1];
  if (request.method === "POST" && pathname.endsWith("/sync") && providerId) {
    json(response, 202, { provider: await syncProvider(providerId) });
    return;
  }
  if (request.method === "DELETE" && providerId) {
    const { error } = await db().from("iptv_providers").delete().eq("id", providerId);
    if (error) throw error;
    json(response, 200, { ok: true });
    return;
  }
  if (request.method === "POST" && !providerId) {
    const input = providerInput.parse(await body(request));
    const secret = input.kind === "m3u"
      ? { sourceUrl: input.sourceUrl || input.endpoint }
      : { username: input.username || "", password: input.password || "" };
    if (input.kind === "xtream" && (!input.username || !input.password)) throw Object.assign(new Error("Xtream username and password are required."), { statusCode: 400 });
    const { data: provider, error } = await db().from("iptv_providers").insert({ name: input.name, kind: input.kind, endpoint: input.endpoint }).select("*").single();
    if (error || !provider) throw error || new Error("Could not create provider.");
    const encrypted = encryptedSecret(secret);
    const { error: secretError } = await db().from("iptv_provider_secrets").insert({ provider_id: provider.id, ...encrypted });
    if (secretError) { await db().from("iptv_providers").delete().eq("id", provider.id); throw secretError; }
    json(response, 201, { provider });
    return;
  }
  json(response, 405, { error: "Method not allowed." });
}

const server = createServer(async (request, response) => {
  try {
    if (cors(request, response)) return;
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (request.method === "GET" && url.pathname === "/health") { json(response, 200, { ok: true, service: "figimi-iptv-backend" }); return; }
    const rawPlaylistMatch = url.pathname.match(/^\/api\/v1\/devices\/([^/]+)\/playlists\/([^/]+)\/playlist\.m3u$/);
    if (rawPlaylistMatch && request.method === "GET") {
      const result = await playlistContent(decodeURIComponent(rawPlaylistMatch[1]), decodeURIComponent(rawPlaylistMatch[2]), url.searchParams.get("key") || "");
      response.statusCode = 200;
      response.setHeader("Content-Type", "audio/x-mpegurl; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Content-Disposition", `inline; filename="${result.name.replace(/[^a-z0-9._-]+/gi, "-")}.m3u"`);
      response.end(result.content);
      return;
    }
    if (url.pathname.startsWith("/api/v1/device/")) { await device(request, response, url.pathname); return; }
    if (url.pathname === "/api/v1/catalog" && request.method === "GET") { json(response, 200, await catalog(url)); return; }
    const episodeMatch = url.pathname.match(/^\/api\/v1\/catalog\/([^/]+)\/episodes$/);
    if (episodeMatch && request.method === "GET") { json(response, 200, await episodes(episodeMatch[1])); return; }
    const playbackMatch = url.pathname.match(/^\/api\/v1\/playback\/([^/]+)$/);
    if (playbackMatch && request.method === "GET") { json(response, 200, await playback(playbackMatch[1], url)); return; }
    if (url.pathname.startsWith("/api/v1/admin/")) { await admin(request, response, url.pathname); return; }
    json(response, 404, { error: "Not found." });
  } catch (error) {
    const status = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode: number }).statusCode) : 500;
    const message = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(" ") : error instanceof Error ? error.message : "Unexpected server error.";
    if (status >= 500) console.error(message);
    json(response, status, { error: message });
  }
});

server.listen(config.port, "0.0.0.0", () => {
  console.log(`Figimi IPTV backend listening on ${config.port}`);
  if (config.usesDefaultDeviceKeySecret()) {
    console.warn("FIGIMI_DEVICE_KEY_SECRET is unset; using the development default. Set it in production and match the Android TV constant.");
  }
});
