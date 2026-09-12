import "server-only";
import { unstable_cache } from "next/cache";
import type { AdUnit, BlogPost, ContentPageRecord, SiteSettings, ToolPageRecord } from "@/types";
import { legalPages, seedSettings } from "./seed";
import { toolBySlug } from "./tools";
import { createPublicClient } from "./supabase/public";

const fileToolKinds = new Set<string>(["converter", "image-compressor", "video-compressor"]);

// Public post visibility (published, or scheduled and due) is enforced by the
// "Public can read due posts" Row-Level-Security policy on the anon client, so
// we simply exclude drafts here. We intentionally avoid a PostgREST `.or()`
// filter with an embedded timestamp, which fails to parse (unescaped colons)
// and previously caused every real post to 404 / fall back to seed content.
// We never fall back to a hardcoded sample post: a production site must only
// ever show real, author-written posts. If the DB is unreachable or has no
// published posts we return an empty list so the blog renders a clean empty
// state (and the sitemap omits fake URLs) instead of a misleading sample.
export const getPublishedPosts = unstable_cache(async (limit = 24): Promise<BlogPost[]> => { const client = createPublicClient(); if (!client) return []; try { const { data, error } = await client.from("posts").select("*").neq("status", "draft").order("published_at", { ascending: false }).limit(limit); if (error) throw error; return (data as BlogPost[]) ?? []; } catch (error) { console.warn("Failed to load posts:", error); return []; } }, ["published-posts"], { revalidate: 300, tags: ["posts"] });

export const getPostBySlug = unstable_cache(async (slug: string): Promise<BlogPost | null> => { const client = createPublicClient(); if (!client) return null; try { const { data, error } = await client.from("posts").select("*").eq("slug", slug).neq("status", "draft").maybeSingle(); if (error) throw error; return (data as BlogPost | null) ?? null; } catch { return null; } }, ["post-by-slug"], { revalidate: 300, tags: ["posts"] });

export async function getRelatedPosts(post: BlogPost) { const all = await getPublishedPosts(20); return all.filter((candidate) => candidate.slug !== post.slug && (candidate.category === post.category || candidate.tags.some((tag) => post.tags.includes(tag)))).slice(0, 3); }

export const getToolPage = unstable_cache(async (slug: string): Promise<ToolPageRecord | null> => { const tool = toolBySlug(slug); if (!tool) return null; const fallback: ToolPageRecord = { slug, title: tool.name, description: tool.shortDescription, intro: tool.description, how_to: [fileToolKinds.has(tool.kind) ? "Upload a supported file using the secure workspace." : "Enter or paste content into the workspace.", "Review the options and generated result.", fileToolKinds.has(tool.kind) ? "Download the result; temporary files are deleted automatically." : "Copy or download the result."], faq: tool.faq, body: "", seo_title: `${tool.name} — Free Online Tool`, seo_description: tool.shortDescription, og_image: null }; const client = createPublicClient(); if (!client) return fallback; try { const { data, error } = await client.from("tool_pages").select("*").eq("slug", slug).maybeSingle(); if (error) throw error; return data ? { ...fallback, ...data } as ToolPageRecord : fallback; } catch { return fallback; } }, ["tool-page"], { revalidate: 300, tags: ["tool-pages"] });

// Returns any content page by slug: a row stored in the content_pages table, or
// a built-in legal-page default, or null if neither exists (so the route 404s).
export const getContentPage = unstable_cache(async (slug: string): Promise<ContentPageRecord | null> => { const fallback = slug in legalPages ? { slug, ...legalPages[slug as keyof typeof legalPages] } : null; const client = createPublicClient(); if (!client) return fallback; try { const { data, error } = await client.from("content_pages").select("slug,title,description,body,seo_title,og_image").eq("slug", slug).maybeSingle(); if (error) throw error; return (data as ContentPageRecord | null) || fallback; } catch { return fallback; } }, ["content-page"], { revalidate: 300, tags: ["content-pages"] });

// All content-page slugs (built-in legal pages plus any custom pages in the DB),
// used to pre-render routes and for sitemaps.
export const getContentPageSlugs = unstable_cache(async (): Promise<string[]> => { const legal = Object.keys(legalPages); const client = createPublicClient(); if (!client) return legal; try { const { data, error } = await client.from("content_pages").select("slug"); if (error) throw error; const dbSlugs = (data || []).map((row) => row.slug as string); return Array.from(new Set([...legal, ...dbSlugs])); } catch { return legal; } }, ["content-page-slugs"], { revalidate: 300, tags: ["content-pages"] });

// Selects every column rather than an explicit list: a column added by a newer
// migration (e.g. ads_txt) must never make this query fail, because that would
// silently drop the analytics, AdSense, and head/body code settings too.
export const getSiteSettings = unstable_cache(async (): Promise<SiteSettings> => { const client = createPublicClient(); if (!client) return seedSettings; try { const { data, error } = await client.from("site_settings").select("*").eq("id", 1).maybeSingle(); if (error) throw error; return data ? { ...seedSettings, ...data } : seedSettings; } catch { return seedSettings; } }, ["site-settings"], { revalidate: 300, tags: ["site-settings"] });

// Ad areas are keyed by placement so every page can look up its own code with a
// single cached read. Returns an empty map when the table or DB is unavailable,
// which simply means no ads render.
export const getAdUnits = unstable_cache(async (): Promise<Record<string, AdUnit>> => { const client = createPublicClient(); if (!client) return {}; try { const { data, error } = await client.from("ad_units").select("placement,name,code,adsense_slot,enabled"); if (error) throw error; return Object.fromEntries(((data as AdUnit[]) ?? []).map((unit) => [unit.placement, unit])); } catch { return {}; } }, ["ad-units"], { revalidate: 300, tags: ["ad-units"] });
