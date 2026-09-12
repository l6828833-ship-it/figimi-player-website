import { NextResponse } from "next/server";
import { z } from "zod";
import { loginDevice } from "@/lib/iptv/sessions";
import { apiError, readJson } from "@/lib/iptv/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ mac: z.string().min(1).max(32), deviceKey: z.string().min(1).max(16) });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await readJson(request));
    return NextResponse.json(await loginDevice(input.mac, input.deviceKey), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
