import { notFound } from "next/navigation";
import { PostForm } from "@/components/admin/post-form";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BlogPost } from "@/types";
export default async function EditPostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) { const { data } = await createAdminClient().from("posts").select("*").eq("id", (await params).id).maybeSingle(); if (!data) notFound(); return <PostForm post={data as BlogPost} error={(await searchParams).error} />; }
