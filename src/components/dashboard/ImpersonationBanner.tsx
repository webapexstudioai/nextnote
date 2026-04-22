"use client";

import { useEffect, useState } from "react";

export default function ImpersonationBanner() {
  const [impersonating, setImpersonating] = useState<{
    adminEmail: string | null;
    viewingEmail: string | null;
  } | null>(null);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.impersonation) {
          setImpersonating({
            adminEmail: data.impersonation.adminEmail,
            viewingEmail: data.user?.email ?? null,
          });
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function stop() {
    setStopping(true);
    try {
      const res = await fetch("/api/admin/stop-impersonating", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        window.location.href = data.redirectTo || "/admin";
      } else {
        alert(data.error || "Failed to stop impersonating");
        setStopping(false);
      }
    } catch {
      alert("Failed to stop impersonating");
      setStopping(false);
    }
  }

  if (!impersonating) return null;

  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: "linear-gradient(90deg, #7c2d12, #b45309)",
        color: "white",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        borderBottom: "1px solid rgba(0,0,0,0.3)",
        fontSize: 13,
      }}
    >
      <div>
        <strong>Impersonating</strong> — viewing as{" "}
        <code style={{ background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: 4 }}>
          {impersonating.viewingEmail ?? "user"}
        </code>{" "}
        (admin:&nbsp;{impersonating.adminEmail ?? "unknown"})
      </div>
      <button
        onClick={stop}
        disabled={stopping}
        style={{
          background: "white",
          color: "#7c2d12",
          border: "none",
          padding: "6px 14px",
          borderRadius: 6,
          fontWeight: 600,
          cursor: stopping ? "wait" : "pointer",
          fontSize: 12,
        }}
      >
        {stopping ? "Stopping…" : "Stop & return to admin"}
      </button>
    </div>
  );
}
