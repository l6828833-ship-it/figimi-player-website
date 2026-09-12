"use client";

import { useEffect } from "react";

declare global { interface Window { adsbygoogle?: Record<string, unknown>[] } }

/**
 * Google AdSense fallback used when a placement has no custom network code but
 * a publisher ID and numeric slot ID are configured. Everything else goes
 * through the generic code snippet path in AdSlot.
 */
export function AdsenseUnit({ client, slot, format = "auto" }: { client: string; slot: string; format?: string }) {
  useEffect(() => {
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* Ad blockers can reject initialization. */ }
  }, [client, slot]);

  return <ins className="adsbygoogle" style={{ display: "block" }} data-ad-client={client} data-ad-slot={slot} data-ad-format={format} data-full-width-responsive="true" />;
}
