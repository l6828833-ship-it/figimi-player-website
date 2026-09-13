import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getDevice, SUBSCRIPTION_PRESETS } from "@/lib/iptv/admin-devices";
import { deriveDeviceKey } from "@/lib/iptv/device-key";
import { listPaymentsForDevice, PAYMENT_METHODS, PAYMENT_STATUSES, summarize } from "@/lib/iptv/payments";
import {
  deleteDeviceAction,
  expireNowAction,
  extendDaysAction,
  extendSubscriptionAction,
  setBlockedAction,
  setLabelAction,
  setLifetimeAction,
  setNotesAction,
} from "../../../devices/actions";
import { addPaymentAction, deletePaymentAction, setPaymentStatusAction } from "../../../payments/actions";
import { ActionNotice, DeviceStatus, formatDate, formatDateTime, formatMoney, macSlug } from "../parts";

type Params = Promise<{ mac: string }>;
type SearchParams = Promise<Record<string, string | undefined>>;

export const metadata = { title: "Device" };

const sourceLabel = (type: string) => (type === "url" ? "M3U link" : type === "xtream" ? "Xtream login" : "Uploaded M3U");

export default async function DeviceDetailPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { mac: raw } = await params;
  const query = await searchParams;

  const device = await getDevice(decodeURIComponent(raw)).catch(() => null);
  if (!device) notFound();

  const back = `/admin/devices/${macSlug(device.mac)}`;
  const payments = await listPaymentsForDevice(device.mac);
  const totals = summarize(payments);
  const today = new Date().toISOString().slice(0, 10);

  return <>
    <div className="admin-heading">
      <div>
        <Link className="admin-back" href="/admin/devices"><ArrowLeft size={15} />All devices</Link>
        <h1 className="fp-mono">{device.mac}</h1>
        <p>{device.label || "No customer name yet"} · activation key <strong className="fp-mono">{deriveDeviceKey(device.mac)}</strong></p>
      </div>
      <DeviceStatus device={device} />
    </div>

    <ActionNotice params={query} />

    <div className="admin-metrics">
      <div><span><small>Plan</small><strong className="fp-caps">{device.plan}</strong></span></div>
      <div><span><small>Expires</small><strong>{device.plan === "lifetime" ? "Never" : formatDate(device.subscriptionExpiresAt)}</strong></span></div>
      <div><span><small>Days left</small><strong>{device.plan === "lifetime" ? "∞" : device.expired ? "0" : device.daysRemaining ?? "—"}</strong></span></div>
      <div><span><small>Sign-ins</small><strong>{device.loginCount.toLocaleString()}</strong></span></div>
      <div><span><small>Collected</small><strong>{totals.byCurrency.length ? formatMoney(totals.byCurrency[0].total, totals.byCurrency[0].currency) : "—"}</strong></span></div>
    </div>

    <section className="admin-card">
      <h2>Subscription</h2>
      <p className="fp-hint">Extending while the term is still running adds to the current end date, so renewing early costs the customer nothing.</p>
      <div className="admin-preset-grid wide">{SUBSCRIPTION_PRESETS.map((preset) => <form key={preset.months} action={extendSubscriptionAction}>
        <input type="hidden" name="mac" value={device.mac} />
        <input type="hidden" name="months" value={preset.months} />
        <input type="hidden" name="back" value={back} />
        <button className="button small secondary" type="submit">+{preset.months === 24 ? "2y" : preset.months === 12 ? "1y" : `${preset.months}m`}</button>
      </form>)}</div>

      <div className="admin-action-row">
        <form action={extendDaysAction} className="admin-inline-form">
          <input type="hidden" name="mac" value={device.mac} />
          <input type="hidden" name="back" value={back} />
          <input name="days" type="number" min={1} max={3650} placeholder="Days" required aria-label="Days to add" />
          <button className="button small secondary" type="submit">Add days</button>
        </form>
        <form action={setLifetimeAction}><input type="hidden" name="mac" value={device.mac} /><input type="hidden" name="back" value={back} /><button className="button small secondary" type="submit">Lifetime</button></form>
        <form action={expireNowAction}><input type="hidden" name="mac" value={device.mac} /><input type="hidden" name="back" value={back} /><button className="button small secondary" type="submit">End now</button></form>
        <form action={setBlockedAction}>
          <input type="hidden" name="mac" value={device.mac} />
          <input type="hidden" name="blocked" value={String(!device.blocked)} />
          <input type="hidden" name="back" value={back} />
          <button className={`button small ${device.blocked ? "secondary" : "danger"}`} type="submit">{device.blocked ? "Unblock device" : "Block device"}</button>
        </form>
      </div>

      <dl className="admin-facts">
        <div><dt>First seen</dt><dd>{formatDateTime(device.firstSeenAt)}</dd></div>
        <div><dt>Activated</dt><dd>{formatDateTime(device.activatedAt)}</dd></div>
        <div><dt>Last sign-in</dt><dd>{formatDateTime(device.lastLoginAt)}</dd></div>
        <div><dt>Open sessions</dt><dd>{device.sessionCount}</dd></div>
        <div><dt>Sign-in lock</dt><dd>{device.lockedUntil && new Date(device.lockedUntil) > new Date() ? `Locked until ${formatDateTime(device.lockedUntil)}` : "None"}</dd></div>
      </dl>
    </section>

    <section className="admin-card">
      <h2>Customer</h2>
      <form action={setLabelAction} className="admin-inline-form">
        <input type="hidden" name="mac" value={device.mac} />
        <input type="hidden" name="back" value={back} />
        <input name="label" defaultValue={device.label || ""} placeholder="Customer name" maxLength={120} aria-label="Customer name" />
        <button className="button small secondary" type="submit">Save name</button>
      </form>
      <form action={setNotesAction} className="admin-inline-form">
        <input type="hidden" name="mac" value={device.mac} />
        <input type="hidden" name="back" value={back} />
        <input name="notes" defaultValue={device.notes || ""} placeholder="Internal note (phone number, reseller, reminder)" maxLength={500} aria-label="Internal note" />
        <button className="button small secondary" type="submit">Save note</button>
      </form>
    </section>

    <section className="admin-card">
      <h2>Payments</h2>
      <form action={addPaymentAction} className="admin-payment-form">
        <input type="hidden" name="mac" value={device.mac} />
        <input type="hidden" name="back" value={back} />
        <label>Amount<input name="amount" type="number" min="0" step="0.01" required /></label>
        <label>Currency<input name="currency" defaultValue="USD" maxLength={3} pattern="[A-Za-z]{3}" /></label>
        <label>Method<select name="method" defaultValue="cash">{PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
        <label>Months<select name="months" defaultValue="1"><option value="0">None</option>{SUBSCRIPTION_PRESETS.map((preset) => <option key={preset.months} value={preset.months}>{preset.label}</option>)}</select></label>
        <label>Status<select name="status" defaultValue="paid">{PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
        <label>Date<input name="paidAt" type="date" defaultValue={today} /></label>
        <label>Reference<input name="reference" placeholder="Receipt or transfer id" maxLength={120} /></label>
        <label className="span-2">Note<input name="note" placeholder="Optional" maxLength={500} /></label>
        <label className="admin-check"><input name="extend" type="checkbox" defaultChecked />Extend the subscription by the months chosen</label>
        <button className="button primary" type="submit">Record payment</button>
      </form>

      {!payments.length ? <p>No payments recorded for this device.</p> : <div className="admin-table"><table>
        <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Term</th><th>Status</th><th /></tr></thead>
        <tbody>{payments.map((payment) => <tr key={payment.id}>
          <td>{formatDate(payment.paidAt)}{payment.reference && <small>{payment.reference}</small>}</td>
          <td>{formatMoney(payment.amount, payment.currency)}{payment.note && <small>{payment.note}</small>}</td>
          <td className="fp-caps">{payment.method}</td>
          <td>{payment.months ? `${payment.months} month(s)` : "—"}</td>
          <td><span className={`status ${payment.status === "paid" ? "published" : payment.status === "pending" ? "scheduled" : "danger"}`}>{payment.status}</span></td>
          <td><div className="admin-inline-actions">
            {payment.status !== "refunded" && <form action={setPaymentStatusAction}>
              <input type="hidden" name="id" value={payment.id} />
              <input type="hidden" name="status" value={payment.status === "paid" ? "refunded" : "paid"} />
              <input type="hidden" name="back" value={back} />
              <button className="button small secondary" type="submit">{payment.status === "paid" ? "Refund" : "Mark paid"}</button>
            </form>}
            <form action={deletePaymentAction}>
              <input type="hidden" name="id" value={payment.id} />
              <input type="hidden" name="back" value={back} />
              <button className="button small danger" type="submit">Delete</button>
            </form>
          </div></td>
        </tr>)}</tbody>
      </table></div>}
    </section>

    <section className="admin-card">
      <h2>Playlists</h2>
      {!device.playlists.length ? <p>This device has no playlists yet. The owner adds them at <code>/playlist</code>.</p> : <div className="admin-table"><table>
        <thead><tr><th>Name</th><th>Source</th><th>Usage</th><th>Expires</th><th>Status</th></tr></thead>
        <tbody>{device.playlists.map((playlist) => <tr key={playlist.id}>
          <td><strong>{playlist.name}</strong><small>Added {formatDate(playlist.createdAt)}</small></td>
          <td>{sourceLabel(playlist.sourceType)}</td>
          <td>{playlist.accessCount.toLocaleString()} TV requests<small>{playlist.lastAccessedAt ? `Last ${formatDateTime(playlist.lastAccessedAt)}` : "Not used yet"}</small></td>
          <td>{playlist.expiresAt ? formatDate(playlist.expiresAt) : "With device"}</td>
          <td><span className={`status ${playlist.enabled ? "published" : ""}`}>{playlist.enabled ? "enabled" : "disabled"}</span></td>
        </tr>)}</tbody>
      </table></div>}
      <p className="fp-hint">Playlist sources and Xtream credentials are encrypted and never shown here. Enable, disable, or delete them on the <Link className="admin-link" href="/admin/iptv">Playlists</Link> page.</p>
    </section>

    <div className="danger-zone">
      <p><strong>Delete this device</strong><br />Removes its playlists, sessions, and record. The TV can come back with a fresh trial, so block it instead if you want it shut out.</p>
      <form action={deleteDeviceAction}><input type="hidden" name="mac" value={device.mac} /><button className="button small danger" type="submit">Delete device</button></form>
    </div>
  </>;
}
