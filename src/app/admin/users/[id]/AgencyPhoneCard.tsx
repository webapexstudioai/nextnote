"use client";

import { useEffect, useState, useCallback } from "react";
import { Phone, Search, Loader2, Check, X, AlertCircle, Trash2 } from "lucide-react";

interface AgencyPhone {
  phone_number: string;
  label: string | null;
  twilio_sid: string | null;
  created_at: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
}

interface TwilioNumber {
  phone_number: string;
  friendly_name: string;
  locality?: string;
  region?: string;
}

function formatPhone(e164: string): string {
  // +14155551234 → (415) 555-1234
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return e164;
}

export default function AgencyPhoneCard({
  userId,
  userEmail,
}: {
  userId: string;
  userEmail: string;
}) {
  const [phone, setPhone] = useState<AgencyPhone | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [areaCode, setAreaCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<TwilioNumber[]>([]);
  const [searched, setSearched] = useState(false);

  const [assigning, setAssigning] = useState<string | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/agency-phone`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setPhone(data.agencyPhone);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function search() {
    setSearching(true);
    setError(null);
    setSearched(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/agency-phone/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areaCode: areaCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setResults(data.numbers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function assign(num: TwilioNumber) {
    if (!confirm(`Assign ${formatPhone(num.phone_number)} to ${userEmail}? This buys the number on our Twilio account at no charge to the user.`)) return;
    setAssigning(num.phone_number);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/agency-phone/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: num.phone_number,
          friendlyName: num.friendly_name,
          note: note.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Assign failed");
      setResults([]);
      setSearched(false);
      setAreaCode("");
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setAssigning(null);
    }
  }

  async function release() {
    if (!phone) return;
    if (!confirm(`Release ${formatPhone(phone.phone_number)}? The user will lose SMS + voice forwarding immediately.`)) return;
    setReleasing(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/agency-phone`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Release failed");
      setPhone(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Release failed");
    } finally {
      setReleasing(false);
    }
  }

  return (
    <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-sky-500/10 p-2">
          <Phone className="h-4 w-4 text-sky-300" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold">Agency phone number</h3>
          <p className="mt-1 text-xs text-neutral-400">
            Comp a Twilio number to this user — same as the $5 one-time purchase, but free.
            We pay the ~$1.15/mo carrier fee until you release it.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : phone ? (
        // Has number — show details + release.
        <div className="mt-4 space-y-3">
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-lg text-emerald-200">{formatPhone(phone.phone_number)}</div>
                <div className="mt-1 text-xs text-emerald-300/80">
                  {phone.label ?? "—"}
                </div>
                <div className="mt-2 text-[11px] text-neutral-400">
                  Assigned {new Date(phone.created_at).toLocaleString()}
                  {phone.twilio_sid && (
                    <span className="ml-2 font-mono text-[10px] text-neutral-600">{phone.twilio_sid}</span>
                  )}
                </div>
                {phone.trial_ends_at && (
                  <div className="mt-1 text-[11px] text-amber-300">
                    Trial ends {new Date(phone.trial_ends_at).toLocaleDateString()} —
                    cron will release if unpaid. Comp assignments don&apos;t set this.
                  </div>
                )}
              </div>
              <Check className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            </div>
          </div>
          <button
            onClick={release}
            disabled={releasing}
            className="inline-flex items-center gap-1.5 rounded-md bg-rose-600/20 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-600/30 disabled:opacity-50"
          >
            {releasing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Release number
          </button>
        </div>
      ) : (
        // No number — search + assign flow.
        <div className="mt-4 space-y-4">
          <div className="flex gap-2">
            <input
              value={areaCode}
              onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
              placeholder="Area code (e.g. 415) — optional"
              className="flex-1 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
            />
            <button
              onClick={search}
              disabled={searching}
              className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Search
            </button>
          </div>

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Internal note (optional — saved to audit log)"
            className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs focus:border-neutral-600 focus:outline-none"
          />

          {searched && !searching && results.length === 0 && (
            <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4 text-center text-xs text-neutral-500">
              No numbers found{areaCode ? ` for area code ${areaCode}` : ""}. Try another area code.
            </div>
          )}

          {results.length > 0 && (
            <div className="overflow-hidden rounded-md border border-neutral-800">
              <table className="w-full text-sm">
                <thead className="bg-neutral-900/50 text-[10px] uppercase tracking-wider text-neutral-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Number</th>
                    <th className="px-3 py-2 text-left">Location</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900 bg-neutral-950">
                  {results.map((n) => {
                    const isAssigning = assigning === n.phone_number;
                    return (
                      <tr key={n.phone_number} className="hover:bg-neutral-900/40">
                        <td className="px-3 py-2 font-mono text-neutral-100">
                          {formatPhone(n.phone_number)}
                        </td>
                        <td className="px-3 py-2 text-xs text-neutral-400">
                          {[n.locality, n.region].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => assign(n)}
                            disabled={isAssigning || assigning !== null}
                            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            {isAssigning ? (
                              <><Loader2 className="h-3 w-3 animate-spin" /> Assigning…</>
                            ) : (
                              <><Check className="h-3 w-3" /> Assign free</>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
