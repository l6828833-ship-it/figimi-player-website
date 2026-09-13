import Link from "next/link";
import { Search } from "lucide-react";
import { SUBSCRIPTION_PRESETS } from "@/lib/iptv/admin-devices";
import { filterPayments, listPayments, PAYMENT_METHODS, PAYMENT_STATUSES, summarize } from "@/lib/iptv/payments";
import { addPaymentAction, deletePaymentAction, setPaymentStatusAction } from "../../payments/actions";
import { ActionNotice, formatDate, formatMoney, macSlug } from "../devices/parts";

type SearchParams = Promise<Record<string, string | undefined>>;

export const metadata = { title: "Payments" };

export default async function PaymentsAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const search = params.q?.trim() || "";

  const all = await listPayments();
  const payments = filterPayments(all, search);
  const totals = summarize(all);
  const today = new Date().toISOString().slice(0, 10);
  const primary = totals.byCurrency[0];

  return <>
    <div className="admin-heading">
      <div><span className="eyebrow">Money</span><h1>Payments</h1><p>A ledger of what each TV paid, in the currency it was taken in. Recording a payment can extend that device&apos;s subscription in the same step.</p></div>
      <Link className="button secondary" href="/admin/devices">Devices</Link>
    </div>

    <ActionNotice params={params} />

    <div className="admin-metrics">
      <div><span><small>Collected all time</small><strong>{primary ? formatMoney(primary.total, primary.currency) : "—"}</strong></span></div>
      <div><span><small>This month</small><strong>{primary ? formatMoney(primary.month, primary.currency) : "—"}</strong></span></div>
      <div><span><small>Payments</small><strong>{totals.count.toLocaleString()}</strong></span></div>
      <div className={totals.pending ? "warn" : undefined}><span><small>Pending</small><strong>{totals.pending.toLocaleString()}</strong></span></div>
    </div>

    {totals.byCurrency.length > 1 && <p className="fp-hint">Other currencies: {totals.byCurrency.slice(1).map((entry) => formatMoney(entry.total, entry.currency)).join(" · ")}. Amounts are never converted, so each currency is totalled on its own.</p>}

    <section className="admin-card">
      <h2>Record a payment</h2>
      <form action={addPaymentAction} className="admin-payment-form">
        <input type="hidden" name="back" value="/admin/payments" />
        <label className="span-2">Device MAC<input name="mac" placeholder="00:1A:79:7E:22:34" required /></label>
        <label>Amount<input name="amount" type="number" min="0" step="0.01" required /></label>
        <label>Currency<input name="currency" defaultValue="USD" maxLength={3} pattern="[A-Za-z]{3}" /></label>
        <label>Method<select name="method" defaultValue="cash">{PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
        <label>Months<select name="months" defaultValue="1"><option value="0">None</option>{SUBSCRIPTION_PRESETS.map((preset) => <option key={preset.months} value={preset.months}>{preset.label}</option>)}</select></label>
        <label>Status<select name="status" defaultValue="paid">{PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
        <label>Date<input name="paidAt" type="date" defaultValue={today} /></label>
        <label>Reference<input name="reference" placeholder="Receipt or transfer id" maxLength={120} /></label>
        <label>Note<input name="note" placeholder="Optional" maxLength={500} /></label>
        <label className="admin-check"><input name="extend" type="checkbox" defaultChecked />Extend that device by the months chosen</label>
        <button className="button primary" type="submit">Record payment</button>
      </form>
    </section>

    <div className="admin-toolbar">
      <form className="admin-search" action="/admin/payments">
        <Search size={16} />
        <input name="q" defaultValue={search} placeholder="Search MAC, method, reference" aria-label="Search payments" />
        <button className="button small secondary" type="submit">Search</button>
      </form>
    </div>

    <section className="admin-card">
      <h2>History</h2>
      {!payments.length ? <p>{all.length ? "No payments match that search." : "No payments recorded yet."}</p> : <div className="admin-table"><table>
        <thead><tr><th>Date</th><th>Device</th><th>Amount</th><th>Method</th><th>Term</th><th>Status</th><th /></tr></thead>
        <tbody>{payments.map((payment) => <tr key={payment.id}>
          <td>{formatDate(payment.paidAt)}{payment.reference && <small>{payment.reference}</small>}</td>
          <td><Link className="fp-mono admin-link" href={`/admin/devices/${macSlug(payment.mac)}`}>{payment.mac}</Link>{payment.note && <small>{payment.note}</small>}</td>
          <td>{formatMoney(payment.amount, payment.currency)}</td>
          <td className="fp-caps">{payment.method}</td>
          <td>{payment.months ? `${payment.months} month(s)` : "—"}</td>
          <td><span className={`status ${payment.status === "paid" ? "published" : payment.status === "pending" ? "scheduled" : "danger"}`}>{payment.status}</span></td>
          <td><div className="admin-inline-actions">
            {payment.status !== "refunded" && <form action={setPaymentStatusAction}>
              <input type="hidden" name="id" value={payment.id} />
              <input type="hidden" name="status" value={payment.status === "paid" ? "refunded" : "paid"} />
              <input type="hidden" name="back" value="/admin/payments" />
              <button className="button small secondary" type="submit">{payment.status === "paid" ? "Refund" : "Mark paid"}</button>
            </form>}
            <form action={deletePaymentAction}>
              <input type="hidden" name="id" value={payment.id} />
              <input type="hidden" name="back" value="/admin/payments" />
              <button className="button small danger" type="submit">Delete</button>
            </form>
          </div></td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </>;
}
