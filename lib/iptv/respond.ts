import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError } from "./mac";

/**
 * One error shape for every device route.
 *
 * Unexpected failures are logged and reported generically: the underlying message
 * can name database columns or upstream hosts, which is not something to hand to an
 * unauthenticated caller.
 */
export function apiError(error: unknown): NextResponse {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError) {
    // Naming the field matters: a bare "Required" gives the user nothing to act on.
    const details = error.issues
      .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message.toLowerCase()}` : issue.message))
      .join("; ");
    return NextResponse.json({ error: details || "Check the values you entered." }, { status: 400 });
  }
  console.error("Device API failure:", error);
  return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
}

/** Rejects oversized bodies before parsing; these endpoints only ever carry small JSON. */
export async function readJson(request: Request, maximumBytes = 64 * 1024): Promise<unknown> {
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > maximumBytes) throw new ApiError("Request body is too large.", 413);
  if (!raw.trim()) return {};
  try { return JSON.parse(raw); }
  catch { throw new ApiError("Request body must be valid JSON.", 400); }
}
