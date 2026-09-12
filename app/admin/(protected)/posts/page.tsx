import Link from "next/link";
import { Edit3, Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function PostsPage({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string }> }) {
  const notices = await searchParams;
  const admin = createAdminClient();
  // Auto-promote scheduled posts whose publish time has passed, so the admin
  // status matches what is actually live on the site.
  await admin.from("posts").update({ status: "published" }).eq("status", "scheduled").lte("published_at", new Date().toISOString());
  const { data: posts } = await admin.from("posts").select("id,title,slug,status,published_at,updated_at").order("updated_at", { ascending: false });
  const now = Date.now();
  return (
    <>
      <div className="admin-heading">
        <div><span className="eyebrow">Blog CMS</span><h1>Posts</h1></div>
        <Link className="button primary" href="/admin/posts/new"><Plus size={17} />New post</Link>
      </div>
      {(notices.saved || notices.deleted) && <div className="notice success">Post {notices.deleted ? "deleted" : "saved"}.</div>}
      <div className="admin-table">
        <table>
          <thead><tr><th>Title</th><th>Status</th><th>Publication</th><th><span className="sr-only">Action</span></th></tr></thead>
          <tbody>
            {posts?.map((post) => {
              const effectiveStatus = post.status === "scheduled" && post.published_at && new Date(post.published_at).getTime() <= now ? "published" : post.status;
              return (
                <tr key={post.id}>
                  <td><strong>{post.title}</strong><small>/{post.slug}</small></td>
                  <td><span className={`status ${effectiveStatus}`}>{effectiveStatus}</span></td>
                  <td>{post.published_at ? new Date(post.published_at).toLocaleString() : "Not set"}</td>
                  <td><Link className="icon-button" href={`/admin/posts/${post.id}`} title="Edit post"><Edit3 size={17} /></Link></td>
                </tr>
              );
            })}
            {!posts?.length && <tr><td colSpan={4}>No posts yet. Create the first one.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
