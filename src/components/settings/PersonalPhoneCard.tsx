"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Loader2, Phone, Send } from "lucide-react";

type Status = "loading" | "idle" | "code_sent" | "verified";

function formatPhoneDisplay(e164: string): string {
  // E.164 +1NNNNNNNNNN → (NNN) NNN-NNNN. Anything else, return as-is.
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (!m) return e164;
  return `(${m[1]}) ${m[2]}-${m[3]}`;
}

export function PersonalPhoneCard() {
  const [status, setStatus] = useState<Status>("loading");
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (cancelled) return;
        const phone = data?.user?.verifiedPersonalPhone || null;
        setVerifiedPhone(phone);
        setStatus(phone ? "verified" : "idle");
      } catch {
        if (!cancelled) setStatus("idle");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function startVerification() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await fetch("/api/account/phone/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phoneInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Couldn't send code.");
        return;
      }
      setPendingPhone(data.phone_number);
      setStatus("code_sent");
      setInfo("We texted a 6-digit code to your phone.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmVerification() {
    if (!pendingPhone) return;
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await fetch("/api/account/phone/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: pendingPhone, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Verification failed.");
        return;
      }
      setVerifiedPhone(data.phone_number);
      setStatus("verified");
      setPendingPhone(null);
      setCode("");
      setPhoneInput("");
      setInfo("Phone verified. You'll get notifications here.");
    } finally {
      setBusy(false);
    }
  }

  function changeNumber() {
    setStatus("idle");
    setInfo(null);
    setError(null);
    setPhoneInput("");
    setCode("");
    setPendingPhone(null);
  }

  return (
    <div className="rounded-xl liquid-glass p-5">
      <h3 className="text-sm font-medium mb-1 flex items-center gap-2 text-[var(--foreground)]">
        <Phone className="w-4 h-4 text-[var(--accent)]" /> Send to my phone
      </h3>
      <p className="text-xs text-[var(--muted)] mb-4">
        Verify your personal phone number so NextNote can text you prospect details, generated website
        URLs, and AI receptionist info — all one click away from any prospect or site.
      </p>

      {status === "loading" && (
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </div>
      )}

      {status === "verified" && verifiedPhone && (
        <div className="flex items-center justify-between px-3 py-3 rounded-lg bg-[var(--background)]">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--foreground)] truncate">
                {formatPhoneDisplay(verifiedPhone)}
              </p>
              <p className="text-xs text-[var(--muted)]">Verified</p>
            </div>
          </div>
          <button
            onClick={changeNumber}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Change
          </button>
        </div>
      )}

      {status === "idle" && (
        <div className="space-y-3">
          <input
            type="tel"
            placeholder="(555) 123-4567"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
          />
          <button
            onClick={startVerification}
            disabled={busy || !phoneInput.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
          >
            {busy ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
            ) : (
              <><Send className="w-4 h-4" /> Send code</>
            )}
          </button>
        </div>
      )}

      {status === "code_sent" && pendingPhone && (
        <div className="space-y-3">
          <div className="px-3 py-3 rounded-lg bg-[var(--background)]">
            <p className="text-xs text-[var(--muted)] mb-1">Code sent to</p>
            <p className="text-sm font-medium text-[var(--foreground)]">
              {formatPhoneDisplay(pendingPhone)}
            </p>
          </div>
          <input
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="w-full px-3 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] tracking-widest text-center focus:outline-none focus:border-[var(--accent)]"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={changeNumber}
              className="px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmVerification}
              disabled={busy || code.length !== 6}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
            >
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</> : "Verify"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
      {info && !error && <p className="text-xs text-emerald-400 mt-3">{info}</p>}
    </div>
  );
}
