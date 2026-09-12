import { NextResponse } from "next/server";
import { playlistContent } from "@/lib/iptv/playlists";
import { apiError } from "@/lib/iptv/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ mac: string; id: string }> };

/**
 * What the TV requests. Deliberately unauthenticated apart from the per-playlist
 * access token in the query string: an IPTV player fetches a plain URL and has no
 * way to carry a session, so the token in the URL *is* the credential.
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const { mac, id } = await params;
    const key = new URL(request.url).searchParams.get("key") || "";
    const result = await playlistContent(decodeURIComponent(mac), decodeURIComponent(id), key);
    return new NextResponse(result.content, {
      status: 200,
      headers: {
        "Content-Type": "audio/x-mpegurl; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Disposition": `inline; filename="${result.name.replace(/[^a-z0-9._-]+/gi, "-")}.m3u"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
