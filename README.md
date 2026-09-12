# Figimi Tools

A production-oriented Next.js application for free text utilities, document/image conversion, an SEO blog, and a Supabase-backed admin CMS.

## Included

- Five browser/text tools, ten server-side file converters, and an interactive color wheel
- Static/ISR tool, blog, legal, sitemap, RSS, robots, and ads.txt routes
- Supabase Postgres, Auth, Row Level Security, and Storage media library
- Protected admin CRUD for blog scheduling, tool/site content, metadata, media, AdSense, Analytics, Google Tag Manager, and trusted custom JavaScript
- Responsive reserved ad regions, structured data, canonical metadata, and Cloudflare image loader
- Docker runtime with LibreOffice and Poppler for conversion workers

## Local setup

1. Use Node.js 20 or later (Node 22 is recommended).
2. Copy `.env.example` to `.env.local` and fill in the values.
3. Install dependencies with `npm install`.
4. Apply `supabase/migrations` and `supabase/seed.sql` to a Supabase project.
5. Run `npm run dev` and visit `http://localhost:3000`.

Without Supabase variables, public pages use built-in seed content. Admin routes require a configured Supabase project and service-role key. File converters also require LibreOffice and Poppler; using the included Dockerfile installs both.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Supabase, admin user, Node hosting, Cloudflare CDN, caching, image resizing, AdSense, and security steps.

## Validation

```bash
npm run lint
npm run typecheck
npm run build
```

Uploaded conversion files are processed in unique temporary directories and deleted in a `finally` block immediately after the response bytes are prepared. The public policy states the conservative maximum retention window of one hour.

## Android TV playlist management

`/playlist` is a device dashboard, not a browser IPTV player. Users sign in with the MAC address and 6-digit key shown on the Figimi Android TV activation screen, then add a playlist as an M3U link or an Xtream login. Both are stored encrypted and exposed to the TV as a single tokenized M3U URL.

Apply these migrations in order before using the page:

1. `supabase/migrations/202609120001_iptv_schema.sql`
2. `supabase/migrations/202609120002_device_playlists.sql`
3. `supabase/migrations/202609120003_device_login.sql`
4. `supabase/migrations/202609120004_numeric_device_key.sql`

The API for this lives in the same Next.js app under `/api/device`, so the site and its API deploy as a single project with no separate backend service.

The 6-digit key is derived, not registered: the app and the server both compute `HMAC-SHA256(FIGIMI_DEVICE_KEY_SECRET, "figimi-device-key-v1:" + MAC)` and fold the first four bytes to six digits. The server value must match `DeviceKey.SHARED_SECRET` in the Android app, and rotating it invalidates every device key at once.

Six digits is only a million combinations, so the server locks a device for 15 minutes after 8 wrong keys. That lockout is the real defence, not the key length. The shared secret also ships inside the APK, so the key blocks casual use of a MAC someone glimpsed rather than a reverse engineer; issuing per-device secrets from the server is the stronger follow-up.

The current Android TV binary still loads its configured external Stalker portal, so it does not consume these playlists automatically yet. The dashboard shows the M3U URL for that integration.
