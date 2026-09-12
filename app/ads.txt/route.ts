import { normalizeAdsenseClient } from "@/lib/ads";
import { getSiteSettings } from "@/lib/data";

export const revalidate = 300;

/**
 * Serves /ads.txt for any combination of networks: the AdSense line is derived
 * from the publisher ID, and every other network is authorised through the
 * free-form lines saved in Admin -> Settings -> ads.txt.
 */
export async function GET() {
  const settings = await getSiteSettings();
  const adsense = normalizeAdsenseClient(settings.adsense_client_id || process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID);
  const lines: string[] = [];
  if (adsense) lines.push(`google.com, ${adsense.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0`);
  // Custom lines win over the generated one if the same seller is listed twice,
  // so duplicates are removed while preserving order.
  (settings.ads_txt || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line) => { if (!lines.includes(line)) lines.push(line); });
  const body = lines.length ? `${lines.join("\n")}\n` : "# Add your ad network authorisation lines in the admin panel (Settings -> ads.txt).\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, s-maxage=300" } });
}
