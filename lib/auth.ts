import "server-only";
import { redirect } from "next/navigation";
import { createServerSupabase } from "./supabase/server";

export async function requireAdmin() { const supabase = await createServerSupabase(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/admin/login"); const { data: profile } = await supabase.from("profiles").select("role,username").eq("id", user.id).maybeSingle(); if (!profile || !["admin", "editor"].includes(profile.role)) { await supabase.auth.signOut(); redirect("/admin/login?error=unauthorized"); } return { user, profile, supabase }; }
