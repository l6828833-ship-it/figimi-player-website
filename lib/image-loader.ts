import type { ImageLoaderProps } from "next/image";

/**
 * Cloudflare image loader.
 *
 * When NEXT_PUBLIC_CLOUDFLARE_IMAGE_RESIZING === "true", EVERY image (local
 * assets, /public files, and remote media on your CDN) is served through
 * Cloudflare's on-the-fly transformation endpoint (/cdn-cgi/image/...), which
 * delivers resized, auto-format (AVIF/WebP) images from the edge.
 *
 * When the flag is off, images are served directly (still cached by Cloudflare
 * if the site/host is proxied) so local development keeps working.
 */
export default function cloudflareImageLoader({ src, width, quality }: ImageLoaderProps) {
  const q = quality || 82;

  if (process.env.NEXT_PUBLIC_CLOUDFLARE_IMAGE_RESIZING === "true") {
    const options = `format=auto,fit=scale-down,width=${width},quality=${q}`;
    // Absolute URL (e.g. https://media.figimi.com/...): pass through unchanged.
    if (/^https?:\/\//i.test(src)) return `/cdn-cgi/image/${options}/${src}`;
    // Local/relative path (e.g. /logo.png): resolve against the zone root.
    return `/cdn-cgi/image/${options}/${src.replace(/^\//, "")}`;
  }

  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}width=${width}&quality=${q}`;
}
