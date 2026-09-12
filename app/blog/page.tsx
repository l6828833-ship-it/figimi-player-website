import type { Metadata } from "next";
import { Rss } from "lucide-react";
import { AdSlot } from "@/components/ad-slot";
import { BlogCard } from "@/components/blog-card";
import { getPublishedPosts } from "@/lib/data";

export const revalidate = 300;
export const metadata: Metadata = { title: "Blog — Practical Guides for Better Digital Work", description: "Original guides about writing, document formats, file conversion, color, productivity, and using online tools safely.", alternates: { canonical: "/blog", types: { "application/rss+xml": "/rss.xml" } }, openGraph: { title: "Figimi Blog", description: "Practical guides for better digital work.", url: "/blog", type: "website" } };
export default async function BlogPage() { const posts = await getPublishedPosts(); return <div className="shell"><header className="page-hero"><span className="eyebrow">Ideas and how-tos</span><h1>Figimi Blog</h1><p>Practical, original guides for clearer writing, reliable document workflows, and better digital work.</p><a className="rss-link" href="/rss.xml"><Rss size={16} />Subscribe via RSS</a></header><AdSlot placement="blog-header" />{posts.length ? <section className="blog-grid" aria-label="Latest articles">{posts.map((post) => <BlogCard key={post.id} post={post} />)}</section> : <p className="blog-empty">No articles have been published yet. Please check back soon.</p>}</div>; }
