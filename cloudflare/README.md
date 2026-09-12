# Serve Supabase media under `media.figimi.com` (Cloudflare Worker)

This makes uploaded media load from your own domain
(`https://media.figimi.com/storage/v1/object/public/media/...`) while the files
actually live in Supabase Storage. A plain CNAME to Supabase will not work, so a
tiny Worker forwards the request to Supabase and caches it at Cloudflare's edge.

## What you need
- Your Supabase project URL, e.g. `https://abcdefghijklmnop.supabase.co`
  (Supabase -> Project Settings -> API -> Project URL).
- `figimi.com` already active in Cloudflare.

## Setup (Cloudflare dashboard — easiest)
1. Cloudflare -> **Workers & Pages** -> **Create** -> **Create Worker**. Name it
   `figimi-media-proxy` and deploy the default code.
2. Open the Worker -> **Edit code** -> paste the contents of
   `media-proxy-worker.js` from this folder -> **Deploy**.
3. Worker -> **Settings -> Variables** -> add a variable:
   - Name: `SUPABASE_ORIGIN`
   - Value: your Supabase Project URL, no trailing slash
     (e.g. `https://abcdefghijklmnop.supabase.co`)
   - Deploy.
4. Worker -> **Settings -> Domains & Routes** -> **Add** -> **Custom domain** ->
   enter `media.figimi.com`. Cloudflare creates the DNS record and route
   automatically and issues the certificate.

## Setup (CLI alternative)
```
npm i -g wrangler
wrangler login
# edit cloudflare/wrangler.toml -> set SUPABASE_ORIGIN
wrangler deploy
```
Then add `media.figimi.com` as a Custom Domain in the dashboard (step 4 above).

## App configuration (Railway)
Keep this variable set:
```
NEXT_PUBLIC_MEDIA_CDN_URL=https://media.figimi.com/storage/v1/object/public/media
```
`media.figimi.com` is already allowed in `next.config.ts` image settings.

## Verify
Open a real uploaded object directly in a browser:
```
https://media.figimi.com/storage/v1/object/public/media/<yyyy-mm-dd>/<file>
```
- Loads the image -> success. New uploads in the admin will display correctly.
- 404 / SSL error -> re-check `SUPABASE_ORIGIN` and that the Custom Domain was
  added to the Worker.

## Notes
- The Worker only proxies `/storage/v1/object/public/...`; nothing else is exposed.
- Responses are cached at the edge for a year (media filenames are unique per upload).
- Media uploaded before this was working keeps its stored URL; if any show broken,
  delete and re-upload them.
