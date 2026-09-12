import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  images: {
    loader: "custom",
    loaderFile: "./lib/image-loader.ts",
    remotePatterns: [
      // Explicit hosts (guaranteed to match) + a broad wildcard fallback.
      // Images use a custom loader, so no server-side optimization of arbitrary URLs happens.
      { protocol: "https", hostname: "media.figimi.com" },
      { protocol: "https", hostname: "**.figimi.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "imagedelivery.net" },
      { protocol: "https", hostname: "**" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/api/convert/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
      {
        source: "/api/compress/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
