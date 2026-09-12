import Link from "next/link";
import { notFound } from "next/navigation";
import { Save, Trash2 } from "lucide-react";
import { deleteContentAction, saveContentAction } from "@/app/admin/actions";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { legalPages } from "@/lib/seed";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ContentPageRecord } from "@/types";

export const dynamic = "force-dynamic";

async function loadPage(slug: string): Promise<ContentPageRecord | null> {
  try {
    const { data } = await createAdminClient().from("content_pages").select("slug,title,description,body,seo_title,og_image").eq("slug", slug).maybeSingle();
    if (data) return data as ContentPageRecord;
  } catch {
    // fall through to defaults
  }
  if (slug in legalPages) {
    const page = legalPages[slug as keyof typeof legalPages];
    return { slug, title: page.title, description: page.description, body: page.body, seo_title: page.title, og_image: null };
  }
  return null;
}

export default async function ContentEditorPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string }> }) {
  const { slug } = await params;
  const { error } = await searchParams;
  const isNew = slug === "new";
  const page = isNew ? null : await loadPage(slug);
  if (!isNew && !page) notFound();
  const isLegal = !isNew && slug in legalPages;

  return (
    <>
      <div className="admin-heading">
        <div><span className="eyebrow">Site content</span><h1>{isNew ? "New page" : page!.title}</h1></div>
        <Link className="button secondary" href="/admin/pages">Cancel</Link>
      </div>
      {error && <div className="notice error">{decodeURIComponent(error)}</div>}
      <form action={saveContentAction} className="admin-form wide">
        <input type="hidden" name="original_slug" value={isNew ? "" : slug} />
        <div className="form-grid">
          <label>Page title<input name="title" required defaultValue={page?.title || ""} /></label>
          <label>
            Page URL (slug)
            <input name="slug" required pattern="[a-z0-9\-]+" defaultValue={page?.slug || ""} placeholder="about-us" readOnly={isLegal} />
            <small>{isLegal ? "The URL of built-in legal pages cannot be changed." : "The page will be available at /your-slug (lowercase letters, numbers, and hyphens)."}</small>
          </label>
          <label className="span-2">Meta description<textarea name="description" maxLength={320} rows={3} required defaultValue={page?.description || ""} /></label>
          <label>SEO title<input name="seo_title" defaultValue={page?.seo_title || page?.title || ""} /></label>
          <label>Open Graph image URL<input name="og_image" type="url" defaultValue={page?.og_image || ""} /></label>
        </div>
        <MarkdownEditor defaultValue={page?.body || ""} />
        <div className="form-submit"><button className="button primary"><Save size={17} />Save and publish</button></div>
      </form>
      {!isNew && !isLegal && (
        <form action={deleteContentAction} className="danger-zone">
          <input type="hidden" name="slug" value={slug} />
          <div><strong>Delete this page</strong><p>This permanently removes the page and its URL.</p></div>
          <button className="button danger small"><Trash2 size={16} />Delete</button>
        </form>
      )}
    </>
  );
}
