import { Save } from "lucide-react";
import { saveSettingsAction } from "@/app/admin/actions";
import { parseSnippet } from "@/lib/html-snippet";
import { createAdminClient } from "@/lib/supabase/admin";
import { seedSettings } from "@/lib/seed";
import type { SiteSettings } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Shows how the saved snippet is actually applied, so a pasted verification tag
 * can be confirmed without digging through the page source.
 */
function SnippetReport({ code, target }: { code: string; target: "head" | "body" }) {
  if (!code.trim()) return null;
  const { nodes, leftover } = parseSnippet(code, target);
  if (!nodes.length && !leftover) return <small className="snippet-report warn">Nothing detected in this code. Check that it is a complete snippet.</small>;
  const summary = nodes.map((node) => {
    const label = node.attrs.name || node.attrs.property || node.attrs["http-equiv"] || node.attrs.src || (node.tag === "script" ? "inline script" : "");
    return `<${node.tag}>${label ? ` ${label.slice(0, 60)}` : ""}`;
  });
  return (
    <small className="snippet-report">
      {nodes.length > 0 && <>In the server-rendered HTML: {summary.join(", ")}. </>}
      {leftover && <span className="warn">Some markup can only be added by the browser after load, so it is not visible to verifiers: {leftover.slice(0, 120)}…</span>}
    </small>
  );
}

// Read the authoritative, uncached settings via the service-role client so the
// edit form always shows what is actually stored. Reading through the public
// (anon) cached path could show empty values and cause an accidental overwrite
// of all settings when the admin saves.
async function getEditableSettings(): Promise<SiteSettings> {
  try {
    const { data } = await createAdminClient().from("site_settings").select("*").eq("id", 1).maybeSingle();
    return data ? { ...seedSettings, ...(data as Partial<SiteSettings>) } : seedSettings;
  } catch {
    return seedSettings;
  }
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const query = await searchParams, settings = await getEditableSettings();
  return (
    <>
      <div className="admin-heading"><div><span className="eyebrow">Integrations</span><h1>Settings &amp; codes</h1><p>Changes revalidate the shared site layout. Environment variables remain the preferred production fallback.</p></div></div>
      {query.saved && <div className="notice success">Settings saved. Head and body code are rendered into the live HTML — open the site and use “View page source” to confirm.</div>}
      {query.error && <div className="notice error">{decodeURIComponent(query.error)}</div>}
      <form action={saveSettingsAction} className="admin-form wide">
        <div className="form-grid">
          <label>Google Analytics measurement ID<input name="analytics_id" defaultValue={settings.analytics_id} placeholder="G-XXXXXXXXXX" /></label>
          <label>Google Tag Manager / Google tag ID<input name="google_tag_id" defaultValue={settings.google_tag_id} placeholder="GTM-XXXXXXX or G-XXXXXXXXXX" /></label>
          <label className="span-2">Google AdSense publisher/client ID <small>(optional — only for AdSense)</small><input name="adsense_client_id" defaultValue={settings.adsense_client_id} placeholder="ca-pub-0000000000000000" /><small>Other networks do not need this. Put their loader script in the head code below and their unit code in <strong>Ad areas</strong>.</small></label>
          <label className="span-2">Custom head code
            <textarea className="code-field" name="head_code" rows={9} defaultValue={settings.head_code} placeholder={"Paste any provider snippet: <meta> verification tags, <script> loaders, <link>, pixels.\nBare JavaScript (no tags) also works."} />
            <small>Server-rendered into <code>&lt;head&gt;</code>, so verification <code>&lt;meta&gt;</code> tags are visible to ad networks and search consoles in the initial HTML. Paste code only from providers you trust.</small>
            <SnippetReport code={settings.head_code} target="head" />
          </label>
          <label className="span-2">Custom body code
            <textarea className="code-field" name="body_code" rows={9} defaultValue={settings.body_code} placeholder={"Paste a provider snippet — <script>, <noscript>, <iframe>, and image pixels are supported.\nBare JavaScript (no tags) also works."} />
            <small>Server-rendered at the end of <code>&lt;body&gt;</code>. Only administrators can change this field.</small>
            <SnippetReport code={settings.body_code} target="body" />
          </label>
          <label className="span-2">ads.txt lines
            <textarea className="code-field" name="ads_txt" rows={6} defaultValue={settings.ads_txt} placeholder={"One authorisation line per network, for example:\nezoic.com, 12345, DIRECT, 8f4a0b1c2d3e4f56\nmedia.net, 8CU000000, DIRECT"} />
            <small>Served at <code>/ads.txt</code>. The AdSense line is added automatically when a publisher ID is set above.</small>
          </label>
        </div>
        <div className="form-submit"><button className="button primary"><Save size={17} />Save settings</button></div>
      </form>
    </>
  );
}
