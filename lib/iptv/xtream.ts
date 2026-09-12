import "server-only";
import { ApiError } from "./mac";

export type XtreamLogin = { host: string; username: string; password: string };
type Category = { category_id?: string | number; category_name?: string };
type Stream = Record<string, unknown>;

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
  const append = (rows: Stream[], kind: "live" | "movie") => {
    for (const row of rows) {
      const id = String(row.stream_id ?? row.id ?? "");
      if (!id) continue;
      const title = String(row.name ?? "Untitled").trim();
      const group = names.get(String(row.category_id ?? "")) || "Uncategorised";
      const logo = String(row.stream_icon ?? row.cover ?? "");
      const epg = String(row.epg_channel_id ?? "");
      const extension = typeof row.container_extension === "string" ? row.container_extension : undefined;
      lines.push(`#EXTINF:-1 tvg-id="${epg}" tvg-logo="${logo}" group-title="${group}",${title}`);
      lines.push(streamUrl(login, kind, id, extension));
    }
  };
  append(live, "live");
  append(vod, "movie");

  if (lines.length === 1) throw new ApiError("That Xtream login returned no live or movie streams.", 400);
  return `${lines.join("\n")}\n`;
}
