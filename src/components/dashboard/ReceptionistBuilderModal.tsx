"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Loader2, Wand2, X } from "lucide-react";
import InsufficientCreditsModal from "@/components/dashboard/InsufficientCreditsModal";

export interface ReceptionistBuilderInitial {
  businessName?: string;
  niche?: string;
  services?: string;
  notes?: string;
  mapsDescription?: string;
  reviews?: string;
  gender?: "female" | "male" | "auto";
  contactName?: string;
}

interface ReceptionistDraft {
  agentName: string;
  firstMessage: string;
  tone: string;
  systemPrompt: string;
  fullPrompt?: string;
  knowledge: string;
  bookingFlow: string[];
  faqExamples: string[];
  extractedBusinessProfile?: {
    summary?: string;
    reviewInsights?: string[];
  };
}

interface Props {
  initial: ReceptionistBuilderInitial;
  onClose: () => void;
  onCreated?: (agent: { agentId: string; agentName: string }) => void;
  navigateAfterCreate?: boolean;
}

export default function ReceptionistBuilderModal({
  initial,
  onClose,
  onCreated,
  navigateAfterCreate = true,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    businessName: initial.businessName || "",
    niche: initial.niche || "",
    services: initial.services || "",
    notes: initial.notes || "",
    mapsDescription: initial.mapsDescription || "",
    reviews: initial.reviews || "",
    gender: (initial.gender || "auto") as "female" | "male" | "auto",
  });
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState("");
  const [paywall, setPaywall] = useState<{ required: number; balance: number } | null>(null);
  const [draft, setDraft] = useState<ReceptionistDraft | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdAgent, setCreatedAgent] = useState<{ agentId: string; agentName: string } | null>(null);
  const [createError, setCreateError] = useState("");

  async function handleBuild() {
    setBuilding(true);
    setError("");
    try {
      const res = await fetch("/api/agents/build-receptionist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402 && typeof data.required === "number" && typeof data.balance === "number") {
          setPaywall({ required: data.required, balance: data.balance });
          return;
        }
        throw new Error(data.error || "Failed to build receptionist");
      }
      setDraft(data.draft || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build receptionist");
    } finally {
      setBuilding(false);
    }
  }

  async function handleCreate() {
    if (!draft) return;
    setCreating(true);
    setCreateError("");
    setCreatedAgent(null);
    try {
      const res = await fetch("/api/agents/elevenlabs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentName: draft.agentName,
          firstMessage: draft.firstMessage,
          systemPrompt: draft.fullPrompt || draft.systemPrompt,
          businessName: form.businessName || initial.businessName || "",
          contactName: initial.contactName || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create agent");
      const made = { agentId: data.agentId, agentName: data.agentName };
      setCreatedAgent(made);
      onCreated?.(made);
      if (navigateAfterCreate) {
        setTimeout(() => router.push("/dashboard/agents"), 1800);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)] animate-[fadeInUp_0.35s_ease-out] space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2"><Bot className="w-5 h-5 text-[var(--accent)]" /> Build Receptionist</h3>
              <p className="text-sm text-[var(--muted)] mt-1">Generate a draft AI receptionist from this prospect&apos;s business details.</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--card-hover)] transition-colors"><X className="w-4 h-4" /></button>
          </div>

          {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}

          <div className="grid md:grid-cols-2 gap-4">
            <input value={form.businessName} onChange={(e) => setForm((p) => ({ ...p, businessName: e.target.value }))} placeholder="Business Name" className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm" />
            <input value={form.niche} onChange={(e) => setForm((p) => ({ ...p, niche: e.target.value }))} placeholder="Niche" className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm" />
            <div className="md:col-span-2">
              <p className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-2">Receptionist Gender</p>
              <div className="grid grid-cols-3 gap-2">
                {(["female", "male", "auto"] as const).map((g) => {
                  const active = form.gender === g;
                  const label = g === "auto" ? "Auto (pick by niche)" : g === "female" ? "Female" : "Male";
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, gender: g }))}
                      className={`px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                        active
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]"
                          : "border-[var(--border)] hover:bg-[var(--card-hover)] text-[var(--muted)]"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <input value={form.services} onChange={(e) => setForm((p) => ({ ...p, services: e.target.value }))} placeholder="Services" className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm md:col-span-2" />
            <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Business notes" rows={4} className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm resize-none md:col-span-2" />
            <textarea value={form.mapsDescription} onChange={(e) => setForm((p) => ({ ...p, mapsDescription: e.target.value }))} placeholder="Google Maps description (optional)" rows={4} className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm resize-none" />
            <textarea value={form.reviews} onChange={(e) => setForm((p) => ({ ...p, reviews: e.target.value }))} placeholder="Google review snippets (optional)" rows={4} className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm resize-none" />
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-3 rounded-xl border border-[var(--border)] text-sm hover:bg-[var(--card-hover)] transition-colors">Close</button>
            <button onClick={handleBuild} disabled={building} className="px-4 py-3 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors inline-flex items-center gap-2 disabled:opacity-50">
              {building ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Generate Draft
            </button>
          </div>

          {draft && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[var(--muted)]">Generated Receptionist</p>
                  <p className="text-lg font-semibold mt-1">{draft.agentName}</p>
                </div>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                  {creating ? "Creating..." : "Make AI Receptionist"}
                </button>
              </div>

              {createError && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{createError}</div>
              )}
              {createdAgent && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 space-y-1">
                  <p className="text-sm font-semibold text-emerald-400 flex items-center gap-2"><Bot className="w-4 h-4" /> AI Receptionist Created!</p>
                  <p className="text-xs text-emerald-300">{createdAgent.agentName}</p>
                  <p className="text-[10px] font-mono text-emerald-400/60">ID: {createdAgent.agentId}</p>
                </div>
              )}
              <div className="rounded-2xl border border-[rgba(232,85,61,0.18)] bg-[linear-gradient(180deg,rgba(232,85,61,0.08),rgba(255,255,255,0.02))] p-5">
                <pre className="whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)] font-sans">{draft.fullPrompt || draft.systemPrompt}</pre>
              </div>

              {draft.extractedBusinessProfile && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-4 space-y-2">
                  <p className="text-[11px] uppercase tracking-wider text-[var(--muted)]">Extracted Business Profile</p>
                  <p className="text-sm">{draft.extractedBusinessProfile.summary}</p>
                  <ul className="space-y-1 text-sm text-[var(--muted)] list-disc pl-5">
                    {(draft.extractedBusinessProfile.reviewInsights || []).map((insight, idx) => (
                      <li key={idx}>{insight}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {paywall && (
        <InsufficientCreditsModal
          open
          onClose={() => setPaywall(null)}
          required={paywall.required}
          balance={paywall.balance}
          action="Drafting an AI receptionist"
        />
      )}
    </>
  );
}
