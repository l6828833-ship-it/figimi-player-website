# Deployment guide

## 1. Provision Supabase

1. Create a Supabase project and record its Project URL, anon key, and service-role key from **Project Settings → API**.
2. Apply `supabase/migrations/202607220001_initial_schema.sql`, then `202607220002_auth_profile_trigger.sql`, using the Supabase CLI or SQL editor.
3. Apply `supabase/seed.sql`. It creates content for every tool, the required legal/about pages, one original sample article, and settings defaults.
4. Confirm that the public `media` Storage bucket exists. The migration creates it with a 5 MB image limit and JPG, PNG, WebP, and GIF MIME restrictions.
5. In **Authentication → Providers**, enable email/password. Disable public sign-ups unless they are needed for another product.

### Create the first administrator

Create a user in **Authentication → Users → Add user**. Supabase hashes the password; the application never stores raw passwords. The profile trigger creates an editor profile. Promote only a trusted account in the SQL editor:

```sql
update public.profiles
set role = 'admin', username = 'your-admin-username'
where id = (select id from auth.users where email = 'admin@example.com');
```

Use a long unique password and enable Supabase MFA if available for the project. The login action allows five failed attempts per identifier per 15 minutes on each application instance. Add the Cloudflare rate-limit rule below for distributed enforcement.

## 2. Configure environment variables

Copy `.env.example` into the host's secret manager. Required production values are:

- `NEXT_PUBLIC_SITE_URL`: canonical HTTPS origin, without a trailing slash.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only; never expose it in browser code or Cloudflare public variables.
- `NEXT_PUBLIC_CONTACT_EMAIL`.

Analytics, Google Tag, and AdSense IDs can be set in `/admin/settings` after launch. Environment values provide a fallback. Trusted custom head/body fields accept JavaScript without `<script>` wrappers and should be restricted to audited provider snippets.

## 3. Deploy the Node conversion host

The conversion endpoints need a persistent Node runtime with LibreOffice and Poppler binaries. A container host such as Render, Fly.io, Railway, Cloud Run, ECS, or a VPS is a better fit than a restricted serverless function runtime.

Build and run the supplied image:

```bash
docker build -t figimi-tools .
docker run --rm -p 3000:3000 --env-file .env figimi-tools
```

The image installs LibreOffice Writer/Calc/Impress, `pdftotext`, `pdftoppm`, FFmpeg/ffprobe, `heif-info`/`heif-convert`, and Liberation fonts. Allocate at least 2 GB RAM when video compression is enabled. Set the platform request timeout above 310 seconds and its request-body limit above 100 MB. The app separately enforces 20 MB for document conversions, 20 MB and 25 megapixels for browser-side images, 20 MB and 40 megapixels for HEIC conversion, and 100 MB, 10 minutes, 4K, and 120 fps for video uploads.

For higher conversion volume, move `convertFiles` calls to isolated queue workers (for example BullMQ/Redis) and return job status from the API. The current implementation already isolates each request in a random OS temp directory, invokes binaries without a shell, enforces process timeouts, validates extensions and magic bytes, and deletes the directory in `finally`.

FFmpeg and ffprobe parse untrusted native media. The application runs them as the unprivileged `nextjs` user with a local-file-only protocol allowlist, two encoding threads, strict media limits, and a one-job process-local semaphore. For stronger isolation, move video processing to a dedicated worker container with no outbound network, read-only root storage, a writable temporary volume, a PID limit, and hard CPU/memory limits. Multi-instance deployments also need a shared queue or distributed semaphore.

Run these release checks on the deployment image:

```bash
npm run lint
npm run typecheck
npm run build
```

## 4. Put Cloudflare in front

### DNS and TLS

1. Add the domain to Cloudflare and point the host's `A`, `AAAA`, or `CNAME` record to the Node host.
2. Enable the orange-cloud proxy.
3. Set **SSL/TLS mode** to **Full (strict)** and install a valid origin certificate.
4. Enable **Always Use HTTPS**, **Automatic HTTPS Rewrites**, **Brotli**, **HTTP/2**, **HTTP/3 (QUIC)**, and **0-RTT** only if the host and risk policy allow it.

### Cache rules

Create rules in this order so the bypass rule wins:

1. **Bypass private and processing traffic**  
   Expression: `starts_with(http.request.uri.path, "/api/") or starts_with(http.request.uri.path, "/admin")`  
   Action: Bypass cache. Do not use Cache Everything. Conversion responses also send `private, no-store`.
2. **Immutable Next assets**  
   Expression: `starts_with(http.request.uri.path, "/_next/static/")`  
   Action: Cache eligible content, Edge TTL 1 year, Browser TTL respect origin. Filenames are content-hashed.
3. **Public images and media**  
   Match the chosen media hostname or public image path. Cache eligible content for one month or longer; Storage objects use immutable unique paths.
4. **Public HTML** (optional)  
   Match GET/HEAD requests excluding `/api/` and `/admin`. Respect origin headers or use an Edge TTL no longer than five minutes so ISR updates remain timely. Do not cache responses containing Supabase authentication cookies.

Purge the relevant URL after emergency editorial changes. Normal admin saves call Next.js path/tag revalidation; a long Cloudflare HTML TTL can still keep the old edge copy until expiry.

### Image resizing

