import { NextResponse } from "next/server";
import { logoutDevice } from "@/lib/iptv/sessions";
import { apiError } from "@/lib/iptv/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await logoutDevice(request);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
