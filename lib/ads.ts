import type { AdPlacement } from "@/types";

/**
 * Every ad area on the site. Each one accepts raw code from ANY ad network
 * (AdSense, Ezoic, Media.net, Adsterra, PropellerAds, Monumetric, a direct
 * sponsor image, an affiliate banner…) so the site is not tied to one provider.
 */
export const adPlacements: AdPlacement[] = [
  { key: "home-header", label: "Home page — under the hero", hint: "Wide leaderboard above the tool browser. Best sizes: 728x90, 970x250, or responsive." },
  { key: "tool-header", label: "Tool pages — above the workspace", hint: "Shown on every /tools/* page under the title. Best sizes: 728x90 or responsive." },
  { key: "tool-sidebar", label: "Tool pages — sidebar", hint: "Right column beside the article. Best sizes: 300x250, 300x600. Hidden below 900px width." },
  { key: "blog-header", label: "Blog index — top", hint: "Above the article grid on /blog." },
  { key: "post-content-top", label: "Article — above the content", hint: "Between the featured image and the article body." },
  { key: "post-content-bottom", label: "Article — below the content", hint: "After the article body, before related posts." },
  { key: "footer", label: "Footer — site-wide", hint: "Appears at the bottom of every page." },
];

export const adPlacementKeys = adPlacements.map((placement) => placement.key);

/**
 * Normalises an AdSense publisher ID to the required `ca-pub-XXXX` form,
 * accepting "1277…", "pub-1277…", or "ca-pub-1277…".
 */
export function normalizeAdsenseClient(value?: string | null) {
  const digits = (value || "").replace(/\D/g, "");
  return digits ? `ca-pub-${digits}` : "";
}
