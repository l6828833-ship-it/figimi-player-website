import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => request.cookies.getAll(), setAll: (cookies) => { cookies.forEach(({ name, value }) => request.cookies.set(name, value)); response = NextResponse.next({ request }); cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); } } });
  const { data: { user } } = await supabase.auth.getUser();
  if (request.nextUrl.pathname.startsWith("/admin") && request.nextUrl.pathname !== "/admin/login" && !user) { const url = request.nextUrl.clone(); url.pathname = "/admin/login"; return NextResponse.redirect(url); }
  if (request.nextUrl.pathname === "/admin/login" && user) { const url = request.nextUrl.clone(); url.pathname = "/admin"; return NextResponse.redirect(url); }
  return response;
}
export const config = { matcher: ["/admin/:path*"] };
