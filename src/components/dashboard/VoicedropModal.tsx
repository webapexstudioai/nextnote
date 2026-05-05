"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Phone, Upload, Loader2, CheckCircle, AlertCircle, Coins, Mic, Library, Play, Pause, Trash2 } from "lucide-react";
import type { Prospect } from "@/types";
import InsufficientCreditsModal from "./InsufficientCreditsModal";
import VoicemailRecorder, { SavedRecording } from "./VoicemailRecorder";

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
  const [audioLabel, setAudioLabel] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [audioTab, setAudioTab] = useState<"record" | "library" | "upload">("record");
  const [recordings, setRecordings] = useState<SavedRecording[]>([]);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState(`Drop ${new Date().toLocaleString()}`);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SendResult | null>(null);
  const [creditsPaywall, setCreditsPaywall] = useState<{ required: number; balance: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        // The from-number for a drop is the user's verified personal cell
        // (via Twilio OutgoingCallerIds — what powers a real call-back to
        // their own phone). Grandfathered users with a NextNote agency line
        // can still pick that as a fallback, but personal is the default.
        const [callerIdsRes, agencyRes] = await Promise.all([
          fetch("/api/voicemail/caller-ids").then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch("/api/agency/phone").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);

        const verified: CallerId[] = (callerIdsRes?.caller_ids || []).filter(
          (c: CallerId) => c.verified,
        );

        const agencyPhone = agencyRes?.agency_phone;
        if (agencyPhone?.phone_number) {
          verified.push({
            id: `agency-${agencyPhone.phone_number}`,
            phone_number: agencyPhone.phone_number,
            friendly_name: agencyPhone.label || "NextNote Agency Line",
            verified: true,
          });
        }

        setCallerIds(verified);
        if (verified[0]) setSelectedFrom(verified[0].phone_number);
      } finally {
        setLoadingCallerIds(false);
      }
    })();
  }, []);

  const loadRecordings = useCallback(async () => {
    setLoadingRecordings(true);
    try {
      const res = await fetch("/api/voicemail/recordings");
      if (res.ok) {
        const data = await res.json();
        setRecordings(data.recordings ?? []);
      }
    } finally {
      setLoadingRecordings(false);
    }
  }, []);

  useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);

  function pickRecording(rec: SavedRecording) {
    setAudioUrl(rec.url);
    setAudioLabel(rec.name);
    setAudioFile(null);
    setSelectedRecordingId(rec.id);
  }

  async function deleteRecording(id: string) {
    if (!confirm("Delete this recording? This can't be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/voicemail/recordings/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRecordings((prev) => prev.filter((r) => r.id !== id));
        if (selectedRecordingId === id) {
          setSelectedRecordingId(null);
          setAudioUrl("");
          setAudioLabel("");
        }
      }
    } finally {
      setDeletingId(null);
    }
  }

  function togglePlay(id: string, url: string) {
    const audio = document.getElementById(`rec-audio-${id}`) as HTMLAudioElement | null;
    if (!audio) return;
    if (playingId === id) {
      audio.pause();
      setPlayingId(null);
    } else {
      document.querySelectorAll<HTMLAudioElement>("audio[data-rec]").forEach((a) => a.pause());
      audio.src = url;
      audio.play();
      setPlayingId(id);
    }
  }

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
      fd.append("name", file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Uploaded clip");
      fd.append("source", "uploaded");
      const res = await fetch("/api/voicemail/recordings", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      const rec = data.recording as SavedRecording;
      setRecordings((prev) => [rec, ...prev]);
      setAudioFile(file);
      setAudioUrl(rec.url);
      setAudioLabel(rec.name);
      setSelectedRecordingId(rec.id);
    } finally {
      setUploading(false);
    }
  }

  function handleRecordingSaved(rec: SavedRecording) {
    setRecordings((prev) => [rec, ...prev]);
    pickRecording(rec);
    setAudioTab("library");
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
        if (res.status === 402 && typeof data.required === "number" && typeof data.balance === "number") {
          setCreditsPaywall({ required: data.required, balance: data.balance });
          return;
        }
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

            {/* Voicemail audio picker */}
            <div>
              <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2 block">
                Voicemail audio
              </label>

              <div className="flex gap-1 p-1 rounded-lg bg-black/20 border border-[var(--border)] mb-3">
                {([
                  { id: "record", label: "Record", icon: Mic },
                  { id: "library", label: `Library${recordings.length ? ` (${recordings.length})` : ""}`, icon: Library },
                  { id: "upload", label: "Upload", icon: Upload },
                ] as const).map((tab) => {
                  const Icon = tab.icon;
                  const active = audioTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setAudioTab(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        active
                          ? "bg-[var(--accent)] text-white"
                          : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/5"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {audioTab === "record" && (
                <VoicemailRecorder onSaved={handleRecordingSaved} />
              )}

              {audioTab === "library" && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-2 max-h-64 overflow-y-auto">
                  {loadingRecordings ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-xs text-[var(--muted)]">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Loading your library…
                    </div>
                  ) : recordings.length === 0 ? (
                    <div className="py-6 px-3 text-center">
                      <Library className="w-6 h-6 text-[var(--muted)] mx-auto mb-2 opacity-40" />
                      <div className="text-xs text-[var(--muted)]">No saved recordings yet.</div>
                      <button
                        onClick={() => setAudioTab("record")}
                        className="mt-2 text-[11px] text-[var(--accent)] hover:underline"
                      >
                        Record your first one →
                      </button>
                    </div>
                  ) : (
                    <ul className="space-y-1">
                      {recordings.map((r) => {
                        const isSelected = selectedRecordingId === r.id;
                        const isPlaying = playingId === r.id;
                        return (
                          <li key={r.id}>
                            <div
                              className={`group flex items-center gap-2 rounded-lg px-2 py-2 transition-colors ${
                                isSelected
                                  ? "bg-[var(--accent)]/10 border border-[var(--accent)]/30"
                                  : "border border-transparent hover:bg-white/5"
                              }`}
                            >
                              <button
                                onClick={() => togglePlay(r.id, r.url)}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/30 text-[var(--foreground)] hover:bg-[var(--accent)]/20 transition-colors"
                                aria-label={isPlaying ? "Pause" : "Play"}
                              >
                                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => pickRecording(r)}
                                className="flex-1 min-w-0 text-left"
                              >
                                <div className="text-sm text-[var(--foreground)] truncate flex items-center gap-1.5">
                                  {r.name}
                                  {r.source === "uploaded" && (
                                    <span className="text-[9px] px-1 py-0.5 rounded bg-white/5 text-[var(--muted)] uppercase tracking-wider">upload</span>
                                  )}
                                </div>
                                <div className="text-[10px] text-[var(--muted)] mt-0.5">
                                  {r.durationSeconds ? `${r.durationSeconds}s` : "—"} · {new Date(r.createdAt).toLocaleDateString()}
                                </div>
                              </button>
                              {isSelected && (
                                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                              )}
                              <button
                                onClick={() => deleteRecording(r.id)}
                                disabled={deletingId === r.id}
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-[var(--muted)] hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                                aria-label="Delete"
                              >
                                {deletingId === r.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <audio id={`rec-audio-${r.id}`} data-rec onEnded={() => setPlayingId(null)} className="hidden" />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {audioTab === "upload" && (
                <>
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
                        <span className="text-sm text-[var(--muted)]">Uploading & saving to library…</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 text-[var(--muted)]" />
                        <span className="text-sm text-[var(--muted)]">Click to upload — MP3, WAV, or M4A (max 10MB)</span>
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-[var(--muted)] mt-1.5">
                    Uploads save to your library so you can reuse them on future drops.
                  </p>
                </>
              )}

              {audioUrl && audioLabel && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="text-xs text-[var(--foreground)] truncate flex-1">
                    Using: <span className="font-medium">{audioLabel}</span>
                  </div>
                  <audio src={audioUrl} controls className="h-7" style={{ maxWidth: 140 }} />
                </div>
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

      {creditsPaywall && (
        <InsufficientCreditsModal
          open
          onClose={() => setCreditsPaywall(null)}
          required={creditsPaywall.required}
          balance={creditsPaywall.balance}
          action={`Dropping voicemails to ${selectedList.length} prospect${selectedList.length === 1 ? "" : "s"}`}
        />
      )}
    </div>
  );
}
