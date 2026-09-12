"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { legalPages } from "@/lib/seed";
import { adPlacementKeys } from "@/lib/ads";

// Top-level paths that already exist as real routes; custom pages may not use them.
const reservedSlugs = new Set(["", "blog", "contact", "tools", "admin", "api", "new", "sitemap", "robots", "rss", "ads"]);

export type ActionState = { error?: string; success?: string };
const attempts = new Map<string, { count: number; reset: number }>();
const text = (form: FormData, key: string) => String(form.get(key) || "").trim();
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function loginAction(_: ActionState, form: FormData): Promise<ActionState> { const identifier = text(form, "identifier").toLowerCase(), password = String(form.get("password") || ""), now = Date.now(), current = attempts.get(identifier); if (current && current.reset > now && current.count >= 5) return { error: "Too many attempts. Wait 15 minutes and try again." }; attempts.set(identifier, current && current.reset > now ? { ...current, count: current.count + 1 } : { count: 1, reset: now + 15 * 60_000 }); if (!identifier || password.length < 8) return { error: "Enter a valid username or email and password." }; try { let email = identifier; if (!identifier.includes("@")) { const admin = createAdminClient(), { data: profile } = await admin.from("profiles").select("id").eq("username", identifier).maybeSingle(); if (!profile) return { error: "Invalid login details." }; const { data } = await admin.auth.admin.getUserById(profile.id); email = data.user?.email || ""; } const supabase = await createServerSupabase(); const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) return { error: "Invalid login details." }; attempts.delete(identifier); } catch { return { error: "Admin authentication is not configured. Check the Supabase environment variables." }; } redirect("/admin"); }
export async function logoutAction() { const supabase = await createServerSupabase(); await supabase.auth.signOut(); redirect("/admin/login"); }

export async function savePostAction(form: FormData) { await requireAdmin(); const admin = createAdminClient(), id = text(form, "id"), rawStatus = text(form, "status"), suppliedDate = text(form, "published_at"); const publishedAt = rawStatus === "draft" ? null : suppliedDate ? new Date(suppliedDate).toISOString() : new Date().toISOString(); const status = rawStatus === "scheduled" && publishedAt && new Date(publishedAt).getTime() <= Date.now() ? "published" : rawStatus; const payload = { title: text(form, "title"), slug: slugify(text(form, "slug") || text(form, "title")), meta_description: text(form, "meta_description"), seo_title: text(form, "seo_title") || null, featured_image: text(form, "featured_image") || null, featured_image_alt: text(form, "featured_image_alt"), og_image: text(form, "og_image") || null, category: text(form, "category") || "Guides", tags: text(form, "tags").split(",").map((item) => item.trim()).filter(Boolean), author: text(form, "author") || "Figimi Editorial", body: String(form.get("body") || ""), status, published_at: publishedAt }; if (!payload.title || !payload.slug || !payload.body) redirect(`/admin/posts/${id || "new"}?error=required`); const query = id ? admin.from("posts").update(payload).eq("id", id) : admin.from("posts").insert(payload); const { error } = await query; if (error) redirect(`/admin/posts/${id || "new"}?error=${encodeURIComponent(error.message)}`); revalidateTag("posts"); revalidatePath("/blog"); revalidatePath(`/blog/${payload.slug}`); redirect("/admin/posts?saved=1"); }
export async function deletePostAction(form: FormData) { await requireAdmin(); const id = text(form, "id"); if (id) await createAdminClient().from("posts").delete().eq("id", id); revalidateTag("posts"); revalidatePath("/blog"); redirect("/admin/posts?deleted=1"); }

