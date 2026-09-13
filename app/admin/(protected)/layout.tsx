import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Gauge, Globe2, Image as ImageIcon, LogOut, Megaphone, MonitorSmartphone, Newspaper, Settings, Tv2 } from "lucide-react";
import { logoutAction } from "../actions";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Figimi Admin" }, robots: { index: false, follow: false } };
export default async function AdminLayout({ children }: { children: React.ReactNode }) { const { user, profile } = await requireAdmin(); return <div className="admin-shell"><aside className="admin-sidebar"><Link className="admin-brand" href="/admin">Figimi <span>Admin</span></Link><nav><Link href="/admin"><Gauge />Dashboard</Link><Link href="/admin/posts"><Newspaper />Blog posts</Link><Link href="/admin/tools"><FileText />Tool pages</Link><Link href="/admin/pages"><Globe2 />Site pages</Link><Link href="/admin/media"><ImageIcon />Media</Link><Link href="/admin/devices"><MonitorSmartphone />Devices</Link><Link href="/admin/iptv"><Tv2 />Device playlists</Link><Link href="/admin/ads"><Megaphone />Ad areas</Link><Link href="/admin/settings"><Settings />Settings & codes</Link></nav><div className="admin-user"><span>{profile.username || user.email}</span><small>{profile.role}</small><form action={logoutAction}><button><LogOut size={16} />Sign out</button></form></div></aside><main className="admin-main">{children}</main></div>; }
