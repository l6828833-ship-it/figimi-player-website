"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Film, LoaderCircle, Play, Radio, RefreshCw, Search, Tv, X } from "lucide-react";

type Kind = "live" | "movie" | "series";
type Title = { id: string; kind: Kind; title: string; posterUrl: string | null; groupName: string | null; metadata?: Record<string, unknown> };
type Category = { id: string; name: string; kind: Kind; title_count: number };
type CatalogResponse = { titles: Title[]; categories: Category[]; total: number; page: number; pageSize: number };

const apiBase = (process.env.NEXT_PUBLIC_IPTV_API_URL || "").replace(/\/$/, "");

function cover(title: Title) {
  return title.posterUrl || `https://placehold.co/480x720/241d35/f0eaff?text=${encodeURIComponent(title.title.slice(0, 18))}`;
}

export function IptvPlayer() {
  const [kind, setKind] = useState<Kind>("live");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [catalog, setCatalog] = useState<CatalogResponse>({ titles: [], categories: [], total: 0, page: 1, pageSize: 40 });
  const [selected, setSelected] = useState<Title | null>(null);
  const [episodes, setEpisodes] = useState<Array<Record<string, unknown>>>([]);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!apiBase) {
      setError("The IPTV API is not configured yet. Set NEXT_PUBLIC_IPTV_API_URL in Vercel.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ kind, pageSize: "40" });
      if (query.trim()) params.set("q", query.trim());
      if (categoryId) params.set("categoryId", categoryId);
      const response = await fetch(`${apiBase}/api/v1/catalog?${params}`, { cache: "no-store" });
      const payload = await response.json() as CatalogResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not load the catalog.");
      setCatalog(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the catalog.");
    } finally {
      setLoading(false);
    }
  }, [categoryId, kind, query]);

  useEffect(() => {
    const timer = window.setTimeout(load, query ? 220 : 0);
    return () => window.clearTimeout(timer);
  }, [load, query]);

  const categories = useMemo(() => catalog.categories.filter((category) => category.kind === kind), [catalog.categories, kind]);

  async function openTitle(title: Title) {
    setSelected(title);
    setPlaybackUrl(null);
    setEpisodes([]);
    setError(null);
    if (!apiBase) return;
    if (title.kind === "series") {
      try {
        const response = await fetch(`${apiBase}/api/v1/catalog/${title.id}/episodes`, { cache: "no-store" });
        const payload = await response.json() as { episodes?: Array<Record<string, unknown>>; error?: string };
        if (!response.ok) throw new Error(payload.error || "Could not load episodes.");
        setEpisodes(payload.episodes || []);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not load episodes.");
      }
      return;
    }
    await play(title.id);
  }

  async function play(titleId: string, episodeId?: string) {
    if (!apiBase) return;
    setLoading(true);
    setError(null);
    try {
      const suffix = episodeId ? `?episodeId=${encodeURIComponent(episodeId)}` : "";
      const response = await fetch(`${apiBase}/api/v1/playback/${titleId}${suffix}`, { cache: "no-store" });
      const payload = await response.json() as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || "Could not create playback link.");
      setPlaybackUrl(payload.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create playback link.");
    } finally {
      setLoading(false);
    }
  }

  const titleLabel = kind === "live" ? "Live TV" : kind === "movie" ? "Movies" : "Series";

  return <main className="web-player">
    <aside className="web-player-sidebar">
      <Link className="web-player-brand" href="/">Figimi <span>IPTV</span></Link>
      <nav>
        <button className={kind === "live" ? "active" : ""} onClick={() => { setKind("live"); setCategoryId(""); setSelected(null); }}><Tv size={17} />Live TV</button>
        <button className={kind === "movie" ? "active" : ""} onClick={() => { setKind("movie"); setCategoryId(""); setSelected(null); }}><Film size={17} />Movies</button>
        <button className={kind === "series" ? "active" : ""} onClick={() => { setKind("series"); setCategoryId(""); setSelected(null); }}><Radio size={17} />Series</button>
      </nav>
      <Link className="web-player-admin" href="/admin/iptv">Admin panel</Link>
    </aside>

    <section className="web-player-content">
      <header className="web-player-header">
        <div><span className="web-player-eyebrow">Your library</span><h1>{titleLabel}</h1><p>{catalog.total.toLocaleString()} titles available</p></div>
        <div className="web-player-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${titleLabel.toLowerCase()}`} /></div>
      </header>
      {categories.length > 0 && <div className="web-player-categories"><button className={!categoryId ? "active" : ""} onClick={() => setCategoryId("")}>All</button>{categories.map((category) => <button key={category.id} className={categoryId === category.id ? "active" : ""} onClick={() => setCategoryId(category.id)}>{category.name}<small>{category.title_count}</small></button>)}</div>}
      {error && <div className="web-player-notice"><span>{error}</span><button onClick={load}><RefreshCw size={15} />Retry</button></div>}
      {loading && !catalog.titles.length ? <div className="web-player-loading"><LoaderCircle className="spin" size={25} />Loading your library…</div> : catalog.titles.length === 0 ? <div className="web-player-empty"><Tv size={30} /><h2>No titles yet</h2><p>Connect a provider in the admin panel, then sync its catalog.</p></div> : <div className="web-player-grid">{catalog.titles.map((title) => <button className="web-player-card" key={title.id} onClick={() => openTitle(title)}><span className="web-player-poster"><img src={cover(title)} alt="" loading="lazy" /><span className="web-player-play"><Play size={15} fill="currentColor" /></span></span><strong>{title.title}</strong><small>{title.groupName || titleLabel}</small></button>)}</div>}
    </section>

    {selected && <div className="web-player-modal-backdrop" onClick={() => { setSelected(null); setPlaybackUrl(null); }}><section className="web-player-modal" onClick={(event) => event.stopPropagation()}><button className="web-player-close" onClick={() => { setSelected(null); setPlaybackUrl(null); }} aria-label="Close"><X /></button>{playbackUrl ? <div className="web-player-video"><video src={playbackUrl} controls autoPlay playsInline /><p>Playback URL comes from your provider and is never stored in the public catalog.</p></div> : <div className="web-player-detail"><img src={cover(selected)} alt="" /><div><span className="web-player-eyebrow">{selected.kind}</span><h2>{selected.title}</h2><p>{selected.groupName || "Your provider catalog"}</p>{selected.kind === "series" ? <div className="web-player-episodes">{episodes.length ? episodes.map((episode, index) => { const id = String(episode.id ?? episode.episode_id ?? episode.stream_id ?? ""); const label = String(episode.title ?? episode.episode_num ?? `Episode ${index + 1}`); return <button key={`${id}-${index}`} onClick={() => play(selected.id, id)}><Play size={13} fill="currentColor" />{label}</button>; }) : <p>No episodes were returned for this series.</p>}</div> : <button className="web-player-play-button" onClick={() => play(selected.id)}><Play size={16} fill="currentColor" />Play</button>}</div></div>}</section></div>}
  </main>;
}
