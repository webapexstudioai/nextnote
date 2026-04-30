"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  MessageSquare, Plus, Pencil, Trash2, Save, Loader2, AlertCircle,
  Clock, Zap, PhoneOff, Voicemail, PhoneCall, Hand, Power, PowerOff,
} from "lucide-react";

type SmsTemplate = { id: string; name: string };
type SequenceStep = { id?: string; step_order: number; delay_hours: number; template_id: string };
type SmsSequence = {
  id: string;
  name: string;
  trigger: "no_answer" | "voicemail" | "busy" | null;
  default_from_number: string | null;
  enabled: boolean;
  steps: SequenceStep[];
};
type FromNumber = { phone_number: string; label: string; source: "caller_id" | "purchased" };

function formatDuration(hours: number) {
  if (hours === 0) return "Right away";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  if (rem === 0) return `${days}d`;
  return `${days}d ${rem}h`;
}

function totalSpan(steps: SequenceStep[]) {
  return steps.reduce((sum, s) => sum + (s.delay_hours || 0), 0);
}

const TRIGGERS = [
  { value: "", label: "Manual only", icon: Hand, color: "text-zinc-400 bg-zinc-500/15" },
  { value: "no_answer", label: "No answer", icon: PhoneOff, color: "text-amber-400 bg-amber-500/15" },
  { value: "voicemail", label: "Voicemail", icon: Voicemail, color: "text-blue-400 bg-blue-500/15" },
  { value: "busy", label: "Busy", icon: PhoneCall, color: "text-rose-400 bg-rose-500/15" },
] as const;

function triggerMeta(t: string | null) {
  return TRIGGERS.find((x) => x.value === (t || "")) ?? TRIGGERS[0];
}

