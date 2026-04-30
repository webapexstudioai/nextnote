"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MessageSquare, Plus, Pencil, Trash2, Save, Loader2, AlertCircle,
  Copy, Check, Sparkles, Hash,
} from "lucide-react";

type SmsTemplate = { id: string; name: string; body: string; created_at?: string; updated_at?: string };

const SAMPLE_VARS: Record<string, string> = {
  first_name: "Alex",
  name: "Alex Rivera",
  business: "Bay Auto Detail",
  my_name: "You",
  my_agency: "Your Agency",
};

function fillPlaceholders(body: string) {
  return body.replace(/\{(\w+)\}/g, (_, key) => SAMPLE_VARS[key] ?? `{${key}}`);
}

function smsSegmentCount(text: string) {
  const len = text.length;
  if (len === 0) return 0;
  if (len <= 160) return 1;
  return Math.ceil(len / 153);
}

const PLACEHOLDERS = ["first_name", "name", "business", "my_name", "my_agency"] as const;

export default function SmsTemplatesPage() {
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplate[]>([]);
  const [smsTemplatesLoading, setSmsTemplatesLoading] = useState(false);
  const [smsTemplateError, setSmsTemplateError] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [tplDraft, setTplDraft] = useState<{ name: string; body: string }>({ name: "", body: "" });
  const [tplSaving, setTplSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function loadSmsTemplates() {
    setSmsTemplatesLoading(true);
    setSmsTemplateError("");
    try {
      const res = await fetch("/api/sms/templates");
      const data = await res.json();
      if (res.ok) setSmsTemplates(data.templates || []);
      else setSmsTemplateError(data.error || "Failed to load templates");
    } catch {
      setSmsTemplateError("Network error");
    } finally {
      setSmsTemplatesLoading(false);
    }
  }

  useEffect(() => {
    loadSmsTemplates();
  }, []);

  function startNewTemplate() {
    setEditingTemplate(null);
    setTplDraft({ name: "", body: "" });
    setShowTemplateForm(true);
  }

  function startEditTemplate(t: SmsTemplate) {
    setEditingTemplate(t);
    setTplDraft({ name: t.name, body: t.body });
    setShowTemplateForm(true);
  }

  async function saveTemplate() {
    if (!tplDraft.name.trim() || !tplDraft.body.trim()) {
      setSmsTemplateError("Name and body are required");
      return;
    }
    setTplSaving(true);
    setSmsTemplateError("");
    try {
      const url = editingTemplate ? `/api/sms/templates/${editingTemplate.id}` : "/api/sms/templates";
      const method = editingTemplate ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tplDraft.name.trim(), body: tplDraft.body.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowTemplateForm(false);
        setEditingTemplate(null);
        loadSmsTemplates();
      } else {
        setSmsTemplateError(data.error || "Save failed");
      }
    } catch {
      setSmsTemplateError("Network error");
    } finally {
      setTplSaving(false);
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    try {
      const res = await fetch(`/api/sms/templates/${id}`, { method: "DELETE" });
      if (res.ok) loadSmsTemplates();
    } catch {}
  }

  function insertPlaceholder(ph: string) {
    setTplDraft((p) => ({ ...p, body: `${p.body}{${ph}}` }));
  }

  async function copyToClipboard(t: SmsTemplate) {
    try {
      await navigator.clipboard.writeText(t.body);
      setCopiedId(t.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {}
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return smsTemplates;
    const q = search.trim().toLowerCase();
    return smsTemplates.filter((t) => t.name.toLowerCase().includes(q) || t.body.toLowerCase().includes(q));
  }, [smsTemplates, search]);

  const draftLength = tplDraft.body.length;
  const draftSegments = smsSegmentCount(tplDraft.body);
  const draftPreview = fillPlaceholders(tplDraft.body || "Hey {first_name}, this is {my_name} from {my_agency}…");
  const segmentColor =
    draftSegments <= 1 ? "text-emerald-400" :
    draftSegments <= 2 ? "text-amber-400" :
    "text-rose-400";

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-1 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[var(--accent)]" /> SMS Templates
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Reusable message bodies for follow-ups. Drop in placeholders to personalize per prospect.
          </p>
        </div>
        {!showTemplateForm && (
          <button
            onClick={startNewTemplate}
            className="px-3.5 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors inline-flex items-center gap-1.5 shrink-0 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> New Template
          </button>
        )}
      </div>

      {smsTemplateError && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5" /> {smsTemplateError}
        </div>
      )}

      {showTemplateForm && (
        <div className="rounded-xl liquid-glass p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
            </div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              {editingTemplate ? "Edit template" : "New template"}
            </p>
          </div>

          <div className="grid md:grid-cols-[1fr_280px] gap-5">
            <div className="space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-1.5 block">Name</label>
                <input
                  type="text"
                  value={tplDraft.name}
                  onChange={(e) => setTplDraft((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. No-answer follow-up"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-[var(--muted)]">Message Body</label>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--muted)]">
                    <span>{draftLength} chars</span>
                    <span className="text-[var(--border)]">·</span>
                    <span className={segmentColor}>
                      {draftSegments} segment{draftSegments === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <textarea
                  value={tplDraft.body}
                  onChange={(e) => setTplDraft((p) => ({ ...p, body: e.target.value }))}
                  rows={6}
                  placeholder="Hey {first_name}, this is {my_name} from {my_agency} — sorry I missed you!"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] resize-none font-mono leading-relaxed transition-colors"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[10px] text-[var(--muted)] mr-1 self-center">Insert:</span>
                  {PLACEHOLDERS.map((ph) => (
                    <button
                      key={ph}
                      type="button"
                      onClick={() => insertPlaceholder(ph)}
                      className="px-2 py-0.5 rounded-md border border-[var(--border)] text-[10px] text-[var(--muted)] hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] hover:border-[var(--accent)]/30 font-mono transition-colors"
                    >
                      {`{${ph}}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-wider text-[var(--muted)] block">Live preview</label>
              <div className="rounded-2xl bg-[var(--background)] border border-[var(--border)] p-3">
                <div className="text-[10px] text-[var(--muted)] mb-1.5 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Preview to {SAMPLE_VARS.first_name}
                </div>
                <div className="rounded-2xl rounded-bl-sm bg-emerald-500/15 border border-emerald-500/20 px-3 py-2 text-xs text-[var(--foreground)] whitespace-pre-wrap break-words">
                  {draftPreview}
                </div>
              </div>
              <p className="text-[10px] text-[var(--muted)] leading-snug">
                Sample placeholders are filled in for preview only. Real messages use each prospect&apos;s data.
              </p>
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-5">
            <button
              onClick={() => { setShowTemplateForm(false); setEditingTemplate(null); setSmsTemplateError(""); }}
              className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs hover:bg-[var(--card-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveTemplate}
              disabled={tplSaving}
              className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
            >
              {tplSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {editingTemplate ? "Update" : "Create"}
            </button>
          </div>
        </div>
      )}

      {smsTemplates.length > 0 && !showTemplateForm && (
        <div className="mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${smsTemplates.length} template${smsTemplates.length === 1 ? "" : "s"}…`}
            className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>
      )}

      {smsTemplatesLoading ? (
        <div className="flex items-center gap-2 text-xs text-[var(--muted)] py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading templates…
        </div>
      ) : smsTemplates.length === 0 ? (
        <div className="rounded-xl liquid-glass p-10 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-[var(--accent)]" />
          </div>
          <p className="text-sm font-medium text-[var(--foreground)] mb-1">No templates yet</p>
          <p className="text-xs text-[var(--muted)] mb-4 max-w-xs mx-auto">
            Save your best follow-up messages once. Then fire them off in seconds — or chain them into automated sequences.
          </p>
          <button
            onClick={startNewTemplate}
            className="px-3.5 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Create your first template
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center text-xs text-[var(--muted)]">
          No templates match &ldquo;{search}&rdquo;
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((t) => {
            const segs = smsSegmentCount(t.body);
            const segColor =
              segs <= 1 ? "text-emerald-400" :
              segs <= 2 ? "text-amber-400" :
              "text-rose-400";
            return (
              <div
                key={t.id}
                className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:border-[var(--accent)]/30 hover:bg-[var(--card-hover)] transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--foreground)] truncate">{t.name}</p>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-[var(--muted)]">
                      <Hash className="w-2.5 h-2.5" />
                      <span>{t.body.length} chars</span>
                      <span className="text-[var(--border)]">·</span>
                      <span className={segColor}>{segs} seg</span>
                    </div>
                  </div>
                  <div className="flex gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => copyToClipboard(t)}
                      className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-hover)] transition-colors"
                      title="Copy body"
                    >
                      {copiedId === t.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => startEditTemplate(t)}
                      className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-hover)] transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteTemplate(t.id)}
                      className="p-1.5 rounded-lg text-[var(--muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[var(--muted)] whitespace-pre-wrap break-words leading-relaxed line-clamp-4">{t.body}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
