import { Save, Trash2 } from "lucide-react";
import { clearAdUnitAction, saveAdUnitAction } from "@/app/admin/actions";
import { adPlacements } from "@/lib/ads";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdUnit } from "@/types";

export const dynamic = "force-dynamic";

// Read through the service-role client so the form always reflects what is
// actually stored, never a cached public copy.
async function getUnits(): Promise<Record<string, AdUnit>> {
  try {
    const { data } = await createAdminClient().from("ad_units").select("placement,name,code,adsense_slot,enabled");
    return Object.fromEntries(((data as AdUnit[]) ?? []).map((unit) => [unit.placement, unit]));
  } catch {
    return {};
  }
}

export default async function AdsAdminPage({ searchParams }: { searchParams: Promise<{ saved?: string; cleared?: string; error?: string }> }) {
  const query = await searchParams, units = await getUnits();
  return (
    <>
      <div className="admin-heading"><div><span className="eyebrow">Monetization</span><h1>Ad areas</h1><p>Paste the code for any ad network — AdSense, Ezoic, Media.net, Adsterra, Monumetric, a direct sponsor banner, or an affiliate image. Empty areas render nothing at all.</p></div></div>
      {query.saved && <div className="notice success">Saved “{decodeURIComponent(query.saved)}”. The site layout was revalidated.</div>}
      {query.cleared && <div className="notice success">Ad area cleared.</div>}
      {query.error && <div className="notice error">{decodeURIComponent(query.error)}</div>}
      <div className="notice info">Most networks also need a one-time loader script. Put that in <strong>Settings &amp; codes → Custom head code</strong>, and add the network’s authorisation line under <strong>Settings &amp; codes → ads.txt</strong>.</div>
      {adPlacements.map((placement) => {
        const unit = units[placement.key], enabled = unit ? unit.enabled : true;
        return (
          <div className="admin-card" key={placement.key}>
            <h2>{placement.label}</h2>
            <p>{placement.hint}</p>
            <form action={saveAdUnitAction} className="admin-form wide">
              <input type="hidden" name="placement" value={placement.key} />
              <div className="form-grid">
                <label>Internal label<input name="name" defaultValue={unit?.name || ""} placeholder="e.g. Ezoic 728x90" /></label>
                <label>AdSense slot ID <small>(optional fallback)</small><input name="adsense_slot" defaultValue={unit?.adsense_slot || ""} inputMode="numeric" placeholder="1234567890" /></label>
                <label className="span-2">Ad code — any network
                  <textarea className="code-field" name="code" rows={7} defaultValue={unit?.code || ""} placeholder={"Paste the full unit code from your network. <script>, <ins>, <div>, <iframe>, and <img> tags all work.\nLeave empty to use the AdSense slot ID above instead."} />
                  <small>Rendered server-side inside the ad area, so scripts run as the page loads. Only paste code from networks you trust.</small>
                </label>
                <label className="span-2 inline-check"><input type="checkbox" name="enabled" defaultChecked={enabled} />Show this ad area</label>
              </div>
              <div className="form-submit"><button className="button primary"><Save size={17} />Save this area</button></div>
            </form>
            {unit && <form action={clearAdUnitAction}><input type="hidden" name="placement" value={placement.key} /><button className="button small danger"><Trash2 size={15} />Remove configuration</button></form>}
          </div>
        );
      })}
    </>
  );
}
