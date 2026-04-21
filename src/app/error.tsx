"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f0f", color: "#f5f5f5", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", padding: "24px" }}>
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <div style={{ display: "inline-block", width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#e8553d,#ff8a6a)", lineHeight: "48px", fontSize: 20, fontWeight: 700, marginBottom: 16 }}>N</div>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Something went wrong</h1>
        <p style={{ color: "#a0a0a0", marginBottom: 24 }}>
          An unexpected error occurred. You can try again, or return to the dashboard.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={reset}
            style={{ padding: "10px 20px", background: "#e8553d", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            style={{ padding: "10px 20px", background: "#1a1a1a", color: "#f5f5f5", border: "1px solid #2a2a2a", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
