"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText, Palette, Scale, Search, Type } from "lucide-react";
import { toolCategories, tools } from "@/lib/tools";

const icons = { "Text tools": Type, "File converters": FileText, "Design tools": Palette, "Unit converters": Scale };
const categoryAnchor = (category: string) => category.toLowerCase().replace(/\s+/g, "-");

export function ToolBrowser() {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => tools.filter((tool) => `${tool.name} ${tool.shortDescription} ${tool.keywords.join(" ")}`.toLowerCase().includes(query.toLowerCase().trim())), [query]);
  return <section className="tools-section" id="tools"><div className="section-heading"><div><span className="eyebrow">Free online tools</span><h2>Everything you need, one click away</h2><p>Fast, focused utilities for writing, converting files, and choosing colors.</p></div><label className="tool-search"><Search size={18} /><span className="sr-only">Search tools</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tools…" /></label></div>
    {toolCategories.map((category) => { const categoryTools = visible.filter((tool) => tool.category === category); if (!categoryTools.length) return null; const Icon = icons[category]; return <div className="tool-category" key={category} id={categoryAnchor(category)}><h3><Icon size={19} />{category}</h3><div className="tool-grid">{categoryTools.map((tool) => <Link className="tool-card" key={tool.slug} href={`/tools/${tool.slug}`}><span className="card-icon"><Icon /></span><span><strong>{tool.name}</strong><small>{tool.shortDescription}</small></span><ArrowRight className="card-arrow" size={18} /></Link>)}</div></div>; })}
    {visible.length === 0 && <div className="empty-state"><h3>No tools found</h3><p>Try another search term.</p></div>}
  </section>;
}
