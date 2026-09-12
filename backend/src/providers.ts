import type { Locator, MediaKind, M3uSecret, NormalizedItem, ProviderRow, XtreamSecret } from "./types.js";

const timeout = (milliseconds: number) => AbortSignal.timeout(milliseconds);

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "uncategorised";
}

function classify(group: string, value: string): MediaKind {
  const text = `${group} ${value}`.toLowerCase();
  if (/series|season|episode|tv show|serie/.test(text)) return "series";
  if (/movie|movies|film|vod|cinema|film/.test(text)) return "movie";
  return "live";
}

function attributes(value: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pattern = /([\w-]+)=(?:"([^"]*)"|'([^']*)'|([^\s,]*))/g;
  for (const match of value.matchAll(pattern)) result[match[1]] = match[2] ?? match[3] ?? match[4] ?? "";
  return result;
}

export async function fetchText(url: string, maximumBytes = 80 * 1024 * 1024): Promise<string> {
  const response = await fetch(url, { signal: timeout(60_000), redirect: "follow" });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > maximumBytes) throw new Error("Provider playlist is larger than the allowed limit.");
  const reader = response.body?.getReader();
  if (!reader) return await response.text();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    total += next.value.byteLength;
    if (total > maximumBytes) throw new Error("Provider playlist is larger than the allowed limit.");
    chunks.push(next.value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: timeout(60_000), redirect: "follow" });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
  return (await response.json()) as T;
}

export function parseM3u(source: string): NormalizedItem[] {
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  const items: NormalizedItem[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const info = lines[index]?.trim();
    if (!info.startsWith("#EXTINF:")) continue;
    const comma = info.indexOf(",");
    if (comma < 0) continue;
    const url = lines[index + 1]?.trim();
    if (!url || url.startsWith("#")) continue;
    const attrs = attributes(info.slice(0, comma));
    const title = info.slice(comma + 1).trim() || attrs["tvg-name"] || "Untitled";
    const groupName = attrs["group-title"] || "Uncategorised";
    const kind = classify(groupName, `${title} ${url}`);
    const locator: Locator = { type: "m3u", url };
    items.push({
      externalId: attrs["tvg-id"] || `${kind}-${items.length + 1}-${title}`,
      kind,
      title,
      posterUrl: attrs["tvg-logo"] || null,
      groupName,
      epgId: attrs["tvg-id"] || null,
      categoryName: groupName,
      sortOrder: items.length,
      locator,
      metadata: { language: attrs["tvg-language"] || null, country: attrs["tvg-country"] || null },
    });
  }
  return items;
}

function xtreamEndpoint(provider: ProviderRow, secret: XtreamSecret, action: string): string {
  const base = provider.endpoint.replace(/\/+$/, "").replace(/\/player_api\.php$/i, "");
  const url = new URL(`${base}/player_api.php`);
  url.searchParams.set("username", secret.username);
  url.searchParams.set("password", secret.password);
  url.searchParams.set("action", action);
  return url.toString();
}

function xtreamStreamUrl(provider: ProviderRow, secret: XtreamSecret, kind: MediaKind, id: string, extension?: string): string {
  const base = provider.endpoint.replace(/\/+$/, "").replace(/\/player_api\.php$/i, "");
  if (kind === "live") return `${base}/live/${encodeURIComponent(secret.username)}/${encodeURIComponent(secret.password)}/${encodeURIComponent(id)}.ts`;
  return `${base}/${kind === "movie" ? "movie" : "series"}/${encodeURIComponent(secret.username)}/${encodeURIComponent(secret.password)}/${encodeURIComponent(id)}.${extension || "mp4"}`;
}

export async function fetchXtreamItems(provider: ProviderRow, secret: XtreamSecret): Promise<NormalizedItem[]> {
  type Category = { category_id?: string | number; category_name?: string };
  type Stream = Record<string, unknown>;
  const [liveCategories, vodCategories, seriesCategories, live, vod, series] = await Promise.all([
    fetchJson<Category[]>(xtreamEndpoint(provider, secret, "get_live_categories")),
    fetchJson<Category[]>(xtreamEndpoint(provider, secret, "get_vod_categories")),
    fetchJson<Category[]>(xtreamEndpoint(provider, secret, "get_series_categories")),
    fetchJson<Stream[]>(xtreamEndpoint(provider, secret, "get_live_streams")),
    fetchJson<Stream[]>(xtreamEndpoint(provider, secret, "get_vod_streams")),
    fetchJson<Stream[]>(xtreamEndpoint(provider, secret, "get_series")),
  ]);
  const categoryNames = new Map<string, string>();
  for (const category of [...liveCategories, ...vodCategories, ...seriesCategories]) {
    if (category.category_id != null) categoryNames.set(String(category.category_id), category.category_name || "Uncategorised");
  }
  const normalize = (rows: Stream[], kind: MediaKind): NormalizedItem[] => rows.map((row, sortOrder) => {
    const id = String(row.stream_id ?? row.series_id ?? row.id ?? "");
    const categoryName = categoryNames.get(String(row.category_id ?? "")) || "Uncategorised";
    const title = String(row.name ?? "Untitled").trim();
    const extension = typeof row.container_extension === "string" ? row.container_extension : undefined;
    return {
      externalId: id,
      kind,
      title,
      posterUrl: String(row.stream_icon ?? row.cover ?? "") || null,
      groupName: categoryName,
      epgId: String(row.epg_channel_id ?? "") || null,
      categoryName,
      sortOrder,
      locator: { type: "xtream", kind, externalId: id, extension },
      metadata: { rating: row.rating, year: row.year, plot: row.plot },
    };
  });
  return [...normalize(live, "live"), ...normalize(vod, "movie"), ...normalize(series, "series")];
}

export function xtreamPlaybackUrl(provider: ProviderRow, secret: XtreamSecret, locator: Extract<Locator, { type: "xtream" }>): string {
  return xtreamStreamUrl(provider, secret, locator.kind, locator.externalId, locator.extension);
}

export function xtreamApiUrl(provider: ProviderRow, secret: XtreamSecret, action: string, extra: Record<string, string> = {}): string {
  const url = new URL(xtreamEndpoint(provider, secret, action));
  for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
  return url.toString();
}

export async function fetchXtreamEpisodes(provider: ProviderRow, secret: XtreamSecret, seriesId: string): Promise<unknown[]> {
  const result = await fetchJson<{ episodes?: unknown[] }>(xtreamApiUrl(provider, secret, "get_series_info", { series_id: seriesId }));
  return result.episodes || [];
}

export function m3uSecret(value: unknown): M3uSecret {
  if (!value || typeof value !== "object" || typeof (value as M3uSecret).sourceUrl !== "string") throw new Error("Invalid M3U secret.");
  return value as M3uSecret;
}
