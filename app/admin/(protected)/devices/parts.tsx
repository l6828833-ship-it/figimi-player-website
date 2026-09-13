import type { AdminDevice } from "@/lib/iptv/admin-devices";

/** MACs travel in URLs with dashes; `normalizeMac` accepts either form on the way back. */
export const macSlug = (mac: string) => mac.replace(/:/g, "-");

export const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

export const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

type StatusInput = Pick<AdminDevice, "blocked" | "expired" | "plan" | "daysRemaining">;

export function DeviceStatus({ device }: { device: StatusInput }) {
  if (device.blocked) return <span className="status danger">blocked</span>;
  if (device.plan === "lifetime") return <span className="status published">lifetime</span>;
  if (device.expired) return <span className="status danger">expired</span>;
  if (device.daysRemaining !== null && device.daysRemaining <= 7) return <span className="status scheduled">{device.daysRemaining}d left</span>;
  return <span className="status published">{device.plan === "trial" ? "trial" : "active"}</span>;
}

/** One place for the banners every device/payment action redirects with. */
export function ActionNotice({ params }: { params: Record<string, string | undefined> }) {
  const messages: [string, string][] = [
    ["extended", `Subscription extended by ${params.extended} month(s).`],
    ["reduced", `Subscription cut by ${params.reduced} month(s).`],
    ["lifetime", "Device set to lifetime access."],
    ["expired", "Subscription ended."],
    ["blocked", "Device blocked and its sessions revoked."],
    ["unblocked", "Device unblocked."],
    ["deleted", "Device deleted."],
    ["noted", "Note saved."],
    ["labelled", "Customer name saved."],
    ["created", "Device added."],
    ["paid", "Payment recorded."],
    ["updated", "Payment updated."],
    ["removed", "Payment deleted."],
  ];
  const hit = messages.find(([key]) => params[key]);
  return <>
    {params.error && <div className="notice error">{params.error}</div>}
    {hit && <div className="notice success">{hit[1]}</div>}
  </>;
}
