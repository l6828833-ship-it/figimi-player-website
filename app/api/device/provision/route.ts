import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyDeviceKey } from "@/lib/iptv/device-key";
import { deviceSummary, touchDevice } from "@/lib/iptv/devices";
import { deviceSources } from "@/lib/iptv/playlists";
import { ApiError, normalizeMac } from "@/lib/iptv/mac";
import { apiError, readJson } from "@/lib/iptv/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ mac: z.string().min(1).max(32), deviceKey: z.string().min(1).max(16) });

/**
 * Called by the TV app itself, which derives its own 6-digit key and so can
 * authenticate with no user input. Returns the playlist sources for that device.
 *
 * No session is issued: this is a single read for a device that already knows its own
 * identity, and handing out a long-lived token to a set-top box would be more to leak
 * than the one response it needs.
 */
export async function POST(request: Request) {
  try {
    const input = schema.parse(await readJson(request));
    const mac = normalizeMac(input.mac);
    if (!verifyDeviceKey(mac, input.deviceKey)) throw new ApiError("That device key does not match this MAC address.", 401);

    // First contact from the app starts the trial, so the 7 days count from real first
    // use and cannot be reset by reinstalling.
    const { blocked } = await touchDevice(mac);

    const device = blocked ? null : await deviceSummary(mac);
    // A block is answered with a flag the app can act on, not just a message. The TV has
    // playlists cached locally, so it has to be told "you are blocked" explicitly to
    // clear them and lock itself; a bare 403 was indistinguishable from a bad network
    // and left a blocked device playing from its cache.
    if (blocked || device?.disabled) {
      return NextResponse.json({
        mac,
        blocked: true,
        sources: [],
        error: "This device has been blocked. Contact support.",
      }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    if (!device) throw new ApiError("This device could not be read.", 500);
    // An expired subscription returns the status without sources, so the TV can show
    // "renew" rather than a generic empty screen.
    const sources = device.expired ? [] : await deviceSources(mac);
    return NextResponse.json({
      mac,
      blocked: false,
      subscription: { plan: device.plan, expiresAt: device.subscriptionExpiresAt, daysRemaining: device.daysRemaining, expired: device.expired },
      sources,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
