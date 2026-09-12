"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";

type NavGroup = { category: string; items: { slug: string; name: string }[] };

export function HeaderNav({ groups }: { groups: NavGroup[] }) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointer(event: MouseEvent) { if (navRef.current && !navRef.current.contains(event.target as Node)) { setOpenMenu(null); setMobileOpen(false); } }
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") { setOpenMenu(null); setMobileOpen(false); } }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onPointer); document.removeEventListener("keydown", onKey); };
  }, []);

  function closeAll() { setOpenMenu(null); setMobileOpen(false); }

  return (
    <div className="header-nav" ref={navRef}>
      <nav aria-label="Main navigation" className="desktop-nav">
        {groups.map(({ category, items }) => {
          const isOpen = openMenu === category;
          return (
            <div key={category} className={`nav-dropdown ${isOpen ? "open" : ""}`} onMouseEnter={() => setOpenMenu((prev) => (prev !== null ? category : prev))}>
              <button type="button" className="nav-trigger" aria-expanded={isOpen} aria-haspopup="true" onClick={() => setOpenMenu(isOpen ? null : category)}>{category} <ChevronDown size={15} /></button>
              <div className="dropdown-panel" role="menu">{items.map((tool) => <Link key={tool.slug} role="menuitem" href={`/tools/${tool.slug}`} onClick={closeAll}>{tool.name}</Link>)}</div>
            </div>
          );
        })}
        <Link href="/blog">Blog</Link><Link href="/about">About</Link><Link href="/contact">Contact</Link>
      </nav>

      <button type="button" className="mobile-toggle" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} onClick={() => setMobileOpen((value) => !value)}>{mobileOpen ? <X /> : <Menu />}</button>
      {mobileOpen && (
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {groups.map(({ category, items }) => (
            <div className="mobile-group" key={category}><strong>{category}</strong>{items.map((tool) => <Link key={tool.slug} href={`/tools/${tool.slug}`} onClick={closeAll}>{tool.name}</Link>)}</div>
          ))}
          <div className="mobile-group"><Link href="/blog" onClick={closeAll}>Blog</Link><Link href="/about" onClick={closeAll}>About</Link><Link href="/contact" onClick={closeAll}>Contact</Link></div>
        </nav>
      )}
    </div>
  );
}
