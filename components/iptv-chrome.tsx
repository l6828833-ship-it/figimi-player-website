"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Menu, Radio, X } from "lucide-react";

/**
 * The site header and footer, shared by the marketing home page and the playlist
 * dashboard.
 *
 * The section links are absolute (`/#features`) rather than bare fragments so they
 * still reach the home page when the chrome is rendered on another route — a bare
 * `#features` on /playlist would just scroll nowhere.
 */
export function IptvHeader({ onHome = false }: { onHome?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const prefix = onHome ? "" : "/";
  const sections = [
    { href: `${prefix}#features`, label: "Features" },
    { href: `${prefix}#devices`, label: "Devices" },
    { href: `${prefix}#how-it-works`, label: "How it works" },
    { href: `${prefix}#faq`, label: "FAQ" },
  ];

  return (
    <header className="iptv-header">
      <div className="iptv-shell iptv-header-inner">
        <Link className="iptv-brand" href="/" aria-label="Figimi IPTV Player home">
          <span className="iptv-brand-mark"><Radio size={18} /></span>
          <span>Figimi <b>IPTV</b></span>
        </Link>
        <nav className="iptv-nav" aria-label="Main navigation">
          {sections.map((section) => <a key={section.label} href={section.href}>{section.label}</a>)}
        </nav>
        <div className="iptv-header-actions">
          <Link className="iptv-button iptv-button-small" href="/playlist">My playlists <ChevronRight size={15} /></Link>
        </div>
        <button className="iptv-mobile-toggle" type="button" aria-label={mobileOpen ? "Close menu" : "Open menu"} onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X /> : <Menu />}
        </button>
      </div>
      {mobileOpen && (
        <nav className="iptv-mobile-nav" aria-label="Mobile navigation">
          {sections.map((section) => <a key={section.label} href={section.href} onClick={() => setMobileOpen(false)}>{section.label}</a>)}
          <Link href="/playlist" onClick={() => setMobileOpen(false)}>My playlists</Link>
        </nav>
      )}
    </header>
  );
}

export function IptvFooter({ onHome = false }: { onHome?: boolean }) {
  const prefix = onHome ? "" : "/";
  return (
    <footer className="iptv-footer">
      <div className="iptv-shell">
        <div className="iptv-footer-grid">
          <div>
            <Link className="iptv-brand" href="/"><span className="iptv-brand-mark"><Radio size={18} /></span><span>Figimi <b>IPTV</b></span></Link>
            <p>A calmer way to watch the channels you already love.</p>
          </div>
          <nav><b>Product</b><a href={`${prefix}#features`}>Features</a><a href={`${prefix}#devices`}>Devices</a><Link href="/playlist">My playlists</Link></nav>
          <nav><b>Learn</b><a href={`${prefix}#how-it-works`}>How it works</a><a href={`${prefix}#faq`}>FAQ</a></nav>
          <nav><b>Figimi</b><a href="mailto:hello@figimi.com">Contact</a><Link href="/privacy-policy">Privacy</Link><Link href="/terms-of-service">Terms</Link></nav>
        </div>
        <div className="iptv-footer-bottom">
          <span>© {new Date().getFullYear()} Figimi. Built for better watching.</span>
          <span>Figimi does not provide or host channel content.</span>
        </div>
      </div>
    </footer>
  );
}
