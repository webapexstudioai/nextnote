"use client";

import { useState, useEffect, useRef } from "react";
import { X, Phone, Upload, Loader2, CheckCircle, AlertCircle, Coins, Mic } from "lucide-react";
import type { Prospect } from "@/types";

interface CallerId {
  id: string;
  phone_number: string;
  friendly_name: string | null;
  verified: boolean;
}

interface SendResult {
  total: number;
  successful: number;
  failed: number;
  credits_spent: number;
  results: Array<{ phone: string; ok: boolean; error?: string; drop_id: string }>;
}

const CREDITS_PER_DROP = 8;

interface Props {
  prospects: Prospect[];
  onClose: () => void;
  onSent: (contactedProspectIds: string[]) => void;
}

export default function VoicedropModal({ prospects, onClose, onSent }: Props) {
  const withPhone = prospects.filter((p) => (p.phone || "").trim());

  const [callerIds, setCallerIds] = useState<CallerId[]>([]);
  const [loadingCallerIds, setLoadingCallerIds] = useState(true);
  const [selectedFrom, setSelectedFrom] = useState<string>("");

  const [selected, setSelected] = useState<Set<string>>(new Set(withPhone.map((p) => p.id)));
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [campaignName, setCampaignName] = useState(`Drop ${new Date().toLocaleString()}`);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SendResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/voicemail/caller-ids");
        if (res.ok) {
          const data = await res.json();
          const verified = (data.caller_ids || []).filter((c: CallerId) => c.verified);
          setCallerIds(verified);
          if (verified[0]) setSelectedFrom(verified[0].phone_number);
        }
      } finally {
        setLoadingCallerIds(false);
      }
    })();
  }, []);

  const selectedList = withPhone.filter((p) => selected.has(p.id));
  const totalCost = selectedList.length * CREDITS_PER_DROP;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === withPhone.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(withPhone.map((p) => p.id)));
    }
  }

  async function handleUpload(file: File) {
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("audio", file);
      const res = await fetch("/api/voicemail/upload-audio", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      setAudioFile(file);
      setAudioUrl(data.url);
    } finally {
      setUploading(false);
    }
  }

  async function handleSend() {
    setError("");
    if (!selectedFrom) return setError("Select a caller ID");
    if (!audioUrl) return setError("Upload an audio file first");
    if (selectedList.length === 0) return setError("Select at least one prospect");

    setSending(true);
    try {
      const res = await fetch("/api/voicemail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_number: selectedFrom,
          audio_url: audioUrl,
          campaign_name: campaignName,
          targets: selectedList.map((p) => ({
            prospect_id: p.id,
            prospect_name: p.name,
            phone: p.phone,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Send failed");
        return;
      }
      setResult(data);
      const successIds = new Set(
        data.results.filter((r: { ok: boolean; drop_id: string }) => r.ok).map((r: { drop_id: string }) => r.drop_id)
      );
      const contactedIds = selectedList
        .filter((_, i) => successIds.has(data.results[i]?.drop_id))
        .map((p) => p.id);
      onSent(contactedIds);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative liquid-glass-strong rounded-2xl p-5 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
            <Mic className="w-5 h-5 text-[var(--accent)]" /> Send Voicemail Drop
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X className="w-4 h-4 text-[var(--muted)]" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {result ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="text-lg font-bold text-[var(--foreground)]">Campaign queued</p>
              <p className="text-sm text-[var(--muted)] mt-1">
                {result.successful} of {result.total} voicedrops initiated
              </p>
              {result.failed > 0 && (
                <p className="text-xs text-amber-400 mt-1">{result.failed} failed to queue</p>
              )}
              <p className="text-xs text-[var(--muted)] mt-2">
                {result.credits_spent} credits spent · Prospects moved to Contacted
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Caller ID */}
            <div>
              <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2 block">
                From (Your Verified Number)
              </label>
              {loadingCallerIds ? (
                <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
                </div>
              ) : callerIds.length === 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  No verified numbers. Go to Settings → Caller ID to verify your phone first.
                </div>
              ) : (
                <select
                  value={selectedFrom}
                  onChange={(e) => setSelectedFrom(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                >
                  {callerIds.map((c) => (
                    <option key={c.id} value={c.phone_number}>
                      {c.phone_number} {c.friendly_name ? `— ${c.friendly_name}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Audio upload */}
            <div>
              <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2 block">
                Voicemail Audio (MP3 or WAV, max 10MB)
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/m4a,audio/x-m4a,audio/mp4"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-[var(--background)] border border-dashed border-[var(--border)] hover:border-[var(--accent)] transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--muted)]" />
                    <span className="text-sm text-[var(--muted)]">Uploading...</span>
                  </>
                ) : audioFile ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-[var(--foreground)] truncate">{audioFile.name}</span>
                    <span className="ml-auto text-[11px] text-[var(--muted)]">Replace</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 text-[var(--muted)]" />
                    <span className="text-sm text-[var(--muted)]">Click to upload audio file</span>
                  </>
                )}
              </button>
              {audioUrl && (
                <audio src={audioUrl} controls className="w-full mt-2 h-10" />
              )}
            </div>

            {/* Campaign name */}
            <div>
              <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2 block">
                Campaign Name
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* Recipients */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">
                  Recipients ({selectedList.length} of {withPhone.length})
                </label>
                <button
                  onClick={toggleAll}
                  className="text-[11px] text-[var(--accent)] hover:underline"
                >
                  {selected.size === withPhone.length ? "Deselect all" : "Select all"}
                </button>
              </div>
              {withPhone.length === 0 ? (
                <p className="text-xs text-[var(--muted)] p-3 rounded-lg bg-[var(--background)]">
                  No prospects with phone numbers in this view.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)] divide-y divide-[var(--border)]">
                  {withPhone.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-white/[0.02] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggle(p.id)}
                        className="w-4 h-4 rounded accent-[var(--accent)]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-[var(--foreground)] truncate">{p.name || "Unnamed"}</p>
                        <p className="text-[11px] text-[var(--muted)] truncate">{p.phone}</p>
                      </div>
                      <span className="text-[10px] text-[var(--muted)] shrink-0">{p.status}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Cost + Send */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/20">
              <div className="flex items-center gap-2 text-sm">
                <Coins className="w-4 h-4 text-[var(--accent)]" />
                <span className="text-[var(--muted)]">Cost:</span>
                <span className="font-bold text-[var(--foreground)]">{totalCost} credits</span>
                <span className="text-[11px] text-[var(--muted)]">
                  ({selectedList.length} × {CREDITS_PER_DROP})
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-[var(--border)] text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={
                  sending ||
                  !audioUrl ||
                  !selectedFrom ||
                  selectedList.length === 0 ||
                  callerIds.length === 0
                }
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
              >
                {sending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                ) : (
                  <><Phone className="w-4 h-4" /> Send {selectedList.length} Drop{selectedList.length === 1 ? "" : "s"}</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
