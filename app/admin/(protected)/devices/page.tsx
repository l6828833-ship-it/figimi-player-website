import { listDevices, SUBSCRIPTION_PRESETS } from "@/lib/iptv/admin-devices";
import {
  deleteDeviceAction,
  expireNowAction,
  extendSubscriptionAction,
  setBlockedAction,
  setLifetimeAction,
  setNotesAction,
} from "../../devices/actions";

type SearchParams = Promise<Record<string, string | undefined>>;

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");

function statusPill(device: { blocked: boolean; expired: boolean; plan: string; daysRemaining: number | null }) {
  if (device.blocked) return <span className="status">blocked</span>;
  if (device.plan === "lifetime") return <span className="status published">lifetime</span>;
  if (device.expired) return <span className="status">expired</span>;
  if (device.daysRemaining !== null && device.daysRemaining <= 3) return <span className="status scheduled">{device.daysRemaining}d left</span>;
  return <span className="status published">active</span>;
}

export default async function DevicesAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const devices = await listDevices();
  const active = devices.filter((device) => !device.blocked && !device.expired).length;
  const trials = devices.filter((device) => device.plan === "trial" && !device.expired).length;

  return <>
    <div className="admin-heading"><div><span className="eyebrow">Subscriptions</span><h1>Devices</h1><p>Every Android TV that has contacted Figimi. Trials start on first contact and are tied to the device, so reinstalling the app does not restart them.</p></div></div>

    {params.error && <div className="notice error">{params.error}</div>}
    {params.extended && <div className="notice success">Subscription extended by {params.extended} month(s).</div>}
    {params.lifetime && <div className="notice success">Device set to lifetime access.</div>}
    {params.expired && <div className="notice success">Subscription ended.</div>}
    {params.blocked && <div className="notice success">Device blocked and its sessions revoked.</div>}
    {params.unblocked && <div className="notice success">Device unblocked.</div>}
    {params.deleted && <div className="notice success">Device deleted.</div>}
    {params.noted && <div className="notice success">Note saved.</div>}

    <div className="dashboard-stats">
      <a href="#devices"><span>Total devices</span><strong>{devices.length.toLocaleString()}</strong></a>
      <a href="#devices"><span>Active</span><strong>{active.toLocaleString()}</strong></a>
      <a href="#devices"><span>On trial</span><strong>{trials.toLocaleString()}</strong></a>
    </div>

    <section className="admin-card" id="devices">
      <h2>All devices</h2>
      {!devices.length ? <p>No devices have contacted the service yet.</p> : <div className="admin-table"><table>
        <thead><tr><th>Device</th><th>Plan</th><th>Expires</th><th>Status</th><th>Extend</th><th>Actions</th></tr></thead>
        <tbody>{devices.map((device) => <tr key={device.mac}>
          <td>
            <strong className="fp-mono">{device.mac}</strong>
            <small>{device.playlistCount} playlist(s) · {device.loginCount} sign-in(s)</small>
            <small>First seen {formatDate(device.firstSeenAt)}{device.lastLoginAt ? ` · last ${formatDate(device.lastLoginAt)}` : ""}</small>
            <form action={setNotesAction} className="admin-note-form">
              <input type="hidden" name="mac" value={device.mac} />
              <input name="notes" defaultValue={device.notes || ""} placeholder="Customer note" maxLength={500} />
              <button className="button small secondary" type="submit">Save</button>
            </form>
          </td>
          <td>{device.plan}</td>
          <td>{device.plan === "lifetime" ? "Never" : formatDate(device.subscriptionExpiresAt)}{device.daysRemaining !== null && !device.expired && device.plan !== "lifetime" && <small>{device.daysRemaining} day(s) left</small>}</td>
          <td>{statusPill(device)}</td>
          <td>
            {/* Presets rather than a date field: renewing is the routine job and a
                one-click month is harder to get wrong than typing a date. */}
            <div className="admin-preset-grid">{SUBSCRIPTION_PRESETS.map((preset) => <form key={preset.months} action={extendSubscriptionAction}>
              <input type="hidden" name="mac" value={device.mac} />
              <input type="hidden" name="months" value={preset.months} />
              <button className="button small secondary" type="submit" title={`Add ${preset.label}`}>{preset.months === 24 ? "2y" : preset.months === 12 ? "1y" : `${preset.months}m`}</button>
            </form>)}</div>
          </td>
          <td>
            <div className="admin-inline-actions">
              <form action={setLifetimeAction}><input type="hidden" name="mac" value={device.mac} /><button className="button small secondary" type="submit">Lifetime</button></form>
              <form action={expireNowAction}><input type="hidden" name="mac" value={device.mac} /><button className="button small secondary" type="submit">End now</button></form>
              <form action={setBlockedAction}>
                <input type="hidden" name="mac" value={device.mac} />
                <input type="hidden" name="blocked" value={String(!device.blocked)} />
                <button className={`button small ${device.blocked ? "secondary" : "danger"}`} type="submit">{device.blocked ? "Unblock" : "Block"}</button>
              </form>
              <form action={deleteDeviceAction}><input type="hidden" name="mac" value={device.mac} /><button className="button small danger" type="submit">Delete</button></form>
            </div>
          </td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </>;
}
