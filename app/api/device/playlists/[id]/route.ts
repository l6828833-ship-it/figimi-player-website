import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteDevicePlaylist, setDevicePlaylistEnabled } from "@/lib/iptv/playlists";
import { requireDevice } from "@/lib/iptv/sessions";
import { apiError, readJson } from "@/lib/iptv/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ enabled: z.boolean() });
type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const mac = await requireDevice(request);
    const { id } = await params;
    const input = schema.parse(await readJson(request));
    // The MAC is passed through so a session can only change its own device's playlists.
    const playlist = await setDevicePlaylistEnabled(id, input.enabled, mac);
    return NextResponse.json({ playlist }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const mac = await requireDevice(request);
    const { id } = await params;
    await deleteDevicePlaylist(id, mac);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
