"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Copy,
  KeyRound,
  Link as LinkIcon,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Tv,
  X,
} from "lucide-react";

type SourceType = "url" | "xtream" | "upload";
type Playlist = {
  id: string;
  device_mac: string;
  name: string;
  source_type: SourceType;
  enabled: boolean;
  access_count: number;
  last_accessed_at: string | null;
  expires_at: string | null;
  expired: boolean;
  created_at: string;
  playlistPath: string;
};
type DeviceSummary = {
  mac: string;
  plan: "trial" | "paid" | "lifetime";
  subscriptionExpiresAt: string | null;
  activatedAt: string | null;
  daysRemaining: number | null;
  expired: boolean;
  disabled: boolean;
  loginCount: number;
  lastLoginAt: string | null;
  firstSeenAt: string | null;
  playlistCount: number;
  activePlaylistCount: number;
};
type Session = { token: string; mac: string; expiresAt: string };

const SESSION_STORAGE_KEY = "figimi.device.session";
const compactMac = (value: string) => value.replace(/[.\-:\s]/g, "").toUpperCase();
const formatMac = (value: string) => compactMac(value).match(/.{2}/g)?.join(":") || value;
const absolute = (path: string) => (typeof window === "undefined" ? path : `${window.location.origin}${path}`);
const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
const sourceLabel = (type: SourceType) => (type === "url" ? "M3U link" : type === "xtream" ? "Xtream login" : "Uploaded M3U");