export default function SmsSequencesPage() {
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplate[]>([]);
  const [sequences, setSequences] = useState<SmsSequence[]>([]);
  const [sequencesLoading, setSequencesLoading] = useState(false);
  const [sequenceError, setSequenceError] = useState("");
  const [editingSequence, setEditingSequence] = useState<SmsSequence | null>(null);
  const [showSequenceForm, setShowSequenceForm] = useState(false);
  const [seqDraft, setSeqDraft] = useState<{
    name: string;
    trigger: "no_answer" | "voicemail" | "busy" | "";
    default_from_number: string;
    enabled: boolean;
    steps: SequenceStep[];
  }>({ name: "", trigger: "", default_from_number: "", enabled: true, steps: [] });
  const [seqSaving, setSeqSaving] = useState(false);
  const [fromNumbers, setFromNumbers] = useState<FromNumber[]>([]);

  async function loadSmsTemplates() {
    try {
      const res = await fetch("/api/sms/templates");
      const data = await res.json();
      if (res.ok) setSmsTemplates(data.templates || []);
    } catch {}
  }

  async function loadSequences() {
    setSequencesLoading(true);
    setSequenceError("");
    try {
      const res = await fetch("/api/sms/sequences");
      const data = await res.json();
      if (res.ok) setSequences(data.sequences || []);
      else setSequenceError(data.error || "Failed to load sequences");
    } catch {
      setSequenceError("Network error");
    } finally {
      setSequencesLoading(false);
    }
  }

  async function loadFromNumbers() {
    try {
      const res = await fetch("/api/sms/from-numbers");
      const data = await res.json();
      if (res.ok) setFromNumbers(data.numbers || []);
    } catch {}
  }

  useEffect(() => {
    loadSequences();
    loadSmsTemplates();
    loadFromNumbers();
  }, []);

  function startNewSequence() {
    setEditingSequence(null);
    setSeqDraft({
      name: "",
      trigger: "",
      default_from_number: "",
      enabled: true,
      steps: [{ step_order: 0, delay_hours: 0, template_id: "" }],
    });
    setShowSequenceForm(true);
  }

  function startEditSequence(s: SmsSequence) {
    setEditingSequence(s);
    setSeqDraft({
      name: s.name,
      trigger: s.trigger || "",
      default_from_number: s.default_from_number || "",
      enabled: s.enabled,
      steps: s.steps.length > 0 ? s.steps : [{ step_order: 0, delay_hours: 0, template_id: "" }],
    });
    setShowSequenceForm(true);
  }

  function addStep() {
    setSeqDraft((p) => ({
      ...p,
      steps: [...p.steps, { step_order: p.steps.length, delay_hours: 24, template_id: "" }],
    }));
  }

  function removeStep(idx: number) {
    setSeqDraft((p) => ({
      ...p,
      steps: p.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_order: i })),
    }));
  }

  function updateStep(idx: number, patch: Partial<SequenceStep>) {
    setSeqDraft((p) => ({
      ...p,
      steps: p.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  }

  async function saveSequence() {
    if (!seqDraft.name.trim()) {
      setSequenceError("Name required");
      return;
    }
    if (seqDraft.steps.length === 0) {
      setSequenceError("Add at least one step");
      return;
    }
    if (seqDraft.steps.some((s) => !s.template_id)) {
      setSequenceError("Pick a template for every step");
      return;
    }
    setSeqSaving(true);
    setSequenceError("");
    try {
      const payload = {
        name: seqDraft.name.trim(),
        trigger: seqDraft.trigger || null,
        default_from_number: seqDraft.default_from_number || null,
        enabled: seqDraft.enabled,
        steps: seqDraft.steps.map((s, i) => ({
          step_order: i,
          delay_hours: s.delay_hours,
          template_id: s.template_id,
        })),
      };
      const url = editingSequence ? `/api/sms/sequences/${editingSequence.id}` : "/api/sms/sequences";
      const method = editingSequence ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setShowSequenceForm(false);
        setEditingSequence(null);
        loadSequences();
      } else {
        setSequenceError(data.error || "Save failed");
      }
    } catch {
      setSequenceError("Network error");
    } finally {
      setSeqSaving(false);
    }
  }

  async function toggleEnabled(s: SmsSequence) {
    try {
      const res = await fetch(`/api/sms/sequences/${s.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: s.name,
          trigger: s.trigger,
          default_from_number: s.default_from_number,
          enabled: !s.enabled,
          steps: s.steps.map((st, i) => ({
            step_order: i,
            delay_hours: st.delay_hours,
            template_id: st.template_id,
          })),
        }),
      });
      if (res.ok) loadSequences();
    } catch {}
  }

  async function deleteSequence(id: string) {
    if (!confirm("Delete this sequence? Active enrollments will stop.")) return;
    try {
      const res = await fetch(`/api/sms/sequences/${id}`, { method: "DELETE" });
      if (res.ok) loadSequences();
    } catch {}
  }

  const draftSpan = useMemo(() => totalSpan(seqDraft.steps), [seqDraft.steps]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-1 flex items-center gap-2">
            <Zap className="w-5 h-5 text-[var(--accent)]" /> SMS Sequences
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Multi-step follow-ups that fire on missed calls or run manually. A reply or STOP halts the sequence.
          </p>
        </div>
        {!showSequenceForm && (
          <button
            onClick={startNewSequence}
            className="px-3.5 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors inline-flex items-center gap-1.5 shrink-0 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> New Sequence
          </button>
        )}
      </div>

      {sequenceError && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5" /> {sequenceError}
        </div>
      )}

      {showSequenceForm && (
        <div className="rounded-xl liquid-glass p-5 mb-4 space-y-5">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-1.5 block">Name</label>
              <input
                type="text"
                value={seqDraft.name}
                onChange={(e) => setSeqDraft((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. No-answer 3-step"
                className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-1.5 block">Default From Number</label>
              <select
                value={seqDraft.default_from_number}
                onChange={(e) => setSeqDraft((p) => ({ ...p, default_from_number: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
              >
                <option value="">— Auto-pick (latest purchased) —</option>
                {fromNumbers.map((n) => (
                  <option key={n.phone_number} value={n.phone_number}>
                    {n.label} {n.source === "caller_id" ? "(verified)" : "(purchased)"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-2 block">Auto-fire on</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TRIGGERS.map((t) => {
                const Icon = t.icon;
                const isActive = seqDraft.trigger === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setSeqDraft((p) => ({ ...p, trigger: t.value as typeof p.trigger }))}
                    className={`px-3 py-2.5 rounded-lg border text-xs font-medium transition-all flex items-center gap-2 ${
                      isActive
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]"
                        : "border-[var(--border)] bg-[var(--background)] text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-[var(--foreground)]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] uppercase tracking-wider text-[var(--muted)]">
                Steps
                {seqDraft.steps.length > 0 && (
                  <span className="ml-2 text-[var(--foreground)] normal-case tracking-normal">
                    · spans {formatDuration(draftSpan)}
                  </span>
                )}
              </label>
              <button
                type="button"
                onClick={addStep}
                className="text-[10px] text-[var(--accent)] hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add step
              </button>
            </div>
            {smsTemplates.length === 0 && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[11px] text-amber-400 mb-2">
                You don&apos;t have any templates yet. Create one in <Link href="/dashboard/sms-templates" className="underline">SMS Templates</Link> first.
              </div>
            )}
            <div className="space-y-2">
              {seqDraft.steps.map((step, idx) => (
                <div key={idx} className="flex items-stretch gap-3">
                  <div className="flex flex-col items-center pt-3">
                    <div className="w-7 h-7 rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] text-xs font-semibold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    {idx < seqDraft.steps.length - 1 && <div className="flex-1 w-px bg-[var(--border)] my-1" />}
                  </div>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-[140px_1fr_auto] items-end gap-2 p-3 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1 block flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {idx === 0 ? "After trigger" : "After step " + idx}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          value={step.delay_hours}
                          onChange={(e) => updateStep(idx, { delay_hours: Math.max(0, parseInt(e.target.value || "0", 10)) })}
                          className="w-full pl-2 pr-9 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs focus:outline-none focus:border-[var(--accent)] transition-colors"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--muted)]">hrs</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1 block">Template</label>
                      <select
                        value={step.template_id}
                        onChange={(e) => updateStep(idx, { template_id: e.target.value })}
                        className="w-full px-2 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs focus:outline-none focus:border-[var(--accent)] transition-colors"
                      >
                        <option value="">— Pick template —</option>
                        {smsTemplates.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeStep(idx)}
                      disabled={seqDraft.steps.length === 1}
                      className="p-1.5 rounded-lg text-[var(--muted)] hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors self-end"
                      title="Remove step"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={seqDraft.enabled}
                onChange={(e) => setSeqDraft((p) => ({ ...p, enabled: e.target.checked }))}
                className="accent-[var(--accent)]"
              />
              {seqDraft.enabled ? <Power className="w-3.5 h-3.5 text-emerald-400" /> : <PowerOff className="w-3.5 h-3.5 text-zinc-400" />}
              {seqDraft.enabled ? "Enabled" : "Disabled"}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowSequenceForm(false); setEditingSequence(null); setSequenceError(""); }}
                className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs hover:bg-[var(--card-hover)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveSequence}
                disabled={seqSaving}
                className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
              >
                {seqSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {editingSequence ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {sequencesLoading ? (
        <div className="flex items-center gap-2 text-xs text-[var(--muted)] py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading sequences…
        </div>
      ) : sequences.length === 0 && !showSequenceForm ? (
        <div className="rounded-xl liquid-glass p-10 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center">
            <Zap className="w-6 h-6 text-[var(--accent)]" />
          </div>
          <p className="text-sm font-medium text-[var(--foreground)] mb-1">No sequences yet</p>
          <p className="text-xs text-[var(--muted)] mb-4 max-w-sm mx-auto">
            Stop letting no-answers go cold. Build a 2-3 step nudge that fires automatically — most replies come on the second touch.
          </p>
          <button
            onClick={startNewSequence}
            className="px-3.5 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Build your first sequence
          </button>
        </div>
      ) : sequences.length > 0 && (
        <div className="space-y-3">
          {sequences.map((s) => {
            const span = totalSpan(s.steps);
            const trig = triggerMeta(s.trigger);
            const TrigIcon = trig.icon;
            return (
              <div
                key={s.id}
                className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:border-[var(--accent)]/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{s.name}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${trig.color}`}>
                        <TrigIcon className="w-2.5 h-2.5" /> {trig.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[var(--muted)]">
                      <span className="inline-flex items-center gap-1">
                        <Zap className="w-3 h-3" /> {s.steps.length} step{s.steps.length === 1 ? "" : "s"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> spans {formatDuration(span)}
                      </span>
                      {s.default_from_number && (
                        <span className="inline-flex items-center gap-1 font-mono">
                          {s.default_from_number}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleEnabled(s)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-medium inline-flex items-center gap-1 transition-colors ${
                        s.enabled
                          ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                          : "bg-zinc-500/15 text-zinc-400 hover:bg-zinc-500/25"
                      }`}
                      title={s.enabled ? "Click to disable" : "Click to enable"}
                    >
                      {s.enabled ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                      {s.enabled ? "On" : "Off"}
                    </button>
                    <button
                      onClick={() => startEditSequence(s)}
                      className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-hover)] transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteSequence(s.id)}
                      className="p-1.5 rounded-lg text-[var(--muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="rounded-lg bg-[var(--background)] border border-[var(--border)] p-3">
                  <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
                    {s.steps.map((st, idx) => {
                      const tpl = smsTemplates.find((t) => t.id === st.template_id);
                      return (
                        <div key={st.id || st.step_order} className="flex items-stretch gap-2 shrink-0">
                          {idx > 0 && (
                            <div className="flex flex-col items-center justify-center text-[9px] text-[var(--muted)] px-1">
                              <span>+{formatDuration(st.delay_hours)}</span>
                              <div className="w-6 h-px bg-[var(--border)] mt-1" />
                            </div>
                          )}
                          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 min-w-[140px] max-w-[200px]">
                            <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-[var(--muted)] mb-1">
                              <span className="w-4 h-4 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center font-semibold text-[9px]">{idx + 1}</span>
                              <span>{idx === 0 && st.delay_hours === 0 ? "Immediately" : "After " + formatDuration(st.delay_hours)}</span>
                            </div>
                            <p className="text-xs text-[var(--foreground)] truncate">
                              {tpl?.name || <span className="text-rose-400">(template missing)</span>}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
