export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || "Figimi",
  shortName: "Figimi",
  description: "A clean, fast IPTV player for your playlists across every screen.",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://figimi.com").replace(/\/$/, ""),
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@example.com",
  social: { x: process.env.NEXT_PUBLIC_X_URL || "" },
};

export const absoluteUrl = (path = "/") => `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
