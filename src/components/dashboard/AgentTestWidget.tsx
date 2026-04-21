"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Loader2, AlertCircle, PhoneOff } from "lucide-react";

interface AgentTestWidgetProps {
  agentId: string;
  agentName?: string;
}

type Status = "idle" | "connecting" | "listening" | "thinking" | "speaking";

export default function AgentTestWidget({ agentId, agentName }: AgentTestWidgetProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const [userTranscript, setUserTranscript] = useState("");
  const [agentTranscript, setAgentTranscript] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const playTimeRef = useRef(0);

  const teardown = useCallback(() => {
    try { processorRef.current?.disconnect(); } catch {}
    try { sourceRef.current?.disconnect(); } catch {}
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    try { micCtxRef.current?.close(); } catch {}
    try { playCtxRef.current?.close(); } catch {}
    try { wsRef.current?.close(); } catch {}
    processorRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    micCtxRef.current = null;
    playCtxRef.current = null;
    wsRef.current = null;
    playTimeRef.current = 0;
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const playPcm = (base64: string) => {
    const ctx = playCtxRef.current;
    if (!ctx) return;
    const binary = atob(base64);
    const len = binary.length / 2;
    const float = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const lo = binary.charCodeAt(i * 2);
      const hi = binary.charCodeAt(i * 2 + 1);
      let sample = lo | (hi << 8);
      if (sample >= 0x8000) sample -= 0x10000;
      float[i] = sample / 0x8000;
    }
    const buf = ctx.createBuffer(1, len, 16000);
    buf.getChannelData(0).set(float);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const now = ctx.currentTime;
    const startAt = Math.max(now, playTimeRef.current);
    src.start(startAt);
    playTimeRef.current = startAt + buf.duration;
    setStatus("speaking");
    src.onended = () => {
      if ((playCtxRef.current?.currentTime ?? 0) >= playTimeRef.current - 0.05) {
        setStatus((s) => (s === "speaking" ? "listening" : s));
      }
    };
  };

  const start = async () => {
    setError("");
    setUserTranscript("");
    setAgentTranscript("");
    setStatus("connecting");
    try {
      const res = await fetch(`/api/agents/elevenlabs/${agentId}/signed-url`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to connect");

      const ws = new WebSocket(data.signed_url);
      wsRef.current = ws;
      playCtxRef.current = new AudioContext({ sampleRate: 16000 });

      ws.onopen = () => {
        try { ws.send(JSON.stringify({ type: "conversation_initiation_client_data" })); } catch {}
      };

      ws.onerror = () => setError("Connection failed.");

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          switch (msg.type) {
            case "audio": {
              const b64 = msg.audio_event?.audio_base_64;
              if (b64) playPcm(b64);
              break;
            }
            case "agent_response":
              setAgentTranscript(msg.agent_response_event?.agent_response || "");
              setStatus("speaking");
              break;
            case "agent_response_correction":
              setAgentTranscript(msg.agent_response_correction_event?.corrected_agent_response || "");
              break;
            case "user_transcript":
              setUserTranscript(msg.user_transcription_event?.user_transcript || "");
              setStatus("thinking");
              break;
            case "interruption":
              playTimeRef.current = playCtxRef.current?.currentTime || 0;
              setStatus("listening");
              break;
            case "ping":
              try { ws.send(JSON.stringify({ type: "pong", event_id: msg.ping_event?.event_id })); } catch {}
              break;
            case "error":
            case "internal_error": {
              const m = msg.error?.message || msg.message || "ElevenLabs returned an error.";
              setError(typeof m === "string" ? m : JSON.stringify(m));
              break;
            }
          }
        } catch {}
      };

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: 16000 });
      micCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        const bytes = new Uint8Array(pcm.buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        try { ws.send(JSON.stringify({ user_audio_chunk: btoa(binary) })); } catch {}
      };
      source.connect(processor);
      processor.connect(ctx.destination);

      setActive(true);
      setStatus("listening");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
      setStatus("idle");
      teardown();
    }
  };

  const stop = () => {
    teardown();
    setActive(false);
    setStatus("idle");
  };

  const label =
    status === "idle" ? "Tap the mic to start" :
    status === "connecting" ? "Connecting..." :
    status === "listening" ? "Listening..." :
    status === "thinking" ? "Thinking..." :
    "Agent speaking...";

  const ringClass =
    status === "speaking" ? "bg-[radial-gradient(circle_at_30%_30%,rgba(34,211,238,0.85),rgba(232,85,61,0.6))] scale-110 animate-pulse shadow-[0_0_120px_rgba(232,85,61,0.45)]" :
    status === "listening" ? "bg-[radial-gradient(circle_at_30%_30%,rgba(52,211,153,0.75),rgba(14,165,233,0.65))] animate-pulse shadow-[0_0_90px_rgba(16,185,129,0.35)]" :
    status === "thinking" ? "bg-[radial-gradient(circle_at_30%_30%,rgba(244,114,182,0.8),rgba(99,102,241,0.75))] animate-pulse shadow-[0_0_90px_rgba(99,102,241,0.3)]" :
    status === "connecting" ? "bg-[radial-gradient(circle_at_30%_30%,rgba(148,163,184,0.5),rgba(71,85,105,0.5))] animate-pulse" :
    "bg-[radial-gradient(circle_at_30%_30%,rgba(232,85,61,0.4),rgba(212,68,41,0.3))]";

  return (
    <div className="flex flex-col items-center py-10 px-6 rounded-[2rem] border border-[var(--border)] bg-[radial-gradient(circle_at_top,rgba(232,85,61,0.08),transparent_60%)]">
      {agentName && <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--muted)] mb-2">{agentName}</p>}
      <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-8">Talk to your agent</h2>

      <div className="relative flex items-center justify-center w-[18rem] h-[18rem] mb-8">
        <div className={`absolute inset-0 rounded-full transition-all duration-500 ${ringClass}`} />
        <div className="absolute inset-[15%] rounded-full border border-white/10 animate-[spin_20s_linear_infinite]" />
        <div className="absolute inset-[25%] rounded-full border border-white/10 animate-[spin_14s_linear_infinite_reverse]" />
        <button
          onClick={active ? stop : start}
          disabled={status === "connecting"}
          className="relative z-10 w-28 h-28 rounded-full bg-[var(--background)] border-2 border-white/20 flex items-center justify-center shadow-2xl hover:scale-105 transition-transform disabled:opacity-60"
          aria-label={active ? "End conversation" : "Start conversation"}
        >
          {status === "connecting" ? <Loader2 className="w-10 h-10 text-[var(--foreground)] animate-spin" /> :
           active ? <PhoneOff className="w-10 h-10 text-red-400" /> :
           <Mic className="w-10 h-10 text-[var(--accent)]" />}
        </button>
      </div>

      <p className="text-sm font-medium text-[var(--foreground)] mb-1">{label}</p>
      <p className="text-xs text-[var(--muted)] mb-6 text-center max-w-sm">
        {active ? "Speak naturally. Tap to end." : "Grant mic access, then have a real-time conversation with your agent."}
      </p>

      {error && (
        <div className="w-full max-w-md rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300 flex items-center gap-2 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {(userTranscript || agentTranscript) && (
        <div className="w-full max-w-2xl grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 min-h-[90px]">
            <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-2">You</p>
            <p className="text-sm text-[var(--foreground)] leading-6">{userTranscript || "—"}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 min-h-[90px]">
            <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-2">Agent</p>
            <p className="text-sm text-[var(--foreground)] leading-6">{agentTranscript || "—"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
