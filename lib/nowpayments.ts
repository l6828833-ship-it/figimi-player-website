/**
 * NOWPayments crypto integration for Figimi subscriptions
 * 
 * Required environment variables:
 * - NOWPAYMENTS_API_KEY: Your NOWPayments API key
 * - NOWPAYMENTS_IPN_SECRET: Your IPN secret for webhook verification
 * - NEXT_PUBLIC_APP_URL: Public URL of your app for IPN callback
 */

import { createHmac } from "crypto";

const API_BASE = "https://api.nowpayments.io/v1";

export function isNowPaymentsConfigured(): boolean {
  return Boolean(process.env.NOWPAYMENTS_API_KEY);
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "x-api-key": process.env.NOWPAYMENTS_API_KEY || "",
  };
}

export const PAID_STATUSES = new Set(["confirmed", "sending", "finished"]);

export type AvailableCurrency = {
  ticker: string;
  name: string;
  network: string | null;
  logoUrl: string | null;
};

/**
 * Get merchant-enabled coins with display name, network, and logo
 */
export async function getAvailableCurrencies(): Promise<AvailableCurrency[]> {
  if (!isNowPaymentsConfigured()) return [];

  try {
    // Get enabled coins
    const coinsRes = await fetch(`${API_BASE}/merchant/coins`, { headers: authHeaders() });
    const coinsData: any = await coinsRes.json();
    
    if (!coinsRes.ok) {
      console.error("[NOWPayments] coins error:", coinsRes.status, JSON.stringify(coinsData));
      return [];
    }

    const enabled = Array.isArray(coinsData?.selectedCurrencies) ? coinsData.selectedCurrencies : [];
    if (enabled.length === 0) return [];

    // Get full currency metadata
    const metaRes = await fetch(`${API_BASE}/full-currencies`, { headers: authHeaders() });
    const metaData: any = await metaRes.json();
    const currencies = Array.isArray(metaData?.currencies) ? metaData.currencies : [];

    const meta: Record<string, { name: string; network: string | null; logo: string | null; enabled: boolean }> = {};
    for (const c of currencies) {
      const code = String(c?.code ?? c?.ticker ?? "").toLowerCase();
      if (!code) continue;
      meta[code] = {
        name: c?.name || code.toUpperCase(),
        network: c?.network ? String(c.network).toUpperCase() : null,
        logo: c?.logo_url ? `https://nowpayments.io${c.logo_url}` : null,
        enabled: c?.enable !== false,
      };
    }

    const result: AvailableCurrency[] = [];
    const hasCatalog = Object.keys(meta).length > 0;

    for (const ticker of enabled) {
      const m = meta[ticker.toLowerCase()];
      // Only show coins with proper metadata when catalog is available
      if (hasCatalog && !m) continue;
      // Skip disabled coins
      if (m && m.enabled === false) continue;

      result.push({
        ticker,
        name: m?.name || ticker.toUpperCase(),
        network: m?.network ?? null,
        logoUrl: m?.logo ?? null,
      });
    }

    return result;
  } catch (e: any) {
    console.error("[NOWPayments] currencies exception:", e?.message || e);
    return [];
  }
}

export type CreatedPayment = {
  paymentId: string;
  payAddress: string;
  payAmount: number;
  payCurrency: string;
  payinExtraId: string | null;
  network: string | null;
  paymentStatus: string;
};

/**
 * Create a new payment
 */
export async function createPayment(params: {
  deviceMac: string;
  planId: string;
  amount: number;
  payCurrency: string;
}): Promise<CreatedPayment> {
  if (!isNowPaymentsConfigured()) {
    throw new Error("Crypto payments are not configured");
  }

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const orderId = `${params.deviceMac}-${params.planId}-${Date.now()}`;

  const payload = {
    price_amount: params.amount,
    price_currency: "usd",
    pay_currency: params.payCurrency,
    order_id: orderId,
    order_description: `Figimi ${params.planId} subscription for ${params.deviceMac}`,
    ipn_callback_url: `${baseUrl}/api/nowpayments/ipn`,
    is_fixed_rate: true,
  };

  const res = await fetch(`${API_BASE}/payment`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data: any = await res.json().catch(() => ({}));
  
  if (!res.ok || !data?.payment_id || !data?.pay_address) {
    console.error("[NOWPayments] create payment failed:", res.status, JSON.stringify(data));
    const raw = data?.message || `NOWPayments error (${res.status})`;
    const msg = /too small/i.test(String(raw))
      ? "This coin's minimum payment is higher than the order amount. Please choose another coin (e.g. USDT TRC20)."
      : raw;
    throw new Error(msg);
  }

  return {
    paymentId: String(data.payment_id),
    payAddress: data.pay_address,
    payAmount: Number(data.pay_amount),
    payCurrency: data.pay_currency,
    payinExtraId: data.payin_extra_id ?? null,
    network: data.network ?? null,
    paymentStatus: data.payment_status,
  };
}

/**
 * Get payment status
 */
export async function getPaymentStatus(
  paymentId: string
): Promise<{ paymentStatus: string; actuallyPaid: number; payAmount: number } | null> {
  if (!isNowPaymentsConfigured()) return null;

  try {
    const res = await fetch(`${API_BASE}/payment/${paymentId}`, { headers: authHeaders() });
    const data: any = await res.json();
    
    if (!res.ok) {
      console.error("[NOWPayments] status error:", res.status, JSON.stringify(data));
      return null;
    }

    return {
      paymentStatus: data.payment_status,
      actuallyPaid: Number(data.actually_paid || 0),
      payAmount: Number(data.pay_amount || 0),
    };
  } catch (e: any) {
    console.error("[NOWPayments] status exception:", e?.message || e);
    return null;
  }
}

/**
 * Verify IPN webhook signature
 */
export function verifyIpnSignature(body: Record<string, any>, signature: string | undefined): boolean {
  if (!signature || !process.env.NOWPAYMENTS_IPN_SECRET) return false;

  try {
    const sorted = JSON.stringify(sortObject(body));
    const hmac = createHmac("sha512", process.env.NOWPAYMENTS_IPN_SECRET).update(sorted).digest("hex");
    return hmac === signature;
  } catch {
    return false;
  }
}

// Recursively sort object keys (NOWPayments signs the sorted JSON)
function sortObject(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortObject);
  if (obj && typeof obj === "object") {
    return Object.keys(obj)
      .sort()
      .reduce((acc: Record<string, any>, key) => {
        acc[key] = sortObject(obj[key]);
        return acc;
      }, {});
  }
  return obj;
}
