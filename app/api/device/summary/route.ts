import { NextResponse } from "next/server";
import { deviceSummary } from "@/lib/iptv/devices";
import { requireDevice } from "@/lib/iptv/sessions";
import { apiError } from "@/lib/iptv/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Subscription and device facts for the dashboard's status widget. */
export async function GET(request: Request) {
  try {
    const mac = await requireDevice(request);
    return NextResponse.json({ device: await deviceSummary(mac) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
