"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, AlertCircle, CheckCircle2, MapPin } from "lucide-react";

const inputClass =
  "w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors";
const labelClass = "text-[11px] uppercase tracking-wider text-[var(--muted)] mb-1.5 block";

interface Props {
  initial?: Partial<FormState> | null;
  onSaved: () => void;
}

interface FormState {
  legal_name: string;
  ein: string;
  business_type: string;
  website: string;
  address_line1: string;
  address_line2: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  rep_name: string;
  rep_email: string;
  rep_title: string;
  rep_phone: string;
  use_case: string;
  tcpa_attested: boolean;
}

const empty: FormState = {
  legal_name: "",
  ein: "",
  business_type: "llc",
  website: "",
  address_line1: "",
  address_line2: "",
  city: "",
  region: "",
  postal_code: "",
  country: "US",
  rep_name: "",
  rep_email: "",
  rep_title: "",
  rep_phone: "",
  use_case: "",
  tcpa_attested: false,
};

type ZipStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; city: string; state: string }
  | { kind: "unknown" }
  | { kind: "error" };

export default function BusinessProfileForm({ initial, onSaved }: Props) {
  const [form, setForm] = useState<FormState>({ ...empty, ...(initial || {}) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [zipStatus, setZipStatus] = useState<ZipStatus>({ kind: "idle" });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // ZIP -> city/state autofill via Zippopotam (free, no key, USPS-backed).
  useEffect(() => {
    const zip = form.postal_code.trim();
    if (form.country !== "US" || !/^\d{5}$/.test(zip)) {
      setZipStatus({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setZipStatus({ kind: "loading" });
    fetch(`https://api.zippopotam.us/us/${zip}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const place = data?.places?.[0];
        if (!place) {
          setZipStatus({ kind: "unknown" });
          return;
        }
        const city = place["place name"] as string;
        const state = place["state abbreviation"] as string;
        setZipStatus({ kind: "ok", city, state });
        setForm((f) => ({
          ...f,
          city: f.city.trim() ? f.city : city,
          region: f.region.trim() ? f.region : state,
        }));
      })
      .catch(() => {
        if (!cancelled) setZipStatus({ kind: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [form.postal_code, form.country]);

  const cityMismatch =
    zipStatus.kind === "ok" &&
    form.city.trim().length > 0 &&
    form.city.trim().toLowerCase() !== zipStatus.city.toLowerCase();
  const stateMismatch =
    zipStatus.kind === "ok" &&
    form.region.trim().length > 0 &&
    form.region.trim().toUpperCase() !== zipStatus.state.toUpperCase();

  async function submit() {
    setError("");
    if (!form.tcpa_attested) {
      setError("Please confirm the sender attestation at the bottom.");
      return;
    }
    if (form.country === "US") {
      if (!form.address_line1.trim() || !form.city.trim() || !form.region.trim() || !form.postal_code.trim()) {
        setError("Please fill out the full address (street, city, state, ZIP).");
        return;
      }
      if (zipStatus.kind === "unknown") {
        setError("That ZIP code wasn't found. Please double-check it.");
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch("/api/business-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save");
        return;
      }
      onSaved();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent)]/5 to-transparent p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)] mb-0.5">
              Quick business verification
            </p>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Carriers require this before we can issue you a phone number for SMS or calling. It&apos;s a one-time form — takes about 90 seconds.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <Section title="Business">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Legal business name</label>
            <input
              className={inputClass}
              value={form.legal_name}
              onChange={(e) => set("legal_name", e.target.value)}
              placeholder="Acme Marketing LLC"
            />
          </div>
          <div>
            <label className={labelClass}>EIN (or leave blank if sole prop)</label>
            <input
              className={inputClass}
              value={form.ein}
              onChange={(e) => set("ein", e.target.value)}
              placeholder="12-3456789"
            />
          </div>
          <div>
            <label className={labelClass}>Business type</label>
            <select
              className={inputClass}
              value={form.business_type}
              onChange={(e) => set("business_type", e.target.value)}
            >
              <option value="llc">LLC</option>
              <option value="corp">Corporation</option>
              <option value="sole_prop">Sole proprietorship</option>
              <option value="nonprofit">Non-profit</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Website</label>
            <input
              className={inputClass}
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://acme.com"
            />
          </div>
        </div>
      </Section>

      <Section title="Address">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className={labelClass}>Street address</label>
            <input
              className={inputClass}
              value={form.address_line1}
              onChange={(e) => set("address_line1", e.target.value)}
              placeholder="123 Main St"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Suite / Apt (optional)</label>
            <input
              className={inputClass}
              value={form.address_line2}
              onChange={(e) => set("address_line2", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>ZIP</label>
            <div className="relative">
              <input
                className={inputClass}
                value={form.postal_code}
                onChange={(e) => set("postal_code", e.target.value.replace(/\D/g, "").slice(0, 5))}
                placeholder="94103"
                inputMode="numeric"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                {zipStatus.kind === "loading" && <Loader2 className="w-4 h-4 animate-spin text-[var(--muted)]" />}
                {zipStatus.kind === "ok" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {zipStatus.kind === "unknown" && <AlertCircle className="w-4 h-4 text-amber-400" />}
              </div>
            </div>
            {zipStatus.kind === "ok" && (
              <p className="mt-1.5 text-[11px] text-emerald-400 inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Verified: {zipStatus.city}, {zipStatus.state}
              </p>
            )}
            {zipStatus.kind === "unknown" && (
              <p className="mt-1.5 text-[11px] text-amber-400">ZIP not found. Double-check it.</p>
            )}
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input
              className={inputClass}
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>State</label>
            <input
              className={inputClass}
              value={form.region}
              onChange={(e) => set("region", e.target.value.toUpperCase().slice(0, 2))}
              placeholder="CA"
              maxLength={2}
            />
          </div>
          {(cityMismatch || stateMismatch) && zipStatus.kind === "ok" && (
            <div className="sm:col-span-2 flex items-start justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  ZIP {form.postal_code} is in <strong>{zipStatus.city}, {zipStatus.state}</strong>. Your entry says <strong>{form.city || "—"}, {form.region || "—"}</strong>.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (zipStatus.kind === "ok") {
                    set("city", zipStatus.city);
                    set("region", zipStatus.state);
                  }
                }}
                className="shrink-0 px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-medium whitespace-nowrap"
              >
                Use suggestion
              </button>
            </div>
          )}
        </div>
      </Section>

      <Section title="Authorized contact">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Full name</label>
            <input
              className={inputClass}
              value={form.rep_name}
              onChange={(e) => set("rep_name", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Title (optional)</label>
            <input
              className={inputClass}
              value={form.rep_title}
              onChange={(e) => set("rep_title", e.target.value)}
              placeholder="Owner / Founder"
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              className={inputClass}
              value={form.rep_email}
              onChange={(e) => set("rep_email", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Phone (optional)</label>
            <input
              type="tel"
              className={inputClass}
              value={form.rep_phone}
              onChange={(e) => set("rep_phone", e.target.value)}
            />
          </div>
        </div>
      </Section>

      <Section title="What you'll use this number for">
        <textarea
          className={`${inputClass} min-h-[88px] resize-y`}
          value={form.use_case}
          onChange={(e) => set("use_case", e.target.value)}
          placeholder="e.g. Cold outreach to small business owners I've sourced from public listings, plus follow-ups with clients I've already spoken to."
        />
        <p className="text-[11px] text-[var(--muted)] mt-2 leading-relaxed">
          Be specific — carriers review this. Vague answers (&quot;marketing&quot;) get flagged.
        </p>
      </Section>

      <Section title="Sender attestation">
        <label className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--background)] cursor-pointer hover:border-[var(--accent)]/30 transition-colors">
          <input
            type="checkbox"
            checked={form.tcpa_attested}
            onChange={(e) => set("tcpa_attested", e.target.checked)}
            className="mt-0.5 accent-[var(--accent)]"
          />
          <span className="text-xs text-[var(--muted)] leading-relaxed">
            I confirm that <span className="text-[var(--foreground)] font-medium">I am the sender</span> for all calls and texts placed from this number, that I will obtain proper consent under TCPA and applicable state laws before contacting consumers, that I will honor opt-out requests (STOP / unsubscribe), and that I will not use this number for SHAFT-restricted content (sex, hate, alcohol, firearms, tobacco) or any unlawful purpose. I agree to indemnify NextNote against claims arising from my use.
          </span>
        </label>
      </Section>

      <button
        onClick={submit}
        disabled={saving}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Saving…
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4" /> Submit & continue
          </>
        )}
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[var(--foreground)] mb-2.5">{title}</p>
      {children}
    </div>
  );
}
