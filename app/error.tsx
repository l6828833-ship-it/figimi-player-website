"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { isChunkLoadError, recoverFromChunkError } from "@/lib/chunk-recovery";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface the real error in the browser console so the exact cause can be diagnosed.
    // The production overlay only shows a generic message and this digest.
    console.error("Application error:", error);
    // A stale deploy can leave cached HTML pointing at chunk files that no longer
    // exist, which shows up as "Cannot read properties of undefined (reading 'call')".
    // Recover by fetching a fresh document once (guarded against reload loops).
    recoverFromChunkError(error);
  }, [error]);

  return (
    <div className="shell error-page" role="alert">
      <h1>Something went wrong</h1>
      <p>
        {isChunkLoadError(error)
          ? "We updated the app while this page was open. Refreshing should fix it."
          : "This page hit an unexpected error. You can try again, and if it keeps happening, head back to the home page."}
      </p>
      {error.digest && <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Reference: {error.digest}</p>}
      <div className="convert-actions" style={{ justifyContent: "center" }}>
        <button
          className="button primary"
          onClick={() => (isChunkLoadError(error) ? window.location.reload() : reset())}
        >
          <RotateCcw size={17} />{isChunkLoadError(error) ? "Reload" : "Try again"}
        </button>
        <Link className="button secondary" href="/">Back to home</Link>
      </div>
    </div>
  );
}
