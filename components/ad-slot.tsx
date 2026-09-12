import { normalizeAdsenseClient } from "@/lib/ads";
import { getAdUnits, getSiteSettings } from "@/lib/data";
import { AdsenseUnit } from "./adsense-unit";
import { CodeSnippet } from "./code-snippet";

/**
 * A network-agnostic ad area.
 *
 * The code for each placement is managed in Admin -> Ads, so any provider works:
 * AdSense, Ezoic, Media.net, Adsterra, Monumetric, a direct sponsor banner, or
 * a plain affiliate image. Resolution order:
 *
 *  1. Custom code saved for the placement (any network) — server-rendered so the
 *     network's script runs while the page parses.
 *  2. An AdSense slot ID, when only the Google publisher ID is configured.
 *  3. Nothing at all — no empty grey box, so unused areas cost no layout space.
 */
export async function AdSlot({ placement, className = "" }: { placement: string; className?: string }) {
  const [units, settings] = await Promise.all([getAdUnits(), getSiteSettings()]);
  const unit = units[placement];
  if (unit && !unit.enabled) return null;

  const code = unit?.code?.trim() || "";
  const client = normalizeAdsenseClient(settings.adsense_client_id || process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID);
  const adsenseSlot = unit?.adsense_slot?.trim() || "";
  const useAdsense = !code && Boolean(client && adsenseSlot);
  if (!code && !useAdsense) return null;

  return (
    <aside className={`ad-slot ${className}`.trim()} aria-label="Advertisement" data-ad-placement={placement}>
      {useAdsense ? <AdsenseUnit client={client} slot={adsenseSlot} /> : <CodeSnippet code={code} target="body" />}
    </aside>
  );
}