export function DevicePlaylistManager() {
  const [session, setSession] = useState<Session | null>(null);
  const [mac, setMac] = useState("");
  const [deviceKey, setDeviceKey] = useState("");
  const [device, setDevice] = useState<DeviceSummary | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Playlist | null>(null);
  const [showBuySubscription, setShowBuySubscription] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"1month" | "6months" | "12months" | "lifetime" | null>(null);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);

  const [name, setName] = useState("My playlist");
  const [sourceType, setSourceType] = useState<"url" | "xtream">("url");
  const [sourceUrl, setSourceUrl] = useState("");
  const [host, setHost] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

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
    const payload = await response.json().catch(() => ({})) as Record<string, unknown> & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Request failed.");
    return payload;
  }, []);

  const endSession = useCallback(() => {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(null);
    setPlaylists([]);
    setDevice(null);
  }, []);

  const refresh = useCallback(async (active: Session) => {
    try {
      const [list, summary] = await Promise.all([
        request("/api/device/playlists", { cache: "no-store" }, active.token),
        request("/api/device/summary", { cache: "no-store" }, active.token),
      ]);
      setPlaylists((list.playlists as Playlist[]) || []);
      setDevice((summary.device as DeviceSummary) || null);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Could not load your device.";
      setMessage({ type: "error", text });
      if (/session/i.test(text)) endSession();
    }
  }, [endSession, request]);

  useEffect(() => { if (session) void refresh(session); }, [refresh, session]);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const payload = await request("/api/device/login", { method: "POST", body: JSON.stringify({ mac: compactMac(mac), deviceKey }) });
      const active: Session = { token: payload.token as string, mac: payload.mac as string, expiresAt: payload.expiresAt as string };
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

  function resetForm() {
    setName("My playlist");
    setSourceType("url");
    setSourceUrl("");
    setHost("");
    setUsername("");
    setPassword("");
  }

  async function submitPlaylist(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setLoading(true);
    setMessage(null);
    const body = {
      name,
      sourceType,
      sourceUrl: sourceType === "url" ? sourceUrl : undefined,
      host: sourceType === "xtream" ? host : undefined,
      username: sourceType === "xtream" ? username : undefined,
      password: sourceType === "xtream" ? password : undefined,
    };
    try {
      if (editing) {
        // Only what changed is sent, so a rename never demands the Xtream password again.
        const patch: Record<string, unknown> = { name };
        if (sourceType === "url" && sourceUrl) patch.sourceUrl = sourceUrl;
        if (sourceType === "xtream" && host && username && password) { patch.host = host; patch.username = username; patch.password = password; }
        await request(`/api/device/playlists/${encodeURIComponent(editing.id)}`, { method: "PATCH", body: JSON.stringify(patch) }, session.token);
        setMessage({ type: "success", text: "Playlist updated." });
      } else {
        await request("/api/device/playlists", { method: "POST", body: JSON.stringify(body) }, session.token);
        setMessage({ type: "success", text: "Playlist added. Press Check for playlist on your TV." });
      }
      closeDialog();
      await refresh(session);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not save the playlist." });
    } finally { setLoading(false); }
  }

  async function toggle(playlist: Playlist) {
    if (!session) return;
    setMessage(null);
    try {
      await request(`/api/device/playlists/${encodeURIComponent(playlist.id)}`, { method: "PATCH", body: JSON.stringify({ enabled: !playlist.enabled }) }, session.token);
      await refresh(session);
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not update the playlist." }); }
  }

  async function remove(playlist: Playlist) {
    if (!session) return;
    if (!window.confirm(`Delete "${playlist.name}"? This cannot be undone.`)) return;
    setMessage(null);
    try {
      await request(`/api/device/playlists/${encodeURIComponent(playlist.id)}`, { method: "DELETE" }, session.token);
      await refresh(session);
      setMessage({ type: "success", text: "Playlist deleted." });
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not delete the playlist." }); }
  }

  const closeDialog = useCallback(() => {
    setShowAdd(false);
    setEditing(null);
    resetForm();
  }, []);

  // Escape closes the dialog, and the page behind it stops scrolling while it is open —
  // both expected of a modal, and their absence is what makes one feel broken.
  useEffect(() => {
    if (!showAdd) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closeDialog(); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeDialog, showAdd]);

  // Same for buy subscription modal
  useEffect(() => {
    if (!showBuySubscription) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closeBuyModal(); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [showBuySubscription]);

  function startEdit(playlist: Playlist) {
    setEditing(playlist);
    setShowAdd(true);
    setName(playlist.name);
    setSourceType(playlist.source_type === "xtream" ? "xtream" : "url");
    setSourceUrl("");
    setHost("");
    setUsername("");
    setPassword("");
    setMessage(null);
  }

  if (!session) {
    return <section className="fp-card fp-login">
      <div className="fp-card-head">
        <span className="fp-eyebrow"><Tv size={15} /> Device sign in</span>
        <h2>Sign in with your TV</h2>
        <p>Open Figimi on your Android TV. The activation screen shows this device&apos;s MAC address and its 6-digit key.</p>
      </div>
      {message && <div className={`notice ${message.type}`}>{message.text}</div>}
      <form className="fp-form" onSubmit={signIn}>
        <label>MAC address
          <input value={mac} onChange={(event) => setMac(event.target.value)} placeholder="00:1A:79:12:34:56" autoComplete="off" required />
          <small>Colons, hyphens, or no separators are accepted.</small>
        </label>
        <label>6-digit device key
          <input className="fp-key" value={deviceKey} onChange={(event) => setDeviceKey(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))} placeholder="000000" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="off" required />
          <small>Shown under the MAC address on your TV.</small>
        </label>
        <button className="fp-button primary" type="submit" disabled={loading}>{loading ? "Signing in…" : <><KeyRound size={16} /> Sign in</>}</button>
      </form>
    </section>;
  }

  const expiring = device?.daysRemaining !== null && device?.daysRemaining !== undefined && device.daysRemaining <= 3 && !device.expired;

  const pricingPlans = [
    { id: "1month" as const, duration: "1 Month", price: "$3", originalPrice: null },
    { id: "6months" as const, duration: "6 Months", price: "$6", originalPrice: null },
    { id: "12months" as const, duration: "12 Months", price: "$8", originalPrice: null },
    { id: "lifetime" as const, duration: "Lifetime", price: "$20", originalPrice: "$30" },
  ];

  const paymentMethods = [
    { id: "crypto", name: "Cryptocurrency", icon: "₿" },
    { id: "card", name: "Credit/Debit Card", icon: "💳" },
    { id: "paypal", name: "PayPal", icon: "P" },
  ];

  const handlePlanSelect = (planId: typeof selectedPlan) => {
    setSelectedPlan(planId);
    setShowPaymentMethods(true);
  };

  const handlePaymentSelect = (methodId: string) => {
    if (!selectedPlan) return;
    const plan = pricingPlans.find(p => p.id === selectedPlan);
    const method = paymentMethods.find(m => m.id === methodId);
    alert(`Selected: ${plan?.duration} (${plan?.price}) via ${method?.name}\n\nPayment processing will be implemented here.`);
  };

  const closeBuyModal = () => {
    setShowBuySubscription(false);
    setSelectedPlan(null);
    setShowPaymentMethods(false);
  };

  return <div className="fp-dash">
    {/* Subscription first: it is the thing a paying customer checks before anything else. */}
    <section className={`fp-card fp-sub ${device?.expired ? "is-expired" : expiring ? "is-expiring" : "is-active"}`}>
      <div className="fp-sub-main">
        <div>
          <span className="fp-eyebrow"><ShieldCheck size={15} /> Player subscription</span>
          <div className="fp-sub-status">
            {device?.expired ? <TriangleAlert size={20} /> : <CheckCircle2 size={20} />}
            <strong>{device?.expired ? "Expired" : device?.plan === "lifetime" ? "Lifetime" : device?.plan === "paid" ? "Active" : "Trial"}</strong>
          </div>
          <p className="fp-sub-line">
            {device?.plan === "lifetime"
              ? "This device never expires."
              : device?.expired
                ? `Ended ${formatDate(device?.subscriptionExpiresAt ?? null)}. Renew to keep watching.`
                : <><CalendarClock size={14} /> Expires {formatDate(device?.subscriptionExpiresAt ?? null)}{device?.daysRemaining !== null && device?.daysRemaining !== undefined ? ` · ${device.daysRemaining} day${device.daysRemaining === 1 ? "" : "s"} left` : ""}</>}
          </p>
        </div>
        <div className="fp-sub-side">
          <button className="fp-button ghost" type="button" onClick={() => session && refresh(session)}><RefreshCw size={15} /> Refresh</button>
          <button className="fp-button ghost" type="button" onClick={signOut}><LogOut size={15} /> Sign out</button>
        </div>
      </div>

      {/* Device details always visible */}
      <div className="fp-device-info">
        <div className="fp-device-row">
          <span className="fp-device-label">MAC Address:</span>
          <span className="fp-mono fp-device-value">{formatMac(session.mac)}</span>
        </div>
        <div className="fp-device-row">
          <span className="fp-device-label">Plan:</span>
          <span className="fp-device-value">{device?.plan || "trial"}</span>
        </div>
      </div>

      {/* Buy Subscription button */}
      <div className="fp-sub-actions">
        <button className="fp-button primary wide" type="button" onClick={() => setShowBuySubscription(true)}>
          Buy Subscription
        </button>
      </div>
    </section>

    {message && <div className={`notice ${message.type}`}>{message.text}</div>}

    <section className="fp-card">
      <div className="fp-row-head">
        <h2>My playlists</h2>
        <button className="fp-button primary" type="button" onClick={() => { setEditing(null); resetForm(); setShowAdd(true); }}>
          <Plus size={15} /> Add playlist
        </button>
      </div>

      {!playlists.length
        ? <p className="fp-empty">No playlists yet. Add one and press <strong>Check for playlist</strong> on your TV.</p>
        : <ul className="fp-list">{playlists.map((playlist) => <li key={playlist.id} className={`fp-item ${playlist.expired ? "is-expired" : playlist.enabled ? "" : "is-off"}`}>
            <div className="fp-item-main">
              <div className="fp-item-title">
                <strong>{playlist.name}</strong>
                <span className={`fp-pill ${playlist.expired ? "danger" : playlist.enabled ? "ok" : "muted"}`}>{playlist.expired ? "Expired" : playlist.enabled ? "Active" : "Off"}</span>
              </div>
              <div className="fp-item-meta">
                <span>{sourceLabel(playlist.source_type)}</span>
                <span><CalendarClock size={13} /> {playlist.expires_at ? `Expires ${formatDate(playlist.expires_at)}` : "No expiry"}</span>
                <span>{playlist.access_count.toLocaleString()} TV requests</span>
              </div>
            </div>
            <div className="fp-item-actions">
              <button className="fp-button small" type="button" onClick={() => toggle(playlist)}>{playlist.enabled ? "Deactivate" : "Activate"}</button>
              <button className="fp-button small" type="button" onClick={() => startEdit(playlist)}><Pencil size={14} /> Edit</button>
              <button className="fp-button small danger" type="button" onClick={() => remove(playlist)}><Trash2 size={14} /> Delete</button>
              <button className="fp-button small ghost" type="button" onClick={() => navigator.clipboard?.writeText(absolute(playlist.playlistPath))} title="Copy the M3U URL for manual setup"><Copy size={14} /></button>
            </div>
          </li>)}</ul>}
    </section>

    {showAdd && <div className="fp-modal-backdrop" role="presentation" onClick={closeDialog}>
      {/* Stops a click inside the dialog from reaching the backdrop's close handler. */}
      <div className="fp-modal" role="dialog" aria-modal="true" aria-labelledby="fp-modal-title" onClick={(event) => event.stopPropagation()}>
        <div className="fp-modal-head">
          <div>
            <span className="fp-eyebrow">{editing ? <><Pencil size={14} /> Edit playlist</> : <><Plus size={14} /> New playlist</>}</span>
            <h3 id="fp-modal-title">{editing ? editing.name : "Add a playlist"}</h3>
          </div>
          <button className="fp-icon-button" type="button" onClick={closeDialog} aria-label="Close"><X size={18} /></button>
        </div>

        <form className="fp-form fp-modal-body" onSubmit={submitPlaylist}>
          {editing && <p className="fp-hint">Leave the source fields empty to keep the current source.</p>}
          <label>Playlist name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoFocus required /></label>
          <div className="fp-tabs" role="tablist" aria-label="Playlist source">
            <button type="button" role="tab" aria-selected={sourceType === "url"} className={sourceType === "url" ? "active" : ""} onClick={() => setSourceType("url")}><LinkIcon size={15} /> M3U link</button>
            <button type="button" role="tab" aria-selected={sourceType === "xtream"} className={sourceType === "xtream" ? "active" : ""} onClick={() => setSourceType("xtream")}><Server size={15} /> Xtream login</button>
          </div>
          {sourceType === "url"
            ? <label>M3U link<input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="http://provider.example/get.php?username=…" required={!editing} /><small>A panel link works too; the credentials inside it are detected automatically.</small></label>
            : <>
                <label>Xtream host<input type="url" value={host} onChange={(event) => setHost(event.target.value)} placeholder="http://panel.example.com" required={!editing} /></label>
                <div className="fp-two">
                  <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="off" required={!editing} /></label>
                  <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required={!editing} /></label>
                </div>
              </>}
          <div className="fp-modal-actions">
            <button className="fp-button" type="button" onClick={closeDialog}>Cancel</button>
            <button className="fp-button primary" type="submit" disabled={loading}>{loading ? "Saving…" : editing ? "Save changes" : "Add playlist"}</button>
          </div>
        </form>
      </div>
    </div>}

    {/* Buy Subscription Modal */}
    {showBuySubscription && <div className="fp-modal-backdrop" role="presentation" onClick={closeBuyModal}>
      <div className="fp-modal fp-buy-modal" role="dialog" aria-modal="true" aria-labelledby="fp-buy-modal-title" onClick={(event) => event.stopPropagation()}>
        <div className="fp-modal-head">
          <div>
            <span className="fp-eyebrow">💳 Buy Subscription</span>
            <h3 id="fp-buy-modal-title">Choose Your Plan</h3>
          </div>
          <button className="fp-icon-button" type="button" onClick={closeBuyModal} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="fp-modal-body">
          {!showPaymentMethods ? (
            <div className="fp-pricing-grid">
              {pricingPlans.map((plan) => (
                <div
                  key={plan.id}
                  className={`fp-pricing-card ${selectedPlan === plan.id ? "selected" : ""} ${plan.id === "lifetime" ? "featured" : ""}`}
                  onClick={() => handlePlanSelect(plan.id)}
                >
                  <div className="fp-pricing-header">
                    <h4>{plan.duration}</h4>
                    {plan.id === "lifetime" && <span className="fp-badge">Best Value</span>}
                  </div>
                  <div className="fp-pricing-price">
                    <span className="fp-price-main">{plan.price}</span>
                    {plan.originalPrice && (
                      <span className="fp-price-original">{plan.originalPrice}</span>
                    )}
                  </div>
                  <button 
                    className="fp-button primary wide" 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlanSelect(plan.id);
                    }}
                  >
                    Select Plan
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="fp-payment-methods">
              <div className="fp-payment-header">
                <button 
                  className="fp-button ghost small" 
                  type="button" 
                  onClick={() => {
                    setShowPaymentMethods(false);
                    setSelectedPlan(null);
                  }}
                >
                  ← Back to Plans
                </button>
              </div>
              <div className="fp-selected-plan-info">
                <p>Selected: <strong>{pricingPlans.find(p => p.id === selectedPlan)?.duration}</strong> - <strong>{pricingPlans.find(p => p.id === selectedPlan)?.price}</strong></p>
              </div>
              <h4 className="fp-payment-title">Choose Payment Method</h4>
              <div className="fp-payment-grid">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    className="fp-payment-card"
                    type="button"
                    onClick={() => handlePaymentSelect(method.id)}
                  >
                    <span className="fp-payment-icon">{method.icon}</span>
                    <span className="fp-payment-name">{method.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>}
  </div>;
}
