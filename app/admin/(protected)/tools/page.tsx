import Link from "next/link";
import { Edit3 } from "lucide-react";
import { tools } from "@/lib/tools";
export default async function ToolsAdminPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) { const { saved } = await searchParams; return <><div className="admin-heading"><div><span className="eyebrow">Page content</span><h1>Tool pages</h1><p>Edit content, FAQs, and SEO metadata. Tool behavior remains in source control.</p></div></div>{saved && <div className="notice success">Tool page saved and revalidated.</div>}<div className="admin-list">{tools.map((tool) => <Link href={`/admin/tools/${tool.slug}`} key={tool.slug}><span><strong>{tool.name}</strong><small>{tool.category} · /tools/{tool.slug}</small></span><Edit3 size={17} /></Link>)}</div></>; }
