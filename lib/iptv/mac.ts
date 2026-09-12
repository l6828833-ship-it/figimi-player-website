import "server-only";

/** Carries an HTTP status so route handlers can return the right code without mapping messages. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Canonical `XX:XX:XX:XX:XX:XX`, accepting colons, hyphens, dots, or nothing at all
 * between the pairs — a MAC read off a TV gets typed every one of those ways.
 */
export function normalizeMac(value: string): string {
  const compact = value.trim().replace(/[.\-:\s]/g, "").toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(compact)) throw new ApiError("Enter a valid 12-digit MAC address.", 400);
  // All-zero, all-F, and multicast addresses are never a real device identity.
  if (/^0+$/.test(compact) || /^F+$/.test(compact) || Number.parseInt(compact.slice(0, 2), 16) % 2 === 1) {
    throw new ApiError("Enter a valid unicast device MAC address.", 400);
  }
  return compact.match(/.{2}/g)!.join(":");
}
