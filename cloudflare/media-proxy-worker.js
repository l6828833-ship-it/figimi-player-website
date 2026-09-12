/**
 * Cloudflare Worker: media.figimi.com  ->  Supabase Storage (public "media" bucket)
 *
 * Why this exists:
 *   A plain CNAME from media.figimi.com to <project>.supabase.co does NOT work,
 *   because Supabase routes requests by hostname/SNI. This Worker receives the
 *   request on your custom domain and forwards it to the Supabase origin with the
 *   correct Host, then caches the response at Cloudflare's edge.
 *
 * It only proxies the public storage path, so nothing else is exposed.
 *
 * Set SUPABASE_ORIGIN as a Worker variable (Settings -> Variables), e.g.
 *   https://abcdefghijklmnop.supabase.co   (no trailing slash)
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Only allow safe, read-only methods.
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Only proxy the public storage path (defense in depth).
    if (!url.pathname.startsWith("/storage/v1/object/public/")) {
      return new Response("Not found", { status: 404 });
    }

    const origin = (env.SUPABASE_ORIGIN || "").replace(/\/$/, "");
    if (!origin) {
      return new Response("SUPABASE_ORIGIN is not configured on this Worker.", { status: 500 });
    }

    const target = origin + url.pathname + url.search;

    // Forward only the headers we need.
    const headers = new Headers();
    const accept = request.headers.get("Accept");
    if (accept) headers.set("Accept", accept);
    const range = request.headers.get("Range");
    if (range) headers.set("Range", range);

    const upstream = await fetch(target, {
      method: request.method,
      headers,
      // Let Cloudflare cache the object at the edge for a long time.
      cf: { cacheEverything: true, cacheTtl: 31536000 },
    });

    const response = new Response(upstream.body, upstream);
    if (upstream.ok) {
      response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    }
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("X-Proxied-By", "figimi-media-proxy");
    return response;
  },
};
