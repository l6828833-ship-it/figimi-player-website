import { db } from "./db.js";
import { decryptJson, encryptJson } from "./crypto.js";
import { fetchText, fetchXtreamItems, m3uSecret } from "./providers.js";
import type { EncryptedValue } from "./crypto.js";
import type { CategoryRow, Locator, ProviderRow, ProviderSecret } from "./types.js";

const chunks = <T>(values: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
};
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "uncategorised";

async function providerSecret(providerId: string): Promise<{ provider: ProviderRow; secret: ProviderSecret }> {
  const client = db();
  const [{ data: provider, error: providerError }, { data: secret, error: secretError }] = await Promise.all([
    client.from("iptv_providers").select("*").eq("id", providerId).single(),
    client.from("iptv_provider_secrets").select("*").eq("provider_id", providerId).single(),
  ]);
  if (providerError || !provider) throw new Error("Provider not found.");
  if (secretError || !secret) throw new Error("Provider credentials are missing.");
  const value = decryptJson<ProviderSecret>({ ciphertext: secret.ciphertext, iv: secret.iv, authTag: secret.auth_tag, keyVersion: secret.key_version });
  return { provider: provider as ProviderRow, secret: value };
}

export async function syncProvider(providerId: string): Promise<ProviderRow> {
  const client = db();
  await client.from("iptv_providers").update({ sync_status: "syncing", sync_error: null }).eq("id", providerId);
  try {
    const { provider, secret } = await providerSecret(providerId);
    const source = provider.kind === "m3u"
      ? fetchText(m3uSecret(secret).sourceUrl).then((text) => import("./providers.js").then(({ parseM3u }) => parseM3u(text)))
      : fetchXtreamItems(provider, secret as Extract<ProviderSecret, { username: string }>);
    const items = await source;

    await client.from("iptv_titles").delete().eq("provider_id", providerId);
    await client.from("iptv_categories").delete().eq("provider_id", providerId);

    const categoryNames = Array.from(new Set(items.map((item) => item.categoryName || "Uncategorised")));
    const categoryPayload = categoryNames.map((name, sortOrder) => ({ provider_id: providerId, name, slug: slugify(name), kind: "live", sort_order: sortOrder, title_count: 0 }));
    // Categories are per kind because the same provider label can exist in multiple sections.
    const uniqueCategories = new Map<string, { name: string; kind: string; sortOrder: number }>();
    for (const item of items) {
      const name = item.categoryName || "Uncategorised";
      const key = `${item.kind}:${slugify(name)}`;
      if (!uniqueCategories.has(key)) uniqueCategories.set(key, { name, kind: item.kind, sortOrder: uniqueCategories.size });
    }
    void categoryPayload;
    const { error: categoryError } = await client.from("iptv_categories").insert(Array.from(uniqueCategories.values()).map((category) => ({ provider_id: providerId, name: category.name, slug: slugify(category.name), kind: category.kind, sort_order: category.sortOrder, title_count: 0 })));
    if (categoryError) throw categoryError;
    const { data: categories, error: selectCategoryError } = await client.from("iptv_categories").select("*").eq("provider_id", providerId);
    if (selectCategoryError) throw selectCategoryError;
    const categoryMap = new Map((categories as CategoryRow[]).map((category) => [`${category.kind}:${category.slug}`, category.id]));

    let inserted = 0;
    for (const batch of chunks(items, 250)) {
      const rows = batch.map((item) => {
        const encrypted = encryptJson(item.locator);
        return {
          provider_id: providerId,
          category_id: categoryMap.get(`${item.kind}:${slugify(item.categoryName || "Uncategorised")}`) || null,
          external_id: item.externalId,
          kind: item.kind,
          title: item.title,
          slug: slugify(item.title),
          poster_url: item.posterUrl || null,
          group_name: item.groupName || item.categoryName || null,
          epg_id: item.epgId || null,
          sort_order: item.sortOrder,
          locator_ciphertext: encrypted.ciphertext,
          locator_iv: encrypted.iv,
          locator_auth_tag: encrypted.authTag,
          metadata: item.metadata || {},
        };
      });
      const { error } = await client.from("iptv_titles").insert(rows);
      if (error) throw error;
      inserted += rows.length;
    }
    for (const category of categories as CategoryRow[]) {
      const count = items.filter((item) => item.kind === category.kind && slugify(item.categoryName || "Uncategorised") === category.slug).length;
      await client.from("iptv_categories").update({ title_count: count }).eq("id", category.id);
    }
    const { data: updated, error } = await client.from("iptv_providers").update({ sync_status: "ready", sync_error: null, last_sync_at: new Date().toISOString(), title_count: inserted, category_count: categories.length }).eq("id", providerId).select("*").single();
    if (error || !updated) throw error || new Error("Could not update provider status.");
    return updated as ProviderRow;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider sync failed.";
    await client.from("iptv_providers").update({ sync_status: "error", sync_error: message.slice(0, 500) }).eq("id", providerId);
    throw new Error(message);
  }
}

export function encryptedSecret(value: ProviderSecret): EncryptedValue {
  return encryptJson(value);
}

export function locatorFromRow(row: { locator_ciphertext: string; locator_iv: string; locator_auth_tag: string }): Locator {
  return decryptJson<Locator>({ ciphertext: row.locator_ciphertext, iv: row.locator_iv, authTag: row.locator_auth_tag, keyVersion: 1 });
}
