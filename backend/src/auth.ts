import type { IncomingHttpHeaders } from "node:http";
import { authClient, db } from "./db.js";

export type AdminIdentity = { id: string; email?: string; role: "admin" | "editor"; username: string | null };

function bearer(headers: IncomingHttpHeaders): string | null {
  const value = headers.authorization;
  if (!value?.startsWith("Bearer ")) return null;
  return value.slice("Bearer ".length).trim() || null;
}

export async function requireAdmin(headers: IncomingHttpHeaders): Promise<AdminIdentity> {
  const token = bearer(headers);
  if (!token) throw Object.assign(new Error("Authentication required."), { statusCode: 401 });
  const { data, error } = await authClient().auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error("Authentication required."), { statusCode: 401 });
  const { data: profile, error: profileError } = await db()
    .from("profiles")
    .select("role,username")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError || !profile || !["admin", "editor"].includes(profile.role)) {
    throw Object.assign(new Error("Administrator access required."), { statusCode: 403 });
  }
  return { id: data.user.id, email: data.user.email, role: profile.role, username: profile.username };
}
