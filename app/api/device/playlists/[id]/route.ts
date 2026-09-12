import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteDevicePlaylist, setDevicePlaylistEnabled, updateDevicePlaylist } from "@/lib/iptv/playlists";
import { requireDevice } from "@/lib/iptv/sessions";
import { apiError, readJson } from "@/lib/iptv/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  enabled: z.boolean().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  sourceUrl: z.string().max(2048).optional(),
  host: z.string().max(2048).optional(),
  username: z.string().max(256).optional(),
  password: z.string().max(256).optional(),
});
type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const mac = await requireDevice(request);
    const { id } = await params;
    const input = schema.parse(await readJson(request));

    // Activate/deactivate and edit arrive on the same route because the dashboard
    // treats them as one row of actions; the MAC scopes both to the caller's device.
    if (input.enabled !== undefined && Object.keys(input).length === 1) {
      return NextResponse.json({ playlist: await setDevicePlaylistEnabled(id, input.enabled, mac) }, { headers: { "Cache-Control": "no-store" } });
    }
    const playlist = await updateDevicePlaylist(id, input, mac);
    if (input.enabled !== undefined) {
      return NextResponse.json({ playlist: await setDevicePlaylistEnabled(id, input.enabled, mac) }, { headers: { "Cache-Control": "no-store" } });
    }
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
