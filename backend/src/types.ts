export type MediaKind = "live" | "movie" | "series";
export type ProviderKind = "m3u" | "xtream";

export type M3uSecret = { sourceUrl: string };
export type XtreamSecret = { username: string; password: string };
export type ProviderSecret = M3uSecret | XtreamSecret;

export type Locator =
  | { type: "m3u"; url: string }
  | { type: "xtream"; kind: MediaKind; externalId: string; extension?: string };

export type ProviderRow = {
  id: string;
  name: string;
  kind: ProviderKind;
  endpoint: string;
  enabled: boolean;
  sync_status: "never" | "syncing" | "ready" | "error";
  sync_error: string | null;
  last_sync_at: string | null;
  title_count: number;
  category_count: number;
};

export type SecretRow = {
  provider_id: string;
  ciphertext: string;
  iv: string;
  auth_tag: string;
  key_version: number;
};

export type CategoryRow = {
  id: string;
  provider_id: string;
  name: string;
  slug: string;
  kind: MediaKind;
  sort_order: number;
  title_count: number;
};

export type TitleRow = {
  id: string;
  provider_id: string;
  category_id: string | null;
  external_id: string;
  kind: MediaKind;
  title: string;
  slug: string;
  poster_url: string | null;
  group_name: string | null;
  epg_id: string | null;
  sort_order: number;
  locator_ciphertext: string;
  locator_iv: string;
  locator_auth_tag: string;
  metadata: Record<string, unknown>;
};

export type NormalizedItem = {
  externalId: string;
  kind: MediaKind;
  title: string;
  posterUrl?: string | null;
  groupName?: string | null;
  epgId?: string | null;
  categoryName?: string | null;
  sortOrder: number;
  locator: Locator;
  metadata?: Record<string, unknown>;
};
