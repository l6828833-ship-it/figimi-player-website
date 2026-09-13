import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, normalizeMac } from "./mac";
import { adjustSubscription } from "./admin-devices";

export const PAYMENT_METHODS = ["cash", "card", "paypal", "bank", "crypto", "reseller", "other"] as const;
export const PAYMENT_STATUSES = ["paid", "pending", "refunded"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type Payment = {
  id: string;
  mac: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  months: number;
  status: PaymentStatus;
  reference: string | null;
  note: string | null;
  paidAt: string;
};

export type PaymentInput = {
  mac: string;
  amount: number;
  currency?: string;
  method?: string;
  months?: number;
  status?: string;
  reference?: string;
  note?: string;
  paidAt?: string;
  /** Extends the device term by `months` as part of recording the payment. */
  extend?: boolean;
};

const row = (record: Record<string, unknown>): Payment => ({
  id: record.id as string,
  mac: record.device_mac as string,
  amount: Number(record.amount || 0),
  currency: ((record.currency as string) || "USD").toUpperCase(),
  method: ((record.method as string) || "other") as PaymentMethod,
  months: Number(record.months || 0),
  status: ((record.status as string) || "paid") as PaymentStatus,
  reference: (record.reference as string | null) ?? null,
  note: (record.note as string | null) ?? null,
  paidAt: record.paid_at as string,
});

/** Matches a MAC typed with or without separators, plus method, reference, and note text. */
export function filterPayments(payments: Payment[], search?: string): Payment[] {
  const term = search?.trim().toLowerCase();
  if (!term) return payments;
  const compact = term.replace(/[.\-:\s]/g, "");
  return payments.filter((payment) =>
    payment.mac.toLowerCase().replace(/:/g, "").includes(compact) ||
    [payment.method, payment.status, payment.reference, payment.note]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term)));
}

export async function listPayments(options: { search?: string; limit?: number } = {}): Promise<Payment[]> {
  const { data, error } = await createAdminClient()
    .from("iptv_device_payments")
    .select("id,device_mac,amount,currency,method,months,status,reference,note,paid_at")
    .order("paid_at", { ascending: false })
    .limit(options.limit ?? 300);
  if (error) throw error;
  return filterPayments((data || []).map(row), options.search);
}

export async function listPaymentsForDevice(macValue: string): Promise<Payment[]> {
  const mac = normalizeMac(macValue);
  const { data, error } = await createAdminClient()
    .from("iptv_device_payments")
    .select("id,device_mac,amount,currency,method,months,status,reference,note,paid_at")
    .eq("device_mac", mac)
    .order("paid_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(row);
}

export type PaymentTotals = {
  /** Kept per currency: adding USD to EUR would report a number that means nothing. */
  byCurrency: { currency: string; total: number; month: number; count: number }[];
  count: number;
  pending: number;
};

/** Refunded rows are excluded from money totals but still counted, so the ledger stays honest. */
export function summarize(payments: Payment[]): PaymentTotals {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const buckets = new Map<string, { currency: string; total: number; month: number; count: number }>();
  let pending = 0;

  for (const payment of payments) {
    if (payment.status === "pending") pending += 1;
    if (payment.status !== "paid") continue;
    const bucket = buckets.get(payment.currency) || { currency: payment.currency, total: 0, month: 0, count: 0 };
    bucket.total += payment.amount;
    bucket.count += 1;
    if (new Date(payment.paidAt) >= startOfMonth) bucket.month += payment.amount;
    buckets.set(payment.currency, bucket);
  }

  return {
    byCurrency: [...buckets.values()].sort((a, b) => b.total - a.total),
    count: payments.length,
    pending,
  };
}

export type DeviceRevenue = { total: number; currency: string; count: number; lastPaidAt: string | null };

/** Per-device totals for the devices table, using each device's most used currency. */
export async function revenueByDevice(): Promise<Map<string, DeviceRevenue>> {
  const { data, error } = await createAdminClient()
    .from("iptv_device_payments")
    .select("device_mac,amount,currency,status,paid_at");
  if (error) throw error;

  const totals = new Map<string, DeviceRevenue>();
  for (const record of data || []) {
    if ((record.status as string) !== "paid") continue;
    const mac = record.device_mac as string;
    const current = totals.get(mac) || { total: 0, currency: ((record.currency as string) || "USD").toUpperCase(), count: 0, lastPaidAt: null };
    current.total += Number(record.amount || 0);
    current.count += 1;
    const paidAt = record.paid_at as string;
    if (!current.lastPaidAt || new Date(paidAt) > new Date(current.lastPaidAt)) current.lastPaidAt = paidAt;
    totals.set(mac, current);
  }
  return totals;
}

export async function addPayment(input: PaymentInput): Promise<Payment> {
  const mac = normalizeMac(input.mac);
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100_000) throw new ApiError("Enter an amount between 0 and 100000.", 400);

  const currency = (input.currency || "USD").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new ApiError("Use a 3-letter currency code, for example USD or EUR.", 400);

  const method = (input.method || "cash") as PaymentMethod;
  if (!PAYMENT_METHODS.includes(method)) throw new ApiError("Choose a valid payment method.", 400);

  const status = (input.status || "paid") as PaymentStatus;
  if (!PAYMENT_STATUSES.includes(status)) throw new ApiError("Choose a valid payment status.", 400);

  const months = Number(input.months || 0);
  if (!Number.isInteger(months) || months < 0 || months > 120) throw new ApiError("Months must be between 0 and 120.", 400);

  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
  if (Number.isNaN(paidAt.getTime())) throw new ApiError("Enter a valid payment date.", 400);

  const { data, error } = await createAdminClient()
    .from("iptv_device_payments")
    .insert({
      device_mac: mac,
      amount,
      currency,
      method,
      months,
      status,
      reference: input.reference?.trim().slice(0, 120) || null,
      note: input.note?.trim().slice(0, 500) || null,
      paid_at: paidAt.toISOString(),
    })
    .select("id,device_mac,amount,currency,method,months,status,reference,note,paid_at")
    .single();
  if (error) throw error;

  // Recording the money and granting the time are one job for the operator, so the
  // subscription is extended here rather than leaving a paid device expired by mistake.
  // A pending or refunded row grants nothing.
  if (input.extend && months > 0 && status === "paid") await adjustSubscription(mac, months);

  return row(data as Record<string, unknown>);
}

export async function setPaymentStatus(id: string, status: string) {
  if (!PAYMENT_STATUSES.includes(status as PaymentStatus)) throw new ApiError("Choose a valid payment status.", 400);
  const { error } = await createAdminClient().from("iptv_device_payments").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deletePayment(id: string) {
  const { error } = await createAdminClient().from("iptv_device_payments").delete().eq("id", id);
  if (error) throw error;
}
