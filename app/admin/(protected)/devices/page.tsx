import Link from "next/link";
import { AlertTriangle, Ban, CalendarClock, MonitorSmartphone, Plus, Search, Wallet } from "lucide-react";
import { DEVICE_FILTERS, filterDevices, listDevices, matchesFilter, type DeviceFilter } from "@/lib/iptv/admin-devices";
import { revenueByDevice } from "@/lib/iptv/payments";
import { createDeviceAction, extendSubscriptionAction, setBlockedAction } from "../../devices/actions";
import { ActionNotice, DeviceStatus, formatDate, formatMoney, macSlug } from "./parts";

type SearchParams = Promise<Record<string, string | undefined>>;

export const metadata = { title: "Devices" };

/** Shown inline in the table; the full 1-24 month range lives on the device page. */
const QUICK_MONTHS = [1, 3, 6, 12];

const FILTER_LABELS: Record<DeviceFilter, string> = {
  all: "All",
  active: "Active",
  expiring: "Expiring ≤7d",
  trial: "On trial",
  expired: "Expired",
  blocked: "Blocked",
  lifetime: "Lifetime",
};

export default async function DevicesAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filter: DeviceFilter = DEVICE_FILTERS.includes((params.filter || "all") as DeviceFilter) ? ((params.filter || "all") as DeviceFilter) : "all";
  const search = params.q?.trim() || "";

  const [all, revenue] = await Promise.all([listDevices(), revenueByDevice()]);
  const counts = Object.fromEntries(DEVICE_FILTERS.map((key) => [key, all.filter((device) => matchesFilter(device, key)).length])) as Record<DeviceFilter, number>;
  const devices = filterDevices(all, { search, filter });

  const paid = [...revenue.values()];
  const collected = paid.reduce((sum, entry) => sum + entry.total, 0);
  const currency = paid[0]?.currency || "USD";

  return <>
    <div className="admin-heading">
      <div><span className="eyebrow">Subscriptions</span><h1>Devices</h1><p>Every Android TV that contacted Figimi. Trials start on first contact and stay tied to the TV, so reinstalling the app never restarts one.</p></div>
      <Link className="button secondary" href="/admin/payments"><Wallet size={17} />Payments</Link>
    </div>

    <ActionNotice params={params} />

    <div className="admin-metrics">
      <div><MonitorSmartphone /><span><small>Devices</small><strong>{all.length.toLocaleString()}</strong></span></div>
      <div><CalendarClock /><span><small>Active</small><strong>{counts.active.toLocaleString()}</strong></span></div>
      <div className="warn"><AlertTriangle /><span><small>Expiring ≤7 days</small><strong>{counts.expiring.toLocaleString()}</strong></span></div>
      <div className="warn"><Ban /><span><small>Expired / blocked</small><strong>{(counts.expired + counts.blocked).toLocaleString()}</strong></span></div>
      <div><Wallet /><span><small>Collected</small><strong>{formatMoney(collected, currency)}</strong></span></div>
    </div>

    <section className="admin-card">
      <details className="admin-reveal">
        <summary><Plus size={16} />Add a device manually</summary>
        <form action={createDeviceAction} className="admin-row-form">
          <label>MAC address<input name="mac" placeholder="00:1A:79:7E:22:34" required /></label>
          <label>Customer name<input name="label" placeholder="Optional" maxLength={120} /></label>
          <label>Start with
            <select name="months" defaultValue="0">
              <option value="0">7-day trial</option>
              {[1, 3, 6, 12, 24].map((months) => <option key={months} value={months}>{months} month(s)</option>)}
            </select>
          </label>
          <button className="button primary" type="submit">Add device</button>
        </form>
        <p className="fp-hint">Use this to sell a term before the TV is switched on. The app activates on first contact with whatever term is set here.</p>
      </details>
    </section>

    <div className="admin-toolbar">
      <div className="admin-chips">{DEVICE_FILTERS.map((key) => <Link
        key={key}
        className={`admin-chip${filter === key ? " active" : ""}`}
        href={`/admin/devices?filter=${key}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
      >{FILTER_LABELS[key]}<b>{counts[key]}</b></Link>)}</div>
      <form className="admin-search" action="/admin/devices">
        <input type="hidden" name="filter" value={filter} />
        <Search size={16} />
        <input name="q" defaultValue={search} placeholder="Search MAC, customer, note" aria-label="Search devices" />
        <button className="button small secondary" type="submit">Search</button>
      </form>
    </div>

    <section className="admin-card">
      {!devices.length ? <p>{all.length ? "No devices match this view." : "No devices have contacted the service yet."}</p> : <div className="admin-table"><table>
        <thead><tr><th>Device</th><th>Status</th><th>Expires</th><th>Paid</th><th>Extend</th><th /></tr></thead>
        <tbody>{devices.map((device) => <tr key={device.mac}>
          <td>
            <Link className="fp-mono admin-link" href={`/admin/devices/${macSlug(device.mac)}`}>{device.mac}</Link>
            <small>{device.label || "No name"} · {device.playlistCount} playlist(s) · {device.loginCount} sign-in(s)</small>
          </td>
          <td><DeviceStatus device={device} />{device.daysRemaining !== null && !device.expired && device.plan !== "lifetime" && <small>{device.daysRemaining} day(s) left</small>}</td>
          <td>{device.plan === "lifetime" ? "Never" : formatDate(device.subscriptionExpiresAt)}</td>
          <td>{revenue.has(device.mac)
            ? <>{formatMoney(revenue.get(device.mac)!.total, revenue.get(device.mac)!.currency)}<small>{revenue.get(device.mac)!.count} payment(s)</small></>
            : <small>No payment</small>}</td>
          <td>
            {/* One-click months: renewing is the routine job and a preset is harder to
                get wrong than typing a date. */}
            <div className="admin-preset-grid">{QUICK_MONTHS.map((months) => <form key={months} action={extendSubscriptionAction}>
              <input type="hidden" name="mac" value={device.mac} />
              <input type="hidden" name="months" value={months} />
              <input type="hidden" name="back" value="/admin/devices" />
              <button className="button small secondary" type="submit" title={`Add ${months} month(s)`}>{months === 12 ? "1y" : `${months}m`}</button>
            </form>)}</div>
          </td>
          <td>
            <div className="admin-inline-actions">
              <form action={setBlockedAction}>
                <input type="hidden" name="mac" value={device.mac} />
                <input type="hidden" name="blocked" value={String(!device.blocked)} />
                <input type="hidden" name="back" value="/admin/devices" />
                <button className={`button small ${device.blocked ? "secondary" : "danger"}`} type="submit">{device.blocked ? "Unblock" : "Block"}</button>
              </form>
              <Link className="button small secondary" href={`/admin/devices/${macSlug(device.mac)}`}>Manage</Link>
            </div>
          </td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </>;
}
