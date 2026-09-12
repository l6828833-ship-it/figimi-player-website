import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarDays } from "lucide-react";
import type { BlogPost } from "@/types";

export function BlogCard({ post }: { post: BlogPost }) { const date = post.published_at ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(post.published_at)) : "Draft"; const imageAlt = post.featured_image_alt && !/^https?:\/\//i.test(post.featured_image_alt) ? post.featured_image_alt : post.title; return <article className="blog-card">{post.featured_image ? <Image src={post.featured_image} alt={imageAlt} loading="lazy" width={720} height={405} sizes="(max-width: 580px) 100vw, (max-width: 850px) 50vw, 33vw" /> : <div className="blog-placeholder" aria-hidden="true"><span>{post.category}</span></div>}<div><span className="post-category">{post.category}</span><h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2><p>{post.meta_description}</p><div className="post-meta"><span><CalendarDays size={15} />{date}</span><Link href={`/blog/${post.slug}`}>Read article <ArrowRight size={15} /></Link></div></div></article>; }
