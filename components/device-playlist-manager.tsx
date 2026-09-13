"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { CryptoPayment } from "./crypto-payment";
import {
  CalendarClock,
  CheckCircle2,
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
type PaymentMethod = {
  id: string;
  name: string;
  icon?: string;
  icons?: string[];
};

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
  const [showCryptoPayment, setShowCryptoPayment] = useState(false);

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

  const paymentMethods: PaymentMethod[] = [
    { 
      id: "crypto", 
      name: "Cryptocurrency", 
      icons: [
        "/bitcoin-svgrepo-com.svg",
        "/tether-crypto-cryptocurrency-2-svgrepo-com (1).svg",
        "/litecoin-ltc-cryptocurrency-svgrepo-com.svg",
        "/ripple-xrp-cryptocurrency-3-svgrepo-com.svg"
      ]
    },
    { 
      id: "card", 
      name: "Credit/Debit Card", 
      icon: "/card-credit-debit-svgrepo-com.svg"
    },
    { 
      id: "paypal", 
      name: "PayPal", 
      icon: "paypal"
    },
  ];

  const handlePlanSelect = (planId: typeof selectedPlan) => {
    setSelectedPlan(planId);
    setShowPaymentMethods(true);
  };

  const handlePaymentSelect = (methodId: string) => {
    if (!selectedPlan) return;
    
    if (methodId === "crypto") {
      // Show crypto payment component
      setShowCryptoPayment(true);
    } else {
      // For card and PayPal, show a placeholder for now
      const plan = pricingPlans.find(p => p.id === selectedPlan);
      const method = paymentMethods.find(m => m.id === methodId);
      alert(`Selected: ${plan?.duration} (${plan?.price}) via ${method?.name}\n\nPayment processing will be implemented here.`);
    }
  };

  const closeBuyModal = () => {
    setShowBuySubscription(false);
    setSelectedPlan(null);
    setShowPaymentMethods(false);
    setShowCryptoPayment(false);
  };

  const handleCryptoSuccess = () => {
    setShowCryptoPayment(false);
    closeBuyModal();
    if (session) refresh(session);
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
    {showBuySubscription && !showCryptoPayment && <div className="fp-modal-backdrop" role="presentation" onClick={closeBuyModal}>
      <div className="fp-modal fp-buy-modal" role="dialog" aria-modal="true" aria-labelledby="fp-buy-modal-title" onClick={(event) => event.stopPropagation()}>
        <div className="fp-modal-head fp-buy-modal-head">
          {showPaymentMethods && (
            <button 
              className="fp-button ghost small fp-back-button" 
              type="button" 
              onClick={() => {
                setShowPaymentMethods(false);
                setSelectedPlan(null);
              }}
            >
              ← Back to Plans
            </button>
          )}
          <h3 id="fp-buy-modal-title" className="fp-buy-modal-title">Choose Your Plan</h3>
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
                    <div className="fp-payment-icon">
                      {method.id === "crypto" && method.icons ? (
                        <div className="fp-crypto-icons">
                          {method.icons.map((iconPath, idx) => (
                            <Image
                              key={idx}
                              src={iconPath}
                              alt=""
                              width={32}
                              height={32}
                              className="fp-crypto-icon"
                            />
                          ))}
                        </div>
                      ) : method.id === "paypal" ? (
                        <svg viewBox="0 -139.5 750 750" width="80" height="50" xmlns="http://www.w3.org/2000/svg">
                          <path d="M697.115385,0 L52.8846154,0 C23.7240385,0 0,23.1955749 0,51.7065868 L0,419.293413 C0,447.804425 23.7240385,471 52.8846154,471 L697.115385,471 C726.274038,471 750,447.804425 750,419.293413 L750,51.7065868 C750,23.1955749 726.274038,0 697.115385,0 Z" fill="#ffffff"/>
                          <g transform="translate(54.000000, 150.000000)">
                            <path d="M109.272795,8.45777679 C101.24875,2.94154464 90.7780357,0.176741071 77.8606518,0.176741071 L27.8515268,0.176741071 C23.8915714,0.176741071 21.7038036,2.15719643 21.2882232,6.11333036 L0.972553571,133.638223 C0.761419643,134.890696 1.07477679,136.03617 1.90975893,137.077509 C2.73996429,138.120759 3.78416964,138.639518 5.03473214,138.639518 L28.7887321,138.639518 C32.9550446,138.639518 35.2450357,136.663839 35.6653929,132.701973 L41.2905357,98.3224911 C41.4959375,96.6563482 42.2286964,95.3016518 43.4792589,94.2584018 C44.7288661,93.2170625 46.2918304,92.5358929 48.1671964,92.2234911 C50.0425625,91.9139554 51.8109286,91.7582321 53.4808929,91.7582321 C55.1460804,91.7582321 57.124625,91.8633214 59.4203482,92.0706339 C61.7103393,92.2789018 63.170125,92.3801696 63.7958839,92.3801696 C81.7145625,92.3801696 95.7793304,87.3311071 105.991143,77.2224732 C116.198179,67.1176607 121.307429,53.1054375 121.307429,35.1829375 C121.307429,22.8903571 117.293018,13.9826071 109.272795,8.45777679 Z M83.4877054,46.7484911 C82.4425446,54.0426429 79.7369732,58.8328036 75.3614375,61.1256607 C70.9849464,63.4213839 64.7340446,64.5620804 56.6087321,64.5620804 L46.2937411,64.8754375 L51.6083929,31.43125 C52.0230179,29.1412589 53.3767589,27.9948304 55.6705714,27.9948304 L61.6109821,27.9948304 C69.9416964,27.9948304 75.9881518,29.1957143 79.7388839,31.5879286 C83.4877054,33.985875 84.7382679,39.041625 83.4877054,46.7484911 Z" fill="#003087"/>
                            <path d="M637.026411,0.176741071 L613.899125,0.176741071 C611.601491,0.176741071 610.248705,1.32316964 609.835991,3.61507143 L589.518411,133.638223 L589.205054,134.263027 C589.205054,135.310098 589.622545,136.295071 590.457527,137.233232 C591.286777,138.169482 592.332893,138.638562 593.581545,138.638562 L614.212482,138.638562 C618.16575,138.638562 620.354473,136.662884 620.776741,132.701018 L641.092411,4.86276786 L641.092411,4.55227679 C641.091455,1.63557143 639.732938,0.176741071 637.026411,0.176741071 Z" fill="#009CDE"/>
                            <path d="M357.599732,50.4973125 C357.599732,49.4578839 357.18033,48.4662232 356.352036,47.5299732 C355.516098,46.5927679 354.576982,46.1217768 353.538509,46.1217768 L329.471152,46.1217768 C327.174473,46.1217768 325.300063,47.1688482 323.845054,49.24675 L290.714223,98.0081786 L276.962812,51.1240268 C275.916696,47.7917411 273.62575,46.1217768 270.086152,46.1217768 L246.641687,46.1217768 C245.597482,46.1217768 244.659321,46.5918125 243.831027,47.5299732 C242.995089,48.4662232 242.580464,49.4588393 242.580464,50.4973125 C242.580464,50.9176696 244.612509,57.0615714 248.674687,68.9385714 C252.736866,80.8174821 257.113357,93.6326429 261.80225,107.38692 C266.491143,121.137375 268.936857,128.434393 269.147036,129.262688 C252.059518,152.602063 243.51767,165.104821 243.51767,166.769054 C243.51767,169.480357 244.871411,170.833143 247.580804,170.833143 L271.648161,170.833143 C273.940062,170.833143 275.814473,169.793714 277.274259,167.709125 L356.976839,52.6850804 C357.391464,52.2704554 357.599732,51.5443839 357.599732,50.4973125 Z" fill="#003087"/>
                            <path d="M581.704545,46.1217768 L557.948634,46.1217768 C555.030018,46.1217768 553.263562,49.5601071 552.638759,56.4367679 C547.215196,48.1060536 537.323429,43.9330536 522.943393,43.9330536 C507.940464,43.9330536 495.174982,49.5601071 484.655545,60.8123036 C474.13133,72.0654554 468.872089,85.2990625 468.872089,100.508348 C468.872089,112.80475 472.465187,122.597161 479.653295,129.887491 C486.842357,137.185464 496.479045,140.827286 508.568134,140.827286 C514.608857,140.827286 520.755625,139.574813 527.006527,137.076554 C533.258384,134.576384 538.150768,131.244098 541.698964,127.07492 C541.698964,127.284143 541.486875,128.220393 541.073205,129.886536 C540.652848,131.5565 540.447446,132.808973 540.447446,133.637268 C540.447446,136.975286 541.798321,138.637607 544.511536,138.637607 L566.079679,138.637607 C570.032946,138.637607 572.32867,136.661929 572.952518,132.700063 L585.768634,51.1230714 C585.974036,49.8725089 585.661634,48.7279911 584.830473,47.6847411 C583.994536,46.6443571 582.955107,46.1217768 581.704545,46.1217768 Z M540.916527,107.696455 C535.60283,112.906018 529.196205,115.509366 521.694741,115.509366 C515.649241,115.509366 510.756857,113.845134 507.004214,110.509027 C503.252527,107.180563 501.377161,102.595804 501.377161,96.7566607 C501.377161,89.0517054 503.981464,82.5361696 509.191982,77.2224732 C514.395812,71.9087768 520.860714,69.2519286 528.571402,69.2519286 C534.400036,69.2519286 539.245607,70.9715714 543.104295,74.4089464 C546.956295,77.8472768 548.888027,82.5896696 548.888027,88.6323036 C548.887071,96.1328125 546.229268,102.489759 540.916527,107.696455 Z" fill="#009CDE"/>
                            <path d="M226.639375,46.1217768 L202.885375,46.1217768 C199.963893,46.1217768 198.196482,49.5601071 197.570723,56.4367679 C191.944625,48.1060536 182.04617,43.9330536 167.877268,43.9330536 C152.874339,43.9330536 140.109813,49.5601071 129.588464,60.8123036 C119.06425,72.0654554 113.805009,85.2990625 113.805009,100.508348 C113.805009,112.80475 117.400018,122.597161 124.58908,129.887491 C131.778143,137.185464 141.41292,140.827286 153.500098,140.827286 C159.331598,140.827286 165.378054,139.574813 171.628,137.076554 C177.878902,134.576384 182.880196,131.244098 186.630929,127.07492 C185.794991,129.575089 185.380366,131.763813 185.380366,133.637268 C185.380366,136.975286 186.734107,138.637607 189.4435,138.637607 L211.009732,138.637607 C214.965866,138.637607 217.260634,136.661929 217.886393,132.700063 L230.700598,51.1230714 C230.906,49.8725089 230.593598,48.7279911 229.763393,47.6847411 C228.929366,46.6443571 227.888982,46.1217768 226.639375,46.1217768 Z M185.850402,107.851223 C180.53575,112.962384 174.02117,115.509366 166.316214,115.509366 C160.269759,115.509366 155.425143,113.845134 151.781411,110.509027 C148.132902,107.180563 146.311036,102.595804 146.311036,96.7566607 C146.311036,89.0517054 148.914384,82.5361696 154.125857,77.2224732 C159.331598,71.9087768 165.791723,69.2519286 173.504321,69.2519286 C179.335821,69.2519286 184.180437,70.9715714 188.039125,74.4089464 C191.891125,77.8472768 193.820946,82.5896696 193.820946,88.6323036 C193.820946,96.3420357 191.164098,102.751527 185.850402,107.851223 Z" fill="#003087"/>
                            <path d="M464.337964,8.45777679 C456.314875,2.94154464 445.846071,0.176741071 432.926777,0.176741071 L383.230054,0.176741071 C379.05992,0.176741071 376.767062,2.15719643 376.353393,6.11333036 L356.037723,133.637268 C355.826589,134.889741 356.138991,136.035214 356.974929,137.076554 C357.802268,138.119804 358.849339,138.638563 360.099902,138.638563 L385.728312,138.638563 C388.228482,138.638563 389.894625,137.285777 390.729607,134.576384 L396.356661,98.3215357 C396.563018,96.6553929 397.292911,95.3006964 398.544429,94.2574464 C399.794991,93.2161071 401.356045,92.5349375 403.233321,92.2225357 C405.107732,91.913 406.876098,91.7572768 408.547018,91.7572768 C410.212205,91.7572768 412.19075,91.8623661 414.483607,92.0696786 C416.775509,92.2779464 418.238161,92.3792143 418.859143,92.3792143 C436.780687,92.3792143 450.843545,87.3301518 461.055357,77.2215179 C471.265259,67.1167054 476.370687,53.1044821 476.370687,35.1819821 C476.371643,22.8903571 472.358187,13.9826071 464.337964,8.45777679 Z M432.301018,59.8750982 C427.716259,63.0000714 420.839598,64.5620804 411.672946,64.5620804 L401.670357,64.8754375 L406.985009,31.43125 C407.397723,29.1412589 408.751464,27.9948304 411.047187,27.9948304 L416.671375,27.9948304 C421.254223,27.9948304 424.900821,28.2030982 427.614036,28.6186786 C430.318652,29.0390357 432.926777,30.3373661 435.426946,32.5251339 C437.929027,34.7138571 439.177679,37.8923304 439.177679,42.0595982 C439.177679,50.8106696 436.882911,56.7482143 432.301018,59.8750982 Z" fill="#009CDE"/>
                          </g>
                        </svg>
                      ) : (
                        <Image
                          src={method.icon!}
                          alt={method.name}
                          width={60}
                          height={60}
                        />
                      )}
                    </div>
                    <span className="fp-payment-name">{method.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>}

    {/* Crypto Payment Modal */}
    {showCryptoPayment && selectedPlan && session && (
      <div className="fp-modal-backdrop" role="presentation" onClick={closeBuyModal}>
        <div onClick={(event) => event.stopPropagation()}>
          <CryptoPayment
            deviceMac={session.mac}
            planId={selectedPlan}
            amount={Number(pricingPlans.find(p => p.id === selectedPlan)?.price.replace('$', '') || 0)}
            onClose={closeBuyModal}
            onSuccess={handleCryptoSuccess}
          />
        </div>
      </div>
    )}
  </div>;
}
