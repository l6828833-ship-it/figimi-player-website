import { PostForm } from "@/components/admin/post-form";
export default async function NewPostPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) { return <PostForm error={(await searchParams).error} />; }
