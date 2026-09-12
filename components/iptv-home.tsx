"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Airplay,
  Check,
  ChevronDown,
  ChevronRight,
  CirclePlay,
  Cloud,
  Laptop,
  ListVideo,
  LockKeyhole,
  Menu,
  MonitorPlay,
  Pause,
  Play,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tv,
  X,
  Zap,
} from "lucide-react";

const channels = [
  { name: "Figimi News", category: "News", color: "#7c5cff", live: true },
  { name: "North Coast", category: "Entertainment", color: "#f28f6b", live: false },
  { name: "Arena Sports", category: "Sports", color: "#35b9a5", live: false },
  { name: "Cinema One", category: "Movies", color: "#df6498", live: false },
];

const faqs = [
  ["What is Figimi IPTV Player?", "Figimi is a clean, privacy-first player for watching your own IPTV playlists across the devices you already use. It does not provide or resell channels."],
  ["Which playlists can I use?", "Add an M3U or M3U8 playlist URL from your IPTV provider. Figimi also supports Xtream Codes credentials in the full player experience."],
  ["Do you store my playlist?", "Your playlist stays connected to your account so your library can sync. We never sell viewing data, and you can remove a playlist at any time."],
  ["Can I watch on my TV?", "Yes. Figimi is designed for smart TVs, streaming sticks, phones, tablets, and browsers. Sign in once and pick up where you left off."],
];

