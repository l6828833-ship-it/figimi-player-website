import type { MetadataRoute } from "next";
import { getContentPageSlugs, getPublishedPosts } from "@/lib/data";
import { absoluteUrl } from "@/lib/site";
import { tools } from "@/lib/tools";

export const revalidate = 300;

// Stable last-modified dates so the sitemap doesn't report "changed just now"
// on every 5-minute revalidation. Bump these when the pages/tools meaningfully
// change; blog URLs derive their dates from the posts themselves.
const PAGES_LAST_MODIFIED = new Date("2026-07-23T00:00:00.000Z");
const TOOLS_LAST_MODIFIED = new Date("2026-07-23T00:00:00.000Z");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> { const posts = await getPublishedPosts(1000), contentSlugs = await getContentPageSlugs(); const newestPost = posts.reduce<Date>((latest, post) => { const updated = new Date(post.updated_at); return updated > latest ? updated : latest; }, PAGES_LAST_MODIFIED); return [{ url: absoluteUrl("/"), lastModified: newestPost, changeFrequency: "weekly", priority: 1 }, { url: absoluteUrl("/blog"), lastModified: newestPost, changeFrequency: "weekly", priority: .8 }, { url: absoluteUrl("/contact"), lastModified: PAGES_LAST_MODIFIED, changeFrequency: "monthly" as const, priority: .5 }, ...contentSlugs.map((slug) => ({ url: absoluteUrl(`/${slug}`), lastModified: PAGES_LAST_MODIFIED, changeFrequency: "monthly" as const, priority: .5 })), ...tools.map((tool) => ({ url: absoluteUrl(`/tools/${tool.slug}`), lastModified: TOOLS_LAST_MODIFIED, changeFrequency: "monthly" as const, priority: .8 })), ...posts.map((post) => ({ url: absoluteUrl(`/blog/${post.slug}`), lastModified: new Date(post.updated_at), changeFrequency: "monthly" as const, priority: .7 }))]; }
