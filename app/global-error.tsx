"use client";

import { useEffect } from "react";
import { isChunkLoadError, recoverFromChunkError } from "@/lib/chunk-recovery";

// The global error boundary replaces the root layout when it crashes, so it must
// render its own <html> and <body>. Styles are inline because globals.css may not
// be applied in this fallback context.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Global application error:", error);
    recoverFromChunkError(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          background: "#f6f5fb",
          color: "#171525",
          padding: "24px",
        }}
      >
        <main style={{ maxWidth: "520px", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.6rem", margin: "0 0 12px" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 20px", lineHeight: 1.6, color: "#4a4761" }}>
            The application hit an unexpected error. Please try again, and if the problem continues, return to the home page.
          </p>
          {error.digest && (
            <p style={{ margin: "0 0 20px", fontSize: "0.85rem", color: "#8b88a3" }}>Reference: {error.digest}</p>
          )}
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => (isChunkLoadError(error) ? window.location.reload() : reset())}
              style={{
                cursor: "pointer",
                border: "none",
                borderRadius: "10px",
                padding: "10px 18px",
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "#ffffff",
                background: "#6957d9",
              }}
            >
              {isChunkLoadError(error) ? "Reload" : "Try again"}
            </button>
            <button
              onClick={() => window.location.assign("/")}
              style={{
                cursor: "pointer",
                border: "none",
                borderRadius: "10px",
                padding: "10px 18px",
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "#171525",
                background: "#e7e5f2",
              }}
            >
              Back to home
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