export function IptvHome() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [added, setAdded] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const active = useMemo(() => channels[activeChannel], [activeChannel]);

  function handlePlaylist() {
    window.location.href = "/playlist";
  }

  return (
    <>
      <header className="iptv-header">
        <div className="iptv-shell iptv-header-inner">
          <a className="iptv-brand" href="#top" aria-label="Figimi IPTV Player home">
            <span className="iptv-brand-mark"><Radio size={18} /></span>
            <span>Figimi <b>IPTV</b></span>
          </a>
          <nav className="iptv-nav" aria-label="Main navigation">
            <a href="#features">Features</a><a href="#devices">Devices</a><a href="#how-it-works">How it works</a><a href="#faq">FAQ</a>
          </nav>
          <div className="iptv-header-actions"><Link className="iptv-login" href="/playlist">Sign in</Link><Link className="iptv-button iptv-button-small" href="/playlist">Manage TV playlist <ChevronRight size={15} /></Link></div>
          <button className="iptv-mobile-toggle" type="button" aria-label={mobileOpen ? "Close menu" : "Open menu"} onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X /> : <Menu />}</button>
        </div>
        {mobileOpen && <nav className="iptv-mobile-nav" aria-label="Mobile navigation"><a href="#features" onClick={() => setMobileOpen(false)}>Features</a><a href="#devices" onClick={() => setMobileOpen(false)}>Devices</a><a href="#how-it-works" onClick={() => setMobileOpen(false)}>How it works</a><a href="#faq" onClick={() => setMobileOpen(false)}>FAQ</a><Link href="/playlist" onClick={() => setMobileOpen(false)}>Manage TV playlist</Link></nav>}
      </header>

      <main id="top">
        <section className="iptv-hero">
          <div className="iptv-orb iptv-orb-one" /><div className="iptv-orb iptv-orb-two" />
          <div className="iptv-shell iptv-hero-grid">
            <div className="iptv-hero-copy"><span className="iptv-kicker"><Sparkles size={14} /> Your channels. Your way.</span><h1>Every stream,<br /><em>beautifully simple.</em></h1><p>Figimi IPTV Player brings your live TV, movies, and playlists into one calm, fast player that feels right on every screen.</p><div className="iptv-hero-actions"><Link className="iptv-button" href="/playlist"><CirclePlay size={18} /> Manage playlist</Link><a className="iptv-text-link" href="#how-it-works">See how it works <ChevronRight size={16} /></a></div><div className="iptv-proof"><span><Check size={15} /> No subscription required</span><span><LockKeyhole size={15} /> Privacy-first</span></div></div>
            <div className="iptv-hero-player" id="player"><div className="iptv-player-window"><div className="iptv-player-topbar"><div className="iptv-window-dots"><i /><i /><i /></div><span>Figimi IPTV Player</span><span className="iptv-live-pill"><i /> LIVE</span></div><div className="iptv-player-body"><aside className="iptv-channel-list"><div className="iptv-list-heading"><span>Live now</span><button type="button" aria-label="Add playlist" onClick={() => document.getElementById("playlist")?.scrollIntoView({ behavior: "smooth" })}><Plus size={15} /></button></div>{channels.map((channel, index) => <button type="button" className={`iptv-channel-item ${activeChannel === index ? "selected" : ""}`} key={channel.name} onClick={() => { setActiveChannel(index); setPlaying(true); }}><span className="iptv-channel-logo" style={{ background: channel.color }}>{channel.name.slice(0, 1)}</span><span><b>{channel.name}</b><small>{channel.category}</small></span>{activeChannel === index && <span className="iptv-eq"><i /><i /><i /></span>}</button>)}</aside><div className="iptv-video" style={{ "--channel-color": active.color } as React.CSSProperties}><div className="iptv-video-noise" /><div className="iptv-video-meta"><span className="iptv-live-pill"><i /> LIVE</span><span>1080p</span></div><div className="iptv-video-center"><button type="button" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={22} /> : <Play size={22} fill="currentColor" />}</button><strong>{active.name}</strong><small>{active.category} · Now playing</small></div><div className="iptv-video-controls"><span>{playing ? "00:24:18" : "00:24:32"}</span><div className="iptv-progress"><i /></div><span><Airplay size={15} /></span></div></div></div><div className="iptv-player-footer"><span><ListVideo size={15} /> My playlists</span><span><MonitorPlay size={15} /> Living room TV</span><span><Zap size={15} /> Auto quality</span></div></div></div>
          </div>
        </section>

        <section className="iptv-marquee"><div className="iptv-shell iptv-marquee-inner"><span>Built for the way you watch</span><span><Tv size={17} /> Smart TV</span><span><Laptop size={17} /> Web</span><span><Smartphone size={17} /> Mobile</span><span><Cloud size={17} /> One library</span></div></section>

        <section className="iptv-section iptv-features" id="features"><div className="iptv-shell"><div className="iptv-section-heading"><span className="iptv-eyebrow">A better way to watch</span><h2>Your entertainment,<br /><em>without the noise.</em></h2><p>Simple controls, a focused interface, and just enough magic to make your daily watching feel effortless.</p></div><div className="iptv-feature-grid"><article className="iptv-feature-card iptv-feature-card-large"><span className="iptv-feature-icon"><ListVideo /></span><h3>One home for every playlist</h3><p>Keep your M3U and Xtream Codes playlists together, organised by what you actually watch.</p><div className="iptv-mini-playlists"><span><i style={{ background: "#7c5cff" }} /> Evening mix <b>24</b></span><span><i style={{ background: "#35b9a5" }} /> Sports weekend <b>18</b></span><span><i style={{ background: "#f28f6b" }} /> Family favourites <b>42</b></span></div></article><article className="iptv-feature-card"><span className="iptv-feature-icon iptv-green"><Zap /></span><h3>Fast from first click</h3><p>Quick startup, responsive channel switching, and adaptive playback that stays smooth.</p><div className="iptv-speed-meter"><span>Playback health</span><b>Excellent</b><i><em /></i></div></article><article className="iptv-feature-card"><span className="iptv-feature-icon iptv-orange"><ShieldCheck /></span><h3>Private by default</h3><p>No tracking-heavy ads. No selling your viewing habits. Just a player built around your library.</p><div className="iptv-private-note"><LockKeyhole size={16} /> Your viewing stays yours.</div></article></div></div></section>

        <section className="iptv-split-section" id="how-it-works"><div className="iptv-shell iptv-split-grid"><div className="iptv-device-art"><div className="iptv-device-card"><div className="iptv-device-screen"><div className="iptv-device-screen-top"><span>Good evening</span><small>Tuesday, 20:42</small></div><div className="iptv-device-hero"><span>Continue watching</span><b>Hidden coastlines</b><small>Episode 04 · 46 min left</small><button type="button"><Play size={13} fill="currentColor" /> Resume</button></div><div className="iptv-device-row"><span /><span /><span /></div></div></div><span className="iptv-device-glow" /></div><div className="iptv-split-copy"><span className="iptv-eyebrow">From playlist to play</span><h2>Set up in a minute.<br /><em>Stay for the show.</em></h2><p>Connect your provider, give your playlists a home, and let Figimi handle the rest. Your favourites, recent channels, and watch history stay in sync.</p><ol className="iptv-steps"><li><span>01</span><div><b>Connect a playlist</b><small>Paste your M3U or provider details.</small></div></li><li><span>02</span><div><b>Make it yours</b><small>Organise channels into simple groups.</small></div></li><li><span>03</span><div><b>Press play</b><small>Pick up on any screen, right where you left off.</small></div></li></ol></div></div></section>

        <section className="iptv-section iptv-devices" id="devices"><div className="iptv-shell"><div className="iptv-section-heading centered"><span className="iptv-eyebrow">Wherever you watch</span><h2>One player.<br /><em>Every screen.</em></h2><p>Move from your morning phone to your living room TV without starting over.</p></div><div className="iptv-device-grid"><div><Tv /><b>Smart TV</b><span>Big-screen ready</span></div><div><Laptop /><b>Web player</b><span>Open in any browser</span></div><div><Smartphone /><b>Phone &amp; tablet</b><span>Take it with you</span></div><div><Airplay /><b>Cast &amp; stream</b><span>Send it to the room</span></div></div></div></section>

        <section className="iptv-playlist-section" id="playlist"><div className="iptv-shell iptv-playlist-card"><div><span className="iptv-eyebrow">Ready when you are</span><h2>Bring your playlist.<br /><em>We’ll bring the calm.</em></h2><p>Start with a playlist URL and see your channels in a cleaner, more considered player.</p></div><div className="iptv-url-box"><label htmlFor="playlist-url">Playlist URL</label><div><Search size={17} /><input id="playlist-url" value={playlistUrl} onChange={(event) => { setPlaylistUrl(event.target.value); setAdded(false); }} placeholder="https://your-provider.com/playlist.m3u" /><button type="button" className="iptv-button iptv-button-dark" onClick={handlePlaylist}>{added ? <><Check size={16} /> Added</> : "Add playlist"}</button></div><small>{added ? "Open the player to manage your connected provider." : "Provider connections are managed from the player and admin panel."}</small></div></div></section>

        <section className="iptv-section iptv-faq" id="faq"><div className="iptv-shell iptv-faq-grid"><div><span className="iptv-eyebrow">Questions, answered</span><h2>Good to know.</h2><p>Everything you need to get the most from your player.</p></div><div>{faqs.map(([question, answer], index) => <div className={`iptv-faq-item ${openFaq === index ? "open" : ""}`} key={question}><button type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{question}</span><ChevronDown size={18} /></button>{openFaq === index && <p>{answer}</p>}</div>)}</div></div></section>
      </main>

      <footer className="iptv-footer"><div className="iptv-shell"><div className="iptv-footer-grid"><div><a className="iptv-brand" href="#top"><span className="iptv-brand-mark"><Radio size={18} /></span><span>Figimi <b>IPTV</b></span></a><p>A calmer way to watch the channels you already love.</p></div><nav><b>Product</b><a href="#features">Features</a><a href="#devices">Devices</a><Link href="/playlist">Manage TV playlist</Link></nav><nav><b>Learn</b><a href="#how-it-works">How it works</a><a href="#faq">FAQ</a><a href="#playlist">Get started</a></nav><nav><b>Figimi</b><a href="mailto:hello@figimi.com">Contact</a><a href="#faq">Privacy</a><a href="#top">Back to top ↑</a></nav></div><div className="iptv-footer-bottom"><span>© {new Date().getFullYear()} Figimi. Built for better watching.</span><span>Figimi does not provide or host channel content.</span></div></div></footer>
    </>
  );
}
