import "server-only";
import { ApiError } from "./mac";

export type XtreamLogin = { host: string; username: string; password: string };
type Category = { category_id?: string | number; category_name?: string };
type Stream = Record<string, unknown>;

/**
 * Serverless platforms cap a response body at a few megabytes, so a rendered
 * playlist has to stay well under that. Large panels blow straight past it — one
 * real provider yields roughly 52 MB across 239,000 entries — and the failure mode
 * without this guard is a timeout or truncated playlist, which looks like a broken
 * TV rather than a source that is simply too big to inline.
 */
const MAX_RENDERED_BYTES = 3.5 * 1024 * 1024;
const TOO_LARGE_MESSAGE =
  "This Xtream account is too large to convert into a single playlist. Use the Xtream login directly in the Figimi TV app, or ask your provider for a smaller playlist.";

const base = (host: string) => host.replace(/\/+$/, "").replace(/\/player_api\.php$/i, "");

function apiUrl(login: XtreamLogin, action: string): string {
  const url = new URL(`${base(login.host)}/player_api.php`);
  url.searchParams.set("username", login.username);
  url.searchParams.set("password", login.password);
  url.searchParams.set("action", action);
  return url.toString();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: "follow", cache: "no-store" });
  if (!response.ok) throw new ApiError(`The Xtream panel returned HTTP ${response.status}.`, 400);
  return (await response.json()) as T;
}

function streamUrl(login: XtreamLogin, kind: "live" | "movie", id: string, extension?: string): string {
  const root = base(login.host);
  const credentials = `${encodeURIComponent(login.username)}/${encodeURIComponent(login.password)}`;
  if (kind === "live") return `${root}/live/${credentials}/${encodeURIComponent(id)}.ts`;
  return `${root}/movie/${credentials}/${encodeURIComponent(id)}.${extension || "mp4"}`;
}

/**
 * Renders an Xtream login as a plain M3U so the TV consumes one URL format whatever
 * the source was. Series are left out on purpose: a series is a container of
 * episodes rather than a single playable stream, so it has no meaningful M3U entry.
 */
/**
 * Pulls the Xtream login out of a panel's `get.php` playlist link.
 *
 * Worth doing because many panels put their whole credential set in that URL while
 * blocking the URL itself — one real provider answers `get.php` with a bogus HTTP
 * 884 and an empty body, yet serves `player_api.php` normally. Recognising the shape
 * lets a pasted link work through the API instead of failing on the blocked endpoint.
 */
export function xtreamLoginFromUrl(value: string): XtreamLogin | null {
  let parsed: URL;
  try { parsed = new URL(value.trim()); } catch { return null; }
  if (!/\/(get|get_php|playlist)\.php$/i.test(parsed.pathname) && parsed.pathname !== "/get.php") return null;
  const username = parsed.searchParams.get("username");
  const password = parsed.searchParams.get("password");
  if (!username || !password) return null;
  const port = parsed.port && !["80", "443"].includes(parsed.port) ? `:${parsed.port}` : "";
  return { host: `${parsed.protocol}//${parsed.hostname}${port}`, username, password };
}

/** Confirms credentials before anything is stored, so a bad login fails at the form. */
export async function xtreamAuthWorks(login: XtreamLogin): Promise<boolean> {
  try {
    const url = new URL(`${base(login.host)}/player_api.php`);
    url.searchParams.set("username", login.username);
    url.searchParams.set("password", login.password);
    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000), redirect: "follow", cache: "no-store" });
    if (!response.ok) return false;
    const payload = await response.json() as { user_info?: { auth?: number | string; status?: string } };
    return String(payload.user_info?.auth) === "1";
  } catch {
    return false;
  }
}

export async function xtreamPlaylist(login: XtreamLogin): Promise<string> {
  const [liveCategories, vodCategories, live, vod] = await Promise.all([
    fetchJson<Category[]>(apiUrl(login, "get_live_categories")),
    fetchJson<Category[]>(apiUrl(login, "get_vod_categories")),
    fetchJson<Stream[]>(apiUrl(login, "get_live_streams")),
    fetchJson<Stream[]>(apiUrl(login, "get_vod_streams")),
  ]);

  const names = new Map<string, string>();
  for (const category of [...liveCategories, ...vodCategories]) {
    if (category.category_id != null) names.set(String(category.category_id), category.category_name || "Uncategorised");
  }

  const lines = ["#EXTM3U"];
  let bytes = 8;
  const append = (rows: Stream[], kind: "live" | "movie") => {
    for (const row of rows) {
      const id = String(row.stream_id ?? row.id ?? "");
      if (!id) continue;
      const title = String(row.name ?? "Untitled").trim();
      const group = names.get(String(row.category_id ?? "")) || "Uncategorised";
      const logo = String(row.stream_icon ?? row.cover ?? "");
      const epg = String(row.epg_channel_id ?? "");
      const extension = typeof row.container_extension === "string" ? row.container_extension : undefined;
      const info = `#EXTINF:-1 tvg-id="${epg}" tvg-logo="${logo}" group-title="${group}",${title}`;
      const url = streamUrl(login, kind, id, extension);
      bytes += Buffer.byteLength(info, "utf8") + Buffer.byteLength(url, "utf8") + 2;
      if (bytes > MAX_RENDERED_BYTES) throw new ApiError(TOO_LARGE_MESSAGE, 413);
      lines.push(info, url);
    }
  };
  append(live, "live");
  append(vod, "movie");

  if (lines.length === 1) throw new ApiError("That Xtream login returned no live or movie streams.", 400);
  return `${lines.join("\n")}\n`;
}