export async function saveToolAction(form: FormData) { await requireAdmin(); const admin = createAdminClient(), slug = text(form, "slug"); let faq: unknown[] = []; try { faq = JSON.parse(String(form.get("faq") || "[]")); } catch { redirect(`/admin/tools/${slug}?error=invalid-faq`); } const payload = { slug, title: text(form, "title"), description: text(form, "description"), intro: String(form.get("intro") || ""), how_to: String(form.get("how_to") || "").split("\n").map((line) => line.trim()).filter(Boolean), faq, body: String(form.get("body") || ""), seo_title: text(form, "seo_title"), seo_description: text(form, "seo_description"), og_image: text(form, "og_image") || null }; const { error } = await admin.from("tool_pages").upsert(payload); if (error) redirect(`/admin/tools/${slug}?error=${encodeURIComponent(error.message)}`); revalidateTag("tool-pages"); revalidatePath(`/tools/${slug}`); redirect("/admin/tools?saved=1"); }
export async function saveContentAction(form: FormData) {
  await requireAdmin();
  const originalSlug = text(form, "original_slug");
  const editingLegal = originalSlug in legalPages;
  // The URL of built-in legal pages is fixed; custom pages derive their slug from the field.
  const target = editingLegal ? originalSlug : slugify(text(form, "slug") || text(form, "title"));
  const backTo = originalSlug || "new";
  if (!target || reservedSlugs.has(target)) redirect(`/admin/pages/${backTo}?error=${encodeURIComponent("That URL is reserved or invalid. Please choose a different slug.")}`);
  const payload = { slug: target, title: text(form, "title"), description: text(form, "description"), body: String(form.get("body") || ""), seo_title: text(form, "seo_title") || null, og_image: text(form, "og_image") || null };
  if (!payload.title || !payload.description) redirect(`/admin/pages/${backTo}?error=${encodeURIComponent("Title and meta description are required.")}`);
  const admin = createAdminClient();
  // Prevent overwriting a different existing page when creating or renaming.
  if (target !== originalSlug) { const { data: existing } = await admin.from("content_pages").select("slug").eq("slug", target).maybeSingle(); if (existing) redirect(`/admin/pages/${backTo}?error=${encodeURIComponent("A page with that URL already exists.")}`); }
  const { error } = await admin.from("content_pages").upsert(payload);
  if (error) redirect(`/admin/pages/${backTo}?error=${encodeURIComponent(error.message)}`);
  // On rename, remove the old row and revalidate its former URL.
  if (originalSlug && originalSlug !== target && !editingLegal) { await admin.from("content_pages").delete().eq("slug", originalSlug); revalidatePath(`/${originalSlug}`); }
  revalidateTag("content-pages");
  revalidatePath(`/${target}`);
  redirect("/admin/pages?saved=1");
}
export async function deleteContentAction(form: FormData) {
  await requireAdmin();
  const slug = text(form, "slug");
  if (slug && !(slug in legalPages)) { await createAdminClient().from("content_pages").delete().eq("slug", slug); revalidatePath(`/${slug}`); }
  revalidateTag("content-pages");
  redirect("/admin/pages?deleted=1");
}
export async function saveSettingsAction(form: FormData) { await requireAdmin(); const payload = { id: 1, analytics_id: text(form, "analytics_id"), adsense_client_id: text(form, "adsense_client_id"), google_tag_id: text(form, "google_tag_id"), head_code: String(form.get("head_code") || ""), body_code: String(form.get("body_code") || ""), ads_txt: String(form.get("ads_txt") || "") }; const { error } = await createAdminClient().from("site_settings").upsert(payload); if (error) redirect(`/admin/settings?error=${encodeURIComponent(error.message)}`); revalidateTag("site-settings"); revalidatePath("/", "layout"); revalidatePath("/ads.txt"); redirect("/admin/settings?saved=1"); }

// Saves the code for one ad area. The code may come from any ad network; it is
// stored verbatim and rendered into the page by the AdSlot component.
export async function saveAdUnitAction(form: FormData) {
  await requireAdmin();
  const placement = text(form, "placement");
  if (!adPlacementKeys.includes(placement)) redirect(`/admin/ads?error=${encodeURIComponent("Unknown ad placement.")}`);
  const payload = { placement, name: text(form, "name"), code: String(form.get("code") || ""), adsense_slot: text(form, "adsense_slot").replace(/\D/g, ""), enabled: form.get("enabled") === "on" };
  const { error } = await createAdminClient().from("ad_units").upsert(payload);
  if (error) redirect(`/admin/ads?error=${encodeURIComponent(error.message)}`);
  revalidateTag("ad-units");
  revalidatePath("/", "layout");
  redirect(`/admin/ads?saved=${encodeURIComponent(placement)}`);
}

export async function clearAdUnitAction(form: FormData) {
  await requireAdmin();
  const placement = text(form, "placement");
  if (placement) await createAdminClient().from("ad_units").delete().eq("placement", placement);
  revalidateTag("ad-units");
  revalidatePath("/", "layout");
  redirect("/admin/ads?cleared=1");
}

export async function uploadMediaAction(form: FormData) { const { user } = await requireAdmin(); const file = form.get("file"); if (!(file instanceof File) || !file.size) redirect("/admin/media?error=file"); if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) redirect("/admin/media?error=type"); const admin = createAdminClient(), safe = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-100), path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safe}`; const { error: uploadError } = await admin.storage.from("media").upload(path, file, { contentType: file.type, upsert: false, cacheControl: "31536000" }); if (uploadError) redirect(`/admin/media?error=${encodeURIComponent(uploadError.message)}`); const { data } = admin.storage.from("media").getPublicUrl(path); const cdnBase = process.env.NEXT_PUBLIC_MEDIA_CDN_URL?.replace(/\/$/, ""), url = cdnBase ? `${cdnBase}/${path}` : data.publicUrl; await admin.from("media").insert({ name: file.name, path, url, alt_text: text(form, "alt_text"), mime_type: file.type, size_bytes: file.size, created_by: user.id }); redirect("/admin/media?uploaded=1"); }
export async function deleteMediaAction(form: FormData) { await requireAdmin(); const id = text(form, "id"), path = text(form, "path"), admin = createAdminClient(); if (path) await admin.storage.from("media").remove([path]); if (id) await admin.from("media").delete().eq("id", id); redirect("/admin/media?deleted=1"); }
