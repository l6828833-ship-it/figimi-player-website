import { NextResponse } from "next/server";
import { requireDevice } from "@/lib/iptv/sessions";
import { apiError } from "@/lib/iptv/respond";
import { usesDefaultDeviceKeySecret } from "@/lib/iptv/device-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Configuration health for the signed-in device's own dashboard.
 *
 * Reports only whether each server value is present and, for the encryption key, how
 * many bytes it decodes to — never the values themselves. A key that is set but the
 * wrong length fails exactly like one that is missing, and without the length there is
 * no way to tell those apart from the outside.
 *
 * Requires a device session so this is not an open window onto the deployment's config.
 */
export async function GET(request: Request) {
  try {
    await requireDevice(request);

    const raw = process.env.IPTV_CREDENTIALS_KEY?.trim() || "";
    const decodedBytes = raw
      ? (/^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64")).length
      : 0;

    return NextResponse.json({
      encryptionKey: { present: Boolean(raw), characters: raw.length, decodedBytes, valid: decodedBytes === 32 },
      supabase: {
        url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      },
      deviceKeySecret: { usingDefault: usesDefaultDeviceKeySecret() },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
