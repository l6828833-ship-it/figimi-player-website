import { Trash2, Upload } from "lucide-react";
import { deleteMediaAction, uploadMediaAction } from "@/app/admin/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { CopyField } from "@/components/admin/copy-field";

type MediaRow = { id: string; name: string; path: string; url: string; alt_text: string };

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ error?: string; uploaded?: string; deleted?: string }> }) {
  const query = await searchParams;
  let media: MediaRow[] = [];
  let loadError = "";
  try {
    const { data, error } = await createAdminClient().from("media").select("*").order("created_at", { ascending: false });
    if (error) loadError = error.message;
    else media = (data || []) as MediaRow[];
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not connect to Supabase.";
  }

  return <>
    <div className="admin-heading"><div><span className="eyebrow">Supabase Storage</span><h1>Media library</h1><p>Images are stored in the public media bucket. Configure a Cloudflare media hostname to place them behind your CDN.</p></div></div>
    {loadError && <div className="notice error">Could not load media: {loadError}. Make sure SUPABASE_SERVICE_ROLE_KEY is set in your environment.</div>}
    {query.error && <div className="notice error">Upload failed. Use JPG, PNG, WebP, or GIF up to 5 MB.</div>}
    {(query.uploaded || query.deleted) && <div className="notice success">Media library updated.</div>}
    <form action={uploadMediaAction} className="media-upload"><label>Image<input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required /></label><label>Alt text<input name="alt_text" required placeholder="Describe the image" /></label><button className="button primary"><Upload size={17} />Upload</button></form>
    <div className="media-grid">
      {media.map((item) => <article key={item.id}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url} alt={item.alt_text} width={320} height={180} loading="lazy" />
        <div><strong>{item.name}</strong><small>{item.alt_text}</small><CopyField value={item.url} /><form action={deleteMediaAction}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="path" value={item.path} /><button title="Delete image"><Trash2 size={16} /></button></form></div>
      </article>)}
      {!media.length && !loadError && <p>No media uploaded yet.</p>}
    </div>
  </>;
}
