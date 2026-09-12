import { NextResponse } from "next/server";
import { z } from "zod";
import { createDevicePlaylist, listDevicePlaylists, publicPlaylist } from "@/lib/iptv/playlists";
import { requireDevice } from "@/lib/iptv/sessions";
import { apiError, readJson } from "@/lib/iptv/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  sourceType: z.enum(["url", "xtream"]),
  sourceUrl: z.string().max(2048).optional(),
  host: z.string().max(2048).optional(),
  username: z.string().max(256).optional(),
  password: z.string().max(256).optional(),
});

export async function GET(request: Request) {
  try {
    const mac = await requireDevice(request);
    const playlists = (await listDevicePlaylists(mac)).map(publicPlaylist);
    return NextResponse.json({ mac, playlists }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const mac = await requireDevice(request);
    const input = schema.parse(await readJson(request));
    const playlist = await createDevicePlaylist({ ...input, mac });
    return NextResponse.json({ playlist }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
