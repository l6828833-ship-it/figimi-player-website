import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { CodeSnippet } from "@/components/code-snippet";
import { normalizeAdsenseClient } from "@/lib/ads";
import { getSiteSettings } from "@/lib/data";
import { siteConfig } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: "Figimi IPTV Player — Every stream, beautifully simple", template: `%s | ${siteConfig.name}` },
  description: "A clean, fast IPTV player for your playlists across every screen.",
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: siteConfig.name, title: siteConfig.name, description: siteConfig.description, url: "/" },
  twitter: { card: "summary_large_image", title: siteConfig.name, description: siteConfig.description },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, colorScheme: "light", themeColor: "#6957d9" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSiteSettings();
  // Normalized to the required ca-pub-XXXX form so the verification meta tag and
  // loader script stay valid whether the stored value is "1277…", "pub-1277…",
  // or "ca-pub-1277…". AdSense is optional: any other network is configured
  // through Settings -> head code plus Admin -> Ads.
  const adsense = normalizeAdsenseClient(settings.adsense_client_id || process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID);
  const tag = settings.analytics_id || settings.google_tag_id || process.env.NEXT_PUBLIC_GOOGLE_TAG_ID || process.env.NEXT_PUBLIC_GA_ID;
  const isGtm = tag?.startsWith("GTM-");
  const siteSchema = JSON.stringify({ "@context": "https://schema.org", "@graph": [{ "@type": "Organization", name: siteConfig.name, url: siteConfig.url, description: siteConfig.description }, { "@type": "WebSite", name: siteConfig.name, url: siteConfig.url, description: siteConfig.description }] }).replace(/</g, "\\u003c");
  return (
    <html lang="en">
      <head>
        {/* Rendered first so verification meta tags from any ad network, search
            console, or analytics provider are present in the initial HTML. */}
        {settings.head_code && <CodeSnippet code={settings.head_code} target="head" />}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: siteSchema }} />
        {adsense && <><meta name="google-adsense-account" content={adsense} /><script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsense}`} crossOrigin="anonymous" /></>}
        {tag && !isGtm && <><Script strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${tag}`} /><Script id="google-analytics" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${tag}');`}</Script></>}
        {isGtm && <Script id="google-tag-manager" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f)})(window,document,'script','dataLayer','${tag}');`}</Script>}
      </head>
      <body>
        {isGtm && <noscript><iframe src={`https://www.googletagmanager.com/ns.html?id=${tag}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} /></noscript>}
        <main>{children}</main>
        {settings.body_code && <CodeSnippet code={settings.body_code} target="body" />}
      </body>
    </html>
  );
}
