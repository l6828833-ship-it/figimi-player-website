import Link from "next/link";
import { Edit3, Plus } from "lucide-react";
import { legalPages } from "@/lib/seed";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function listPages(): Promise<{ slug: string; title: string }[]> {
  const map = new Map<string, string>();
  // Built-in legal/default pages always appear.
  for (const [slug, page] of Object.entries(legalPages)) map.set(slug, page.title);
  // Merge any custom or edited pages stored in the database (authoritative).
  try {
    const { data } = await createAdminClient().from("content_pages").select("slug,title");
    for (const row of data || []) map.set(row.slug as string, (row.title as string) || (row.slug as string));
  } catch {
    // If the admin client is not configured, fall back to defaults only.
  }
  return Array.from(map, ([slug, title]) => ({ slug, title })).sort((a, b) => a.title.localeCompare(b.title));
}

export default async function PagesAdminPage({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string }> }) {
  const { saved, deleted } = await searchParams;
  const pages = await listPages();
  return (
    <>
      <div className="admin-heading">
        <div><span className="eyebrow">Site content</span><h1>Pages</h1></div>
        <Link className="button primary" href="/admin/pages/new"><Plus size={17} />New page</Link>
      </div>
      {saved && <div className="notice success">Page saved and revalidated.</div>}
      {deleted && <div className="notice success">Page deleted.</div>}
      <div className="admin-list">
        {pages.map((page) => (
          <Link href={`/admin/pages/${page.slug}`} key={page.slug}>
            <span><strong>{page.title}</strong><small>/{page.slug}</small></span>
            <Edit3 size={17} />
          </Link>
        ))}
      </div>
    </>
  );
}
