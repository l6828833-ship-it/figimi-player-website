import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = { title: "Admin Login", robots: { index: false, follow: false } };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) { const { error } = await searchParams; return <main className="login-page"><div className="login-panel"><Link className="brand" href="/">{/* eslint-disable-next-line @next/next/no-img-element */}<img className="brand-logo" src="/logo.svg" alt="" width={36} height={36} aria-hidden="true" />Figimi</Link><span className="eyebrow">Protected area</span><h1>Admin sign in</h1><p>Manage public content, posts, media, metadata, and integrations.</p>{error === "unauthorized" && <div className="notice error">This account does not have admin access.</div>}<LoginForm /><Link className="back-link" href="/">← Return to website</Link></div></main>; }
