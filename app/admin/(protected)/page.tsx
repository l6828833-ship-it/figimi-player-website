import Link from "next/link";
import { AlertTriangle, Ban, CalendarClock, MonitorSmartphone, Wallet } from "lucide-react";
import { listDevices, matchesFilter } from "@/lib/iptv/admin-devices";
import { listPayments, summarize } from "@/lib/iptv/payments";
import { extendTermAction } from "../devices/actions";
import ExtendControl from "./devices/extend-control";
import { DeviceStatus, formatDate, formatMoney, macSlug } from "./devices/parts";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [devices, ledger] = await Promise.all([listDevices(), listPayments()]);
  const payments = ledger.slice(0, 8);
  const totals = summarize(ledger);
  const primary = totals.byCurrency[0];

  const active = devices.filter((device) => matchesFilter(device, "active"));
  const expiring = devices
    .filter((device) => matchesFilter(device, "expiring"))
    .sort((a, b) => (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0));
  const trials = devices.filter((device) => matchesFilter(device, "trial"));
  const blocked = devices.filter((device) => device.blocked);
  const expired = devices.filter((device) => matchesFilter(device, "expired"));

  return <>
    <div className="admin-heading">
      <div><span className="eyebrow">Control room</span><h1>Dashboard</h1><p>Subscriptions, renewals, and money for every Android TV running Figimi.</p></div>
      <Link className="button primary" href="/admin/devices"><MonitorSmartphone size={17} />Manage devices</Link>
    </div>

    <div className="admin-metrics">
      <Link href="/admin/devices"><MonitorSmartphone /><span><small>Devices</small><strong>{devices.length.toLocaleString()}</strong></span></Link>
      <Link href="/admin/devices?filter=active"><CalendarClock /><span><small>Active</small><strong>{active.length.toLocaleString()}</strong></span></Link>
      <Link className="warn" href="/admin/devices?filter=expiring"><AlertTriangle /><span><small>Expiring ≤7 days</small><strong>{expiring.length.toLocaleString()}</strong></span></Link>
      <Link className="warn" href="/admin/devices?filter=expired"><Ban /><span><small>Expired / blocked</small><strong>{(expired.length + blocked.length).toLocaleString()}</strong></span></Link>
      <Link href="/admin/payments"><Wallet /><span><small>This month</small><strong>{primary ? formatMoney(primary.month, primary.currency) : "—"}</strong></span></Link>
    </div>

    <div className="admin-columns">
      <section className="admin-card">
        <h2>Renewals due</h2>
        {!expiring.length ? <p>Nothing expires in the next 7 days.</p> : <div className="admin-list">{expiring.slice(0, 8).map((device) => <div key={device.mac}>
          <span>
            <Link className="fp-mono admin-link" href={`/admin/devices/${macSlug(device.mac)}`}>{device.mac}</Link>
            <small>{device.label || "No name"} · ends {formatDate(device.subscriptionExpiresAt)}</small>
          </span>
          <span className="admin-list-actions">
            <DeviceStatus device={device} />
            {/* Renew straight from the dashboard: chasing this list is the daily job. */}
            <ExtendControl mac={device.mac} back="/admin" action={extendTermAction} />
          </span>
        </div>)}</div>}
      </section>

      <section className="admin-card">
        <h2>Recent payments</h2>
        {!payments.length ? <p>No payments recorded yet. Add one on the <Link className="admin-link" href="/admin/payments">Payments</Link> page.</p> : <div className="admin-list">{payments.map((payment) => <div key={payment.id}>
          <span>
            <Link className="fp-mono admin-link" href={`/admin/devices/${macSlug(payment.mac)}`}>{payment.mac}</Link>
            <small>{formatDate(payment.paidAt)} · {payment.method}{payment.months ? ` · ${payment.months} month(s)` : ""}</small>
          </span>
          <span className="admin-list-actions"><strong>{formatMoney(payment.amount, payment.currency)}</strong></span>
        </div>)}</div>}
      </section>
    </div>

    <section className="admin-card">
      <h2>Trials running</h2>
      {!trials.length ? <p>No devices are on a trial right now.</p> : <div className="admin-table"><table>
        <thead><tr><th>Device</th><th>Customer</th><th>Trial ends</th><th>Status</th></tr></thead>
        <tbody>{trials.slice(0, 10).map((device) => <tr key={device.mac}>
          <td><Link className="fp-mono admin-link" href={`/admin/devices/${macSlug(device.mac)}`}>{device.mac}</Link></td>
          <td>{device.label || <small>No name</small>}</td>
          <td>{formatDate(device.subscriptionExpiresAt)}</td>
          <td><DeviceStatus device={device} /></td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </>;
}
