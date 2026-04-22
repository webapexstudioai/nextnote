"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Play, Pause, Trash2, Save, Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { encodeWav, downsample } from "@/lib/wav";

const MAX_SECONDS = 45;
const TARGET_SAMPLE_RATE = 16000;

interface Props {
  onSaved: (rec: SavedRecording) => void;
}

export interface SavedRecording {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  durationSeconds: number | null;
  sizeBytes: number;
  source: string;
  createdAt: string;
}

type Phase = "idle" | "recording" | "processing" | "preview";

export default function VoicemailRecorder({ onSaved }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [wavBlob, setWavBlob] = useState<Blob | null>(null);
  const [level, setLevel] = useState(0);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      stopEverything();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopEverything() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (tickRef.current) window.clearInterval(tickRef.current);
    rafRef.current = null;
    tickRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch {}
    }
    recorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }

  async function handleStart() {
    setError("");
    setElapsed(0);
    setLevel(0);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Your browser doesn't support microphone recording. Try Chrome, Firefox, or Safari.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
      mediaStreamRef.current = stream;

      // Live input level meter
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (let i = 0; i < data.length; i++) {
          const v = Math.abs(data[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        setLevel(peak);
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();

      // MediaRecorder for the actual capture — we re-encode to WAV on stop.
      const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
      const mime = mimeCandidates.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) || "";
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = handleStopProcessing;
      recorder.start();
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();

      tickRef.current = window.setInterval(() => {
        const secs = (Date.now() - startedAtRef.current) / 1000;
        setElapsed(secs);
        if (secs >= MAX_SECONDS) handleStop();
      }, 100);

      setPhase("recording");
    } catch (err) {
      console.error("Mic error:", err);
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg.includes("Permission") || msg.includes("denied")
          ? "Microphone permission was denied. Allow it in your browser's site settings and try again."
          : "Couldn't access the microphone. Check your browser's mic permissions."
      );
      stopEverything();
    }
  }

  function handleStop() {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPhase("processing");
    try {
      recorderRef.current?.stop();
    } catch (err) {
      console.error(err);
      setPhase("idle");
    }
  }

  async function handleStopProcessing() {
    try {
      const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/webm" });
      const buf = await blob.arrayBuffer();

      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const decodeCtx = new AC();
      const audioBuffer = await decodeCtx.decodeAudioData(buf.slice(0));
      await decodeCtx.close();

      const channelData = audioBuffer.getChannelData(0);
      const downsampled = downsample(channelData, audioBuffer.sampleRate, TARGET_SAMPLE_RATE);
      const wav = encodeWav(downsampled, TARGET_SAMPLE_RATE);

      const url = URL.createObjectURL(wav);
      setWavBlob(wav);
      setPreviewUrl(url);
      setName((prev) => prev || `Recording ${new Date().toLocaleString()}`);
      setPhase("preview");
    } catch (err) {
      console.error("WAV encode error:", err);
      setError("Couldn't process that recording. Try again — if it keeps failing, use Upload instead.");
      setPhase("idle");
    } finally {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      analyserRef.current = null;
    }
  }

  function handleDiscard() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setWavBlob(null);
    setElapsed(0);
    setError("");
    setName("");
    setIsPlaying(false);
    setPhase("idle");
  }

  async function handleSave() {
    if (!wavBlob) return;
    setSaving(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("audio", new File([wavBlob], `${name || "recording"}.wav`, { type: "audio/wav" }));
      fd.append("name", name.trim() || `Recording ${new Date().toLocaleString()}`);
      fd.append("duration", String(Math.round(elapsed)));
      fd.append("source", "recorded");

      const res = await fetch("/api/voicemail/recordings", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to save");
        return;
      }
      onSaved(json.recording);
      handleDiscard();
    } catch {
      setError("Network error — try saving again.");
    } finally {
      setSaving(false);
    }
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
      {error && (
        <div className="mb-3 flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {phase === "idle" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <button
            onClick={handleStart}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--accent)] text-white shadow-lg hover:scale-105 transition-transform"
            aria-label="Start recording"
          >
            <Mic className="w-6 h-6" />
          </button>
          <div className="text-center">
            <div className="text-sm font-medium text-[var(--foreground)]">Tap to record</div>
            <div className="text-[11px] text-[var(--muted)] mt-0.5">
              Up to {MAX_SECONDS}s · saved as WAV · mono 16kHz
            </div>
          </div>
        </div>
      )}

      {phase === "recording" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <button
            onClick={handleStop}
            className="relative flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg hover:scale-105 transition-transform"
            aria-label="Stop recording"
          >
            <Square className="w-5 h-5 fill-white" />
            <span
              className="absolute inset-0 rounded-full border-2 border-red-400/70"
              style={{ transform: `scale(${1 + level * 0.6})`, transition: "transform 80ms linear" }}
            />
          </button>
          <div className="text-center">
            <div className="font-mono text-2xl tabular-nums text-[var(--foreground)]">
              {formatTime(elapsed)}
            </div>
            <div className="text-[11px] text-red-400 mt-0.5 flex items-center justify-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              Recording — tap stop when done
            </div>
          </div>
          <div className="w-full max-w-xs h-1 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[color:var(--accent)] to-red-400 transition-all"
              style={{ width: `${Math.min(100, level * 180)}%` }}
            />
          </div>
        </div>
      )}

      {phase === "processing" && (
        <div className="flex flex-col items-center gap-2 py-6">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--accent)]" />
          <div className="text-xs text-[var(--muted)]">Encoding to WAV…</div>
        </div>
      )}

      {phase === "preview" && previewUrl && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-black/20 p-2.5">
            <button
              onClick={() => {
                if (!audioElRef.current) return;
                if (audioElRef.current.paused) audioElRef.current.play();
                else audioElRef.current.pause();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--accent)]/15 text-[color:var(--accent)] hover:bg-[color:var(--accent)]/25 transition-colors"
              aria-label="Preview"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-[var(--muted)]">Preview · {formatTime(elapsed)}</div>
              <audio
                ref={audioElRef}
                src={previewUrl}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
            </div>
            <button
              onClick={handleDiscard}
              className="p-1.5 rounded-md text-[var(--muted)] hover:bg-white/5 hover:text-[var(--foreground)] transition-colors"
              aria-label="Discard"
              title="Record again"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="text-[10px] font-medium text-[var(--muted)] uppercase tracking-wider mb-1 block">
              Save as
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cold intro — plumbing"
              maxLength={80}
              className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleDiscard}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--muted)] hover:bg-white/5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[color:var(--accent)] text-white text-xs font-semibold hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-all shadow-md shadow-[color:var(--accent)]/20"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save to library
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
