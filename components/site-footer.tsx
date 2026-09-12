import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { AdSlot } from "./ad-slot";
import { CookiePreferences } from "./cookie-preferences";
import { FooterSocial } from "./footer-social";

export function SiteFooter({ showCookiePreferences = false }: { showCookiePreferences?: boolean }) {
  return (
    <footer className="site-footer">
      <div className="shell"><AdSlot placement="footer" className="footer-ad" />
        <div className="footer-grid"><div><strong>{siteConfig.name}</strong><p>Figimi is a collection of free file, text, document and image tools. Our drawing and color palette creator is fast and free. Uploads are deleted in an hour. Count your words, convert files or extract text from images.</p><FooterSocial /></div>
          <nav aria-label="Footer tools"><strong>Tools</strong><Link href="/tools/word-counter">Word Counter</Link><Link href="/tools/pdf-to-word">PDF to Word</Link><Link href="/tools/color-wheel">Color Wheel</Link></nav>
          <nav aria-label="Footer company"><strong>Company</strong><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/blog">Blog</Link></nav>
          <nav aria-label="Footer legal"><strong>Legal</strong><Link href="/privacy-policy">Privacy Policy</Link><Link href="/terms-of-service">Terms of Service</Link><Link href="/security-and-compliance">Security &amp; Compliance</Link>{showCookiePreferences && <CookiePreferences />}</nav>
        </div><div className="footer-bottom"><span>© {new Date().getFullYear()} {siteConfig.name}</span><span>Your files are cleaned from the system in one hour.</span></div>
      </div>
    </footer>
  );
}