Enable **Image Resizing → Transformations** for the zone and set `NEXT_PUBLIC_CLOUDFLARE_IMAGE_RESIZING=true`. The custom Next image loader then requests remote editorial images through `/cdn-cgi/image/format=auto,fit=scale-down,...`, allowing Cloudflare to select AVIF/WebP and responsive widths. Keep it `false` locally.

For Supabase media behind a dedicated hostname, proxy that hostname through Cloudflare, route it to the Supabase public Storage origin, and set `NEXT_PUBLIC_MEDIA_CDN_URL` to the public bucket prefix. Ensure the path mapping is tested before editors publish URLs.

### WAF and rate limiting

- Enable managed Cloudflare rules and bot protection appropriate for the plan.
- Rate-limit `/admin/login` to approximately 10 requests per minute per IP, with a managed challenge or temporary block.
- Rate-limit `POST /api/convert/*` to a sustainable value (for example 10 requests per 10 minutes per IP), and cap concurrent work at the hosting layer.
- Rate-limit `POST /api/compress/video` more strictly based on available CPU (for example 3 requests per 10 minutes per IP). Its one-job semaphore is process-local, so multi-instance deployments need a shared queue or edge-enforced concurrency limit.
- Rate-limit `POST /api/website-word-count` to prevent proxy abuse.
- Do not create a cache rule that ignores query/cookie variation on admin or API paths.

## 5. Analytics, AdSense, and editorial launch

1. Sign in at `/admin/login` and set Analytics, Google Tag Manager/Google tag, and AdSense IDs under **Settings & codes**.
2. Replace placeholder contact/domain values, review Privacy Policy and Terms for the actual legal entity and jurisdiction, and have qualified counsel review them where necessary.
3. Verify `/ads.txt`, `/robots.txt`, `/sitemap.xml`, and `/rss.xml` on the public domain.
4. Add a valid AdSense site and wait for review before inserting production slot IDs. Reserved ad containers have fixed minimum heights to reduce CLS and are labeled as advertisements.
5. Publish additional original articles and review each tool explanation. AdSense approval is discretionary; technical compliance does not guarantee approval.
6. Test keyboard navigation, 320 px mobile layouts, conversion errors, scheduled publishing, media alt text, and Core Web Vitals in production.

## Operations and retention

Conversion data is kept only in OS temporary storage and deleted immediately after response preparation, which is stricter than the stated one-hour maximum. If a queue or object store is added later, configure a lifecycle rule that hard-deletes source and output objects within one hour and monitor deletion failures. Do not log document contents. Rotate Supabase service keys after suspected disclosure and keep the service role only on the server.

## 3A. Device playlists (single project, no separate backend)

The playlist API runs inside this Next.js app, so the site and its API deploy together as one project. There is no second service and no API URL to configure.

Routes:

| Route | Purpose |
| --- | --- |
| `POST /api/device/login` | MAC + 6-digit key, returns a bearer token valid 12 hours |
| `POST /api/device/logout` | Ends the session |
| `GET /api/device/playlists` | Lists the signed-in device's playlists |
| `POST /api/device/playlists` | Adds an M3U link or Xtream login |
| `PATCH /api/device/playlists/:id` | Enables or disables one |
| `DELETE /api/device/playlists/:id` | Removes one |
| `GET /api/devices/:mac/playlists/:id/playlist.m3u?key=…` | What the TV fetches |

Required server-only variables, wherever you host it:

- `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: database access for the routes.
- `IPTV_CREDENTIALS_KEY`: 32 bytes, as 64 hex characters or base64. Encrypts playlist links and Xtream logins at rest.
- `FIGIMI_DEVICE_KEY_SECRET`: must equal `DeviceKey.SHARED_SECRET` in the Android TV app, or no 6-digit key validates.

Never prefix the last three with `NEXT_PUBLIC_`; that would ship them to the browser.

Apply all four IPTV migrations in Supabase before using `/playlist`. The device routes opt out of caching (`force-dynamic`, `no-store`) and require the Node.js runtime, so a Node host or Vercel's Node runtime is needed — not a purely static export.

Playlist sources are validated on save: private or local addresses, embedded credentials, redirects, and non-standard ports are rejected, and fetched playlists are capped at 10 MB. Each playlist is served from a tokenized URL, so the TV endpoint cannot be enumerated from a MAC alone.

Because the key is only six digits, a device locks for 15 minutes after 8 failed sign-ins. That counter lives in the database, so it holds across instances. Add an edge rate limit on `/api/device/login` as well if the site is behind Cloudflare or Cloud Armor.

### Running it on Google Cloud

The whole app can go to Cloud Run using the repository's root `Dockerfile`:

```bash
gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT/figimi/figimi-site
gcloud run deploy figimi-site \
  --image REGION-docker.pkg.dev/PROJECT/figimi/figimi-site \
  --region REGION --allow-unauthenticated \
  --set-env-vars NEXT_PUBLIC_SITE_URL=https://YOUR_DOMAIN,NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co,NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY \
  --set-secrets SUPABASE_SERVICE_ROLE_KEY=figimi-supabase-service-role:latest,IPTV_CREDENTIALS_KEY=figimi-iptv-credentials:latest,FIGIMI_DEVICE_KEY_SECRET=figimi-device-key:latest
```

Keep every secret in Secret Manager. The same variables work unchanged on Vercel if you deploy there instead.
