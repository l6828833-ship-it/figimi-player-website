"use client";

// Detects the family of errors that happen when a browser (or CDN) is holding a
// cached HTML document that references JavaScript chunks from a previous deploy.
// After a new deploy the old, content-hashed chunk files no longer exist, so the
// webpack runtime fails with messages like:
//   - "Cannot read properties of undefined (reading 'call')"
//   - "Loading chunk N failed" / ChunkLoadError
//   - "Failed to fetch dynamically imported module"
const CHUNK_ERROR_PATTERN =
  /ChunkLoadError|Loading chunk [\d]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|reading 'call'/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const err = error as { name?: string; message?: string };
  if (err.name === "ChunkLoadError") return true;
  return typeof err.message === "string" && CHUNK_ERROR_PATTERN.test(err.message);
}

// Reloads the page once to pull a fresh document + matching chunks. A timestamp
// guard prevents an infinite reload loop if the problem is not actually stale
// chunks (at most one reload per 20s window).
export function recoverFromChunkError(error: unknown): void {
  if (typeof window === "undefined" || !isChunkLoadError(error)) return;
  try {
    const key = "figimi:last-chunk-reload";
    const now = Date.now();
    const last = Number(window.sessionStorage.getItem(key) || "0");
    if (now - last > 20_000) {
      window.sessionStorage.setItem(key, String(now));
      window.location.reload();
    }
  } catch {
    // sessionStorage may be unavailable (private mode / blocked); reloading is
    // still safe because the render already failed.
    window.location.reload();
  }
}
