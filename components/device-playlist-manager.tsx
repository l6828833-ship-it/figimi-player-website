"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Link as LinkIcon, LogOut, Server, Trash2, Wifi } from "lucide-react";

type SourceType = "url" | "xtream" | "upload";
type Playlist = {
  id: string;
  device_mac: string;
  name: string;
  source_type: SourceType;
  enabled: boolean;
  access_count: number;
  last_accessed_at: string | null;
  created_at: string;
  playlistPath: string;
};
type Session = { token: string; mac: string; expiresAt: string };

/** Same-origin: the API lives in this app, so there is no cross-origin call to configure. */
const playlistUrlFor = (path: string) => (typeof window === "undefined" ? path : `${window.location.origin}${path}`);
const compactMac = (value: string) => value.replace(/[.\-:\s]/g, "").toUpperCase();
const formatMac = (value: string) => compactMac(value).match(/.{2}/g)?.join(":") || value;
const SESSION_STORAGE_KEY = "figimi.device.session";

export function DevicePlaylistManager() {
  const [session, setSession] = useState<Session | null>(null);
  const [mac, setMac] = useState("");
  const [deviceKey, setDeviceKey] = useState("");
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("My playlist");
  const [sourceType, setSourceType] = useState<"url" | "xtream">("url");
  const [sourceUrl, setSourceUrl] = useState("");
  const [host, setHost] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Restored from sessionStorage so a refresh does not force a new sign-in.
  useEffect(() => {
    const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Session;
      if (new Date(parsed.expiresAt).getTime() > Date.now()) setSession(parsed);
      else window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch { window.sessionStorage.removeItem(SESSION_STORAGE_KEY); }
  }, []);

  const request = useCallback(async (path: string, init?: RequestInit, token?: string) => {
    const response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
    });
    const payload = await response.json().catch(() => ({})) as { error?: string; playlist?: Playlist; playlists?: Playlist[]; token?: string; mac?: string; expiresAt?: string };
    if (!response.ok) throw new Error(payload.error || "Playlist service request failed.");
    return payload;
  }, []);

  const endSession = useCallback(() => {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(null);
    setPlaylists([]);
  }, []);

  const loadPlaylists = useCallback(async (active: Session) => {
    try {
      const payload = await request("/api/device/playlists", { cache: "no-store" }, active.token);
      setPlaylists(payload.playlists || []);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Could not load playlists.";
      setMessage({ type: "error", text });
      if (/session/i.test(text)) endSession();
    }
  }, [endSession, request]);

  useEffect(() => { if (session) void loadPlaylists(session); }, [loadPlaylists, session]);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const payload = await request("/api/device/login", { method: "POST", body: JSON.stringify({ mac: compactMac(mac), deviceKey }) });
      const active: Session = { token: payload.token!, mac: payload.mac!, expiresAt: payload.expiresAt! };
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(active));
      setSession(active);
      setDeviceKey("");
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not sign in." });
    } finally { setLoading(false); }
  }

  async function signOut() {
    if (session) await request("/api/device/logout", { method: "POST" }, session.token).catch(() => undefined);
    endSession();
    setMessage(null);
  }

  async function addPlaylist(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setLoading(true);
    setMessage(null);
    try {
      await request("/api/device/playlists", {
        method: "POST",
        body: JSON.stringify({
          name,
          sourceType,
          sourceUrl: sourceType === "url" ? sourceUrl : undefined,
          host: sourceType === "xtream" ? host : undefined,
          username: sourceType === "xtream" ? username : undefined,
          password: sourceType === "xtream" ? password : undefined,
        }),
      }, session.token);
      setSourceUrl("");
      setPassword("");
      setMessage({ type: "success", text: "Playlist saved for this device." });
      await loadPlaylists(session);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not save the playlist." });
    } finally { setLoading(false); }
  }

  async function toggle(playlist: Playlist) {
    if (!session) return;
    try {
      await request(`/api/device/playlists/${encodeURIComponent(playlist.id)}`, { method: "PATCH", body: JSON.stringify({ enabled: !playlist.enabled }) }, session.token);
      await loadPlaylists(session);
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not update the playlist." }); }
  }

  async function remove(playlist: Playlist) {
    if (!session) return;
    try {
      await request(`/api/device/playlists/${encodeURIComponent(playlist.id)}`, { method: "DELETE" }, session.token);
      await loadPlaylists(session);
      setMessage({ type: "success", text: "Playlist deleted." });
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not delete the playlist." }); }
  }

  if (!session) {
    return <div className="playlist-manager">
      <section className="admin-card playlist-login">
        <div className="playlist-manager-intro">
          <span className="eyebrow"><Wifi size={15} /> Device sign in</span>
          <h2>Sign in with your TV</h2>
          <p>Open Figimi on your Android TV. The activation screen shows this device&apos;s MAC address and its 6-digit key; enter both here to manage its playlists.</p>
        </div>
        {message && <div className={`notice ${message.type}`}>{message.text}</div>}
        <form className="form-grid" onSubmit={signIn}>
          <label>MAC address<input value={mac} onChange={(event) => setMac(event.target.value)} placeholder="00:1A:79:12:34:56" autoComplete="off" required /><small>Colons, hyphens, or no separators are accepted.</small></label>
          <label>6-digit device key<input className="playlist-key-input" value={deviceKey} onChange={(event) => setDeviceKey(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))} placeholder="000000" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" maxLength={6} required /><small>Shown under the MAC address on your TV.</small></label>
          <div className="form-submit span-2"><button className="button primary" type="submit" disabled={loading}>{loading ? "Signing in…" : <><KeyRound size={16} /> Sign in to dashboard</>}</button></div>
        </form>
      </section>
    </div>;
  }

  return <div className="playlist-manager">
    <section className="admin-card playlist-session">
      <div>
        <span className="eyebrow"><Wifi size={15} /> Signed in device</span>
        <h2>{formatMac(session.mac)}</h2>
        <p>{playlists.length} playlist{playlists.length === 1 ? "" : "s"} linked to this Android TV.</p>
      </div>
      <button className="button secondary" type="button" onClick={signOut}><LogOut size={15} /> Sign out</button>
    </section>

    {message && <div className={`notice ${message.type}`}>{message.text}</div>}

    <section className="admin-card">
      <h2>Add a playlist</h2>
      <div className="playlist-source-tabs" role="tablist" aria-label="Playlist source">
        <button type="button" role="tab" aria-selected={sourceType === "url"} className={sourceType === "url" ? "active" : ""} onClick={() => setSourceType("url")}><LinkIcon size={16} /> M3U link</button>
        <button type="button" role="tab" aria-selected={sourceType === "xtream"} className={sourceType === "xtream" ? "active" : ""} onClick={() => setSourceType("xtream")}><Server size={16} /> Xtream login</button>
      </div>
      <form className="form-grid" onSubmit={addPlaylist}>
        <label className="span-2">Playlist name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Living room" required /></label>
        {sourceType === "url" && <label className="span-2">M3U link<input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://provider.example/playlist.m3u" required /><small>Checked now, then refetched each time your TV loads the playlist.</small></label>}
        {sourceType === "xtream" && <>
          <label className="span-2">Xtream host<input type="url" value={host} onChange={(event) => setHost(event.target.value)} placeholder="http://panel.example.com" required /><small>Panel base URL, without <code>player_api.php</code>.</small></label>
          <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="off" required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required /></label>
          <p className="span-2 playlist-hint">The login is verified now, stored encrypted, and converted to an M3U for your TV. Live channels and movies are included; series need the app&apos;s Xtream mode.</p>
        </>}
        <div className="form-submit span-2"><button className="button primary" type="submit" disabled={loading}>{loading ? "Saving…" : "Save playlist"}</button></div>
      </form>
    </section>

    <section className="admin-card">
      <h2>Your playlists</h2>
      {!playlists.length ? <p>No playlists yet. Add one above and it will appear here.</p> : <div className="playlist-list">{playlists.map((playlist) => {
        const url = playlistUrlFor(playlist.playlistPath);
        return <div className="playlist-list-item" key={playlist.id}>
          <div>
            <strong>{playlist.name}</strong>
            <small>{playlist.source_type === "url" ? "M3U link" : playlist.source_type === "xtream" ? "Xtream login" : "Uploaded M3U"} · {playlist.enabled ? "Enabled" : "Disabled"} · {playlist.access_count.toLocaleString()} TV requests</small>
            <div className="playlist-url-readout"><code>{url}</code><button type="button" className="button small secondary" onClick={() => navigator.clipboard?.writeText(url)}><Copy size={14} /> Copy</button></div>
          </div>
          <div className="playlist-item-actions">
            <button type="button" className="button small secondary" onClick={() => toggle(playlist)}>{playlist.enabled ? "Disable" : "Enable"}</button>
            <button type="button" className="button small danger" onClick={() => remove(playlist)}><Trash2 size={14} /> Delete</button>
          </div>
        </div>;
      })}</div>}
    </section>
  </div>;
}
