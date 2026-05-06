"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Bot, Save, Loader2, AlertCircle, CheckCircle2,
  Brain, Mic, Globe, Settings2, Maximize2, Minimize2,
  ChevronDown, ChevronUp, Trash2, Wrench, PhoneForwarded, Calendar, Plug,
  Building2, Upload,
} from "lucide-react";
import { parseTools, type ToolConfig } from "@/lib/tools";

interface ElevenVoice {
  voice_id: string;
  name: string;
  category?: string;
}

interface AgentDetail {
  agent_id: string;
  name: string;
  conversation_config?: {
    agent?: {
      prompt?: { prompt?: string; llm?: string };
      first_message?: string;
      language?: string;
    };
    tts?: {
      voice_id?: string;
      stability?: number;
      speed?: number;
      similarity_boost?: number;
    };
    turn?: {
      turn_timeout?: number;
      silence_end_call_timeout?: number;
    };
    conversation?: {
      max_duration_seconds?: number;
    };
  };
}

type Panel = "prompt" | "voice" | "branding" | "tools" | "behavior" | "advanced";

const PANELS: { id: Panel; label: string; icon: React.ElementType }[] = [
  { id: "prompt", label: "Prompt & Identity", icon: Brain },
  { id: "voice", label: "Voice & Speech", icon: Mic },
  { id: "branding", label: "Business Identity", icon: Building2 },
  { id: "tools", label: "Tools & Actions", icon: Wrench },
  { id: "behavior", label: "Behavior", icon: Settings2 },
  { id: "advanced", label: "Advanced", icon: Globe },
];

const LLM_OPTIONS = [
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
];

export default function AgentEditorPage() {
  const params = useParams<{ agentId: string }>();
  const router = useRouter();
  const agentId = params.agentId;

  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [voices, setVoices] = useState<ElevenVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState<Record<Panel, boolean>>({
    prompt: true, voice: true, branding: false, tools: false, behavior: false, advanced: false,
  });
  const [focusPanel, setFocusPanel] = useState<Panel | null>(null);

  const [agentName, setAgentName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [llm, setLlm] = useState("gemini-2.0-flash");
  const [firstMessage, setFirstMessage] = useState("");
  const [language, setLanguage] = useState("en");
  const [voiceId, setVoiceId] = useState("");
  const [stability, setStability] = useState(0.5);
  const [speed, setSpeed] = useState(1.0);
  const [similarity, setSimilarity] = useState(0.8);
  const [turnTimeout, setTurnTimeout] = useState(7);
  const [maxDuration, setMaxDuration] = useState(600);

  const [tools, setTools] = useState<ToolConfig>({
    transferEnabled: false, transferNumber: "", transferCondition: "",
    bookEnabled: false, rescheduleEnabled: false, cancelEnabled: false, availabilityEnabled: false,
    emailEnabled: false, leadCaptureEnabled: false, takeMessageEnabled: false,
  });
  const [calConnected, setCalConnected] = useState(false);
  const [calApiKeyInput, setCalApiKeyInput] = useState("");
  const [calEventTypeId, setCalEventTypeId] = useState("");
  const [calTimezone, setCalTimezone] = useState("America/New_York");
  const [calSaving, setCalSaving] = useState(false);
  const [calMessage, setCalMessage] = useState("");
  const [googleConnected, setGoogleConnected] = useState(false);
  const [calendarProvider, setCalendarProvider] = useState<"cal" | "google" | null>(null);
  const [toolsStatus, setToolsStatus] = useState<{
    appUrl: string;
    reachable: boolean;
    isLocalhost: boolean;
    secretConfigured: boolean;
    source: string;
  } | null>(null);

  const [brandingBusinessName, setBrandingBusinessName] = useState("");
  const [brandingContactName, setBrandingContactName] = useState("");
  const [brandingLogoUrl, setBrandingLogoUrl] = useState("");
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingMessage, setBrandingMessage] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [agentRes, voicesRes, settingsRes] = await Promise.all([
        fetch(`/api/agents/elevenlabs/${agentId}`),
        fetch("/api/tts/elevenlabs/voices"),
        fetch("/api/settings"),
      ]);
      const agentData = await agentRes.json();
      const voicesData = await voicesRes.json();
      const settingsData = settingsRes.ok ? await settingsRes.json() : {};
      if (!agentRes.ok) throw new Error(agentData.error || "Failed to load agent");

      setAgent(agentData);
      setVoices(voicesData.voices || []);
      setAgentName(agentData.name || "");
      setPrompt(agentData.conversation_config?.agent?.prompt?.prompt || "");
      setLlm(agentData.conversation_config?.agent?.prompt?.llm || "gemini-2.0-flash");
      setFirstMessage(agentData.conversation_config?.agent?.first_message || "");
      setLanguage(agentData.conversation_config?.agent?.language || "en");
      setVoiceId(agentData.conversation_config?.tts?.voice_id || "");
      setStability(agentData.conversation_config?.tts?.stability ?? 0.5);
      setSpeed(agentData.conversation_config?.tts?.speed ?? 1.0);
      setSimilarity(agentData.conversation_config?.tts?.similarity_boost ?? 0.8);
      setTurnTimeout(agentData.conversation_config?.turn?.turn_timeout ?? 7);
      setMaxDuration(agentData.conversation_config?.conversation?.max_duration_seconds ?? 600);

      setTools(parseTools(agentData.conversation_config?.agent?.prompt));
      setCalConnected(!!settingsData.cal_connected);
      setCalEventTypeId(settingsData.cal_event_type_id || "");
      setCalTimezone(settingsData.cal_timezone || "America/New_York");
      setGoogleConnected(!!settingsData.google_calendar_connected);
      setCalendarProvider(settingsData.calendar_provider || null);

      fetch("/api/agents/tools-status")
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => s && setToolsStatus(s))
        .catch(() => {});

      fetch(`/api/agents/${agentId}/branding`)
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => {
          if (!b) return;
          setBrandingBusinessName(b.businessName || "");
          setBrandingContactName(b.contactName || "");
          setBrandingLogoUrl(b.businessLogoUrl || "");
        })
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agent");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    setMounted(true);
    if (agentId) load();
  }, [agentId, load]);

  const selectedVoice = useMemo(
    () => voices.find((v) => v.voice_id === voiceId),
    [voices, voiceId]
  );

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const body = {
        name: agentName,
        conversation_config: {
          agent: {
            prompt: { prompt, llm },
            first_message: firstMessage,
            language,
          },
          tts: {
            voice_id: voiceId,
            stability,
            speed,
            similarity_boost: similarity,
          },
          turn: { turn_timeout: turnTimeout },
          conversation: { max_duration_seconds: maxDuration },
        },
        _tool_config: tools,
      };
      const res = await fetch(`/api/agents/elevenlabs/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setAgent(data);
      setSuccess("Agent saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
    </div>
  );

  return (
    <div className={`min-h-full bg-[var(--background)] transition-opacity duration-500 ${mounted ? "opacity-100" : "opacity-0"}`}>
      <div className="sticky top-0 z-20 liquid-glass-strong border-b border-white/5 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/dashboard/agents" className="w-9 h-9 rounded-xl border border-[var(--border)] flex items-center justify-center hover:bg-white/[0.04] transition-colors shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-[var(--muted)] font-semibold">AI Agents</p>
              <h1 className="text-lg font-bold truncate">{agentName || agent?.name || "Agent Editor"}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#e8553d] to-[#d44429] text-white text-sm font-semibold inline-flex items-center gap-2 shadow-lg shadow-[#e8553d]/20 disabled:opacity-50 transition-all hover:from-[#f06a54] hover:to-[#e8553d]"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        {(error || success) && (
          <div className={`mb-4 rounded-xl px-4 py-3 border text-sm flex items-center gap-2 ${error ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"}`}>
            {error ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{error || success}</span>
          </div>
        )}

        <div className="rounded-2xl liquid-glass/50 px-4 py-3 mb-4 text-xs text-[var(--muted)]">
          This is the agent editor. To test this agent with voice, head to <Link href="/dashboard/agents" className="text-[var(--accent)] font-medium">Test Agent</Link>.
        </div>

        <div className="space-y-4">
          {PANELS.filter((p) => !focusPanel || focusPanel === p.id).map(({ id, label, icon: Icon }) => {
            const isOpen = expanded[id];
            return (
              <div key={id} className="liquid-glass rounded-2xl overflow-hidden transition-all duration-500 hover:shadow-[0_0_0_1px_rgba(232,85,61,0.08),0_24px_50px_rgba(0,0,0,0.18)]">
                <button
                  onClick={() => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.04] transition-all duration-200"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Icon className="w-4 h-4 text-[var(--accent)]" /> {label}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setFocusPanel(focusPanel === id ? null : id); }}
                      className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--background)] transition-colors"
                    >
                      {focusPanel === id ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-[var(--muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--muted)]" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 space-y-4 animate-[fadeInUp_0.25s_ease-out]">
                    {id === "prompt" && (
                      <>
                        <div>
                          <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Agent Name</label>
                          <input value={agentName} onChange={(e) => setAgentName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] focus:outline-none focus:border-[var(--accent)] text-sm transition-colors" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">LLM Model</label>
                          <select value={llm} onChange={(e) => setLlm(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] focus:outline-none focus:border-[var(--accent)] text-sm transition-colors">
                            {LLM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">First Message</label>
                          <input value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] focus:outline-none focus:border-[var(--accent)] text-sm transition-colors" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">System Prompt</label>
                            <button
                              onClick={handleSave}
                              disabled={saving}
                              className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-[10px] hover:bg-white/[0.04] transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                            >
                              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save Prompt
                            </button>
                          </div>
                          <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            rows={focusPanel === "prompt" ? 28 : 18}
                            className="w-full px-4 py-4 rounded-2xl bg-[var(--background)] border border-[var(--border)] focus:outline-none focus:border-[var(--accent)] text-sm leading-6 resize-none transition-colors"
                          />
                        </div>
                      </>
                    )}

                    {id === "voice" && (
                      <>
                        <div>
                          <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Voice</label>
                          <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] focus:outline-none focus:border-[var(--accent)] text-sm transition-colors">
                            {voices.map((v) => <option key={v.voice_id} value={v.voice_id}>{v.name}{v.category ? ` (${v.category})` : ""}</option>)}
                          </select>
                          {selectedVoice && <p className="text-xs text-[var(--muted)] mt-1.5">{selectedVoice.category || "Voice"}</p>}
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Language</label>
                          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] focus:outline-none focus:border-[var(--accent)] text-sm transition-colors">
                            <option value="en">English</option>
                            <option value="es">Spanish</option>
                            <option value="fr">French</option>
                            <option value="de">German</option>
                            <option value="pt">Portuguese</option>
                            <option value="it">Italian</option>
                          </select>
                        </div>
                        {[
                          { label: "Stability", value: stability, set: setStability, min: 0, max: 1, step: 0.05 },
                          { label: "Similarity Boost", value: similarity, set: setSimilarity, min: 0, max: 1, step: 0.05 },
                          { label: "Speed", value: speed, set: setSpeed, min: 0.7, max: 1.3, step: 0.05 },
                        ].map(({ label, value, set, min, max, step }) => (
                          <div key={label}>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">{label}</label>
                              <span className="text-xs font-medium">{value.toFixed(2)}</span>
                            </div>
                            <input type="range" min={min} max={max} step={step} value={value}
                              onChange={(e) => set(parseFloat(e.target.value))}
                              className="w-full h-2 rounded-full appearance-none bg-[var(--border)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent)]"
                            />
                          </div>
                        ))}
                      </>
                    )}

                    {id === "branding" && (
                      <div className="space-y-4">
                        <p className="text-xs text-[var(--muted)] leading-5">
                          Outbound emails this agent sends mid-call (quotes, confirmations, addresses) are white-labeled with the prospect&apos;s business identity below. Leave blank to fall back to your agency profile.
                        </p>

                        <div>
                          <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Business Name</label>
                          <input
                            value={brandingBusinessName}
                            onChange={(e) => setBrandingBusinessName(e.target.value)}
                            placeholder="e.g. Acme Plumbing"
                            className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] focus:outline-none focus:border-[var(--accent)] text-sm transition-colors"
                          />
                          <p className="text-[11px] text-[var(--muted)] mt-1.5">Shown as the From name + email header.</p>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Contact Name</label>
                          <input
                            value={brandingContactName}
                            onChange={(e) => setBrandingContactName(e.target.value)}
                            placeholder="e.g. Mike (Owner)"
                            className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] focus:outline-none focus:border-[var(--accent)] text-sm transition-colors"
                          />
                          <p className="text-[11px] text-[var(--muted)] mt-1.5">Optional. Shows in the email footer next to the business name.</p>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Business Logo</label>
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--background)] flex items-center justify-center shrink-0">
                              {brandingLogoUrl ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={brandingLogoUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Building2 className="w-5 h-5 text-[var(--muted)]" />
                              )}
                            </div>
                            <div className="flex-1 flex flex-wrap items-center gap-2">
                              <label className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs hover:bg-white/[0.04] cursor-pointer inline-flex items-center gap-2">
                                {logoUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                {logoUploading ? "Uploading..." : "Upload"}
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/gif"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const f = e.target.files?.[0];
                                    if (!f) return;
                                    setLogoUploading(true);
                                    setBrandingMessage("");
                                    try {
                                      const fd = new FormData();
                                      fd.append("logo", f);
                                      const res = await fetch(`/api/agents/${agentId}/logo`, { method: "POST", body: fd });
                                      const data = await res.json();
                                      if (!res.ok) throw new Error(data.error || "Upload failed");
                                      setBrandingLogoUrl(data.url);
                                    } catch (err) {
                                      setBrandingMessage(err instanceof Error ? err.message : "Upload failed");
                                    } finally {
                                      setLogoUploading(false);
                                      e.target.value = "";
                                    }
                                  }}
                                />
                              </label>
                              {brandingLogoUrl && (
                                <button
                                  onClick={async () => {
                                    if (!confirm("Remove logo?")) return;
                                    await fetch(`/api/agents/${agentId}/logo`, { method: "DELETE" });
                                    setBrandingLogoUrl("");
                                  }}
                                  className="px-3 py-2 rounded-lg border border-red-500/20 text-red-400 text-xs hover:bg-red-500/10 transition-colors"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-[11px] text-[var(--muted)] mt-1.5">JPG, PNG, WebP, or GIF. Max 2MB.</p>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            disabled={brandingSaving}
                            onClick={async () => {
                              setBrandingSaving(true);
                              setBrandingMessage("");
                              try {
                                const res = await fetch(`/api/agents/${agentId}/branding`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    businessName: brandingBusinessName,
                                    contactName: brandingContactName,
                                  }),
                                });
                                const data = await res.json();
                                if (!res.ok) throw new Error(data.error || "Save failed");
                                setBrandingMessage("Saved.");
                              } catch (err) {
                                setBrandingMessage(err instanceof Error ? err.message : "Save failed");
                              } finally {
                                setBrandingSaving(false);
                              }
                            }}
                            className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                          >
                            {brandingSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Identity
                          </button>
                          {brandingMessage && <p className="text-[11px] text-[var(--muted)]">{brandingMessage}</p>}
                        </div>
                      </div>
                    )}

                    {id === "tools" && (
                      <div className="space-y-5">
                        <p className="text-xs text-[var(--muted)] leading-5">Give the agent real capabilities. When triggered mid-call, these tools run on NextNote&apos;s backend and return a result the agent speaks back to the caller.</p>

                        {/* Transfer to human */}
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="w-9 h-9 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center shrink-0"><PhoneForwarded className="w-4 h-4 text-[var(--accent)]" /></div>
                              <div>
                                <p className="text-sm font-semibold">Transfer to a human</p>
                                <p className="text-[11px] text-[var(--muted)]">Route the call to a live number when the caller asks, or the agent can&apos;t help.</p>
                              </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" className="sr-only peer" checked={tools.transferEnabled} onChange={(e) => setTools((t) => ({ ...t, transferEnabled: e.target.checked }))} />
                              <div className="w-10 h-6 bg-[var(--border)] rounded-full peer-checked:bg-[var(--accent)] transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:w-5 after:h-5 after:transition-all peer-checked:after:translate-x-4" />
                            </label>
                          </div>
                          {tools.transferEnabled && (
                            <div className="space-y-2 pl-12">
                              <input value={tools.transferNumber || ""} onChange={(e) => setTools((t) => ({ ...t, transferNumber: e.target.value }))} placeholder="+15551234567" className="w-full px-3 py-2 rounded-lg liquid-glass text-sm focus:outline-none focus:border-[var(--accent)]" />
                              <input value={tools.transferCondition || ""} onChange={(e) => setTools((t) => ({ ...t, transferCondition: e.target.value }))} placeholder='When to transfer (e.g. "Caller asks for a human")' className="w-full px-3 py-2 rounded-lg liquid-glass text-sm focus:outline-none focus:border-[var(--accent)]" />
                              <p className="text-[10px] text-[var(--muted)]">Only fires on real phone calls, not the web test.</p>
                            </div>
                          )}
                        </div>

                        {/* Calendar provider: Cal.com */}
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center shrink-0"><Calendar className="w-4 h-4 text-[var(--accent)]" /></div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold">Cal.com</p>
                                {calConnected ? (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Connected</span>
                                ) : (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--card)] text-[var(--muted)] border border-[var(--border)]">Not connected</span>
                                )}
                              </div>
                              <p className="text-[11px] text-[var(--muted)]">Bookings land on your Cal.com event type.</p>
                            </div>
                          </div>
                          {!calConnected ? (
                            <div className="space-y-2 pl-12">
                              <input value={calApiKeyInput} onChange={(e) => setCalApiKeyInput(e.target.value)} placeholder="Cal.com API key (cal_live_...)" type="password" className="w-full px-3 py-2 rounded-lg liquid-glass text-sm" />
                              <input value={calEventTypeId} onChange={(e) => setCalEventTypeId(e.target.value)} placeholder="Event Type ID (number)" className="w-full px-3 py-2 rounded-lg liquid-glass text-sm" />
                              <input value={calTimezone} onChange={(e) => setCalTimezone(e.target.value)} placeholder="Timezone (e.g. America/New_York)" className="w-full px-3 py-2 rounded-lg liquid-glass text-sm" />
                              <button
                                disabled={calSaving || !calApiKeyInput || !calEventTypeId}
                                onClick={async () => {
                                  setCalSaving(true);
                                  setCalMessage("");
                                  try {
                                    const res = await fetch("/api/settings", {
                                      method: "PUT",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        cal_api_key: calApiKeyInput,
                                        cal_event_type_id: calEventTypeId,
                                        cal_timezone: calTimezone,
                                        ...(calendarProvider ? {} : { calendar_provider: "cal" }),
                                      }),
                                    });
                                    if (!res.ok) throw new Error("Failed to save Cal.com credentials");
                                    setCalConnected(true);
                                    if (!calendarProvider) setCalendarProvider("cal");
                                    setCalApiKeyInput("");
                                    setCalMessage("Connected.");
                                  } catch (e) {
                                    setCalMessage(e instanceof Error ? e.message : "Connection failed");
                                  } finally {
                                    setCalSaving(false);
                                  }
                                }}
                                className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-medium inline-flex items-center gap-2 disabled:opacity-50"
                              >
                                {calSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plug className="w-3 h-3" />} Connect Cal.com
                              </button>
                              {calMessage && <p className="text-[11px] text-[var(--muted)]">{calMessage}</p>}
                            </div>
                          ) : (
                            <div className="pl-12">
                              <button
                                onClick={async () => {
                                  if (!confirm("Disconnect Cal.com?")) return;
                                  await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cal_api_key: null, ...(calendarProvider === "cal" ? { calendar_provider: googleConnected ? "google" : null } : {}) }) });
                                  setCalConnected(false);
                                  if (calendarProvider === "cal") setCalendarProvider(googleConnected ? "google" : null);
                                  if (!googleConnected) setTools((t) => ({ ...t, bookEnabled: false, rescheduleEnabled: false, availabilityEnabled: false }));
                                }}
                                className="text-[11px] text-red-400 hover:text-red-300"
                              >
                                Disconnect Cal.com
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Calendar provider: Google */}
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center shrink-0"><Calendar className="w-4 h-4 text-[var(--accent)]" /></div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold">Google Calendar</p>
                                {googleConnected ? (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Connected</span>
                                ) : (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--card)] text-[var(--muted)] border border-[var(--border)]">Not connected</span>
                                )}
                              </div>
                              <p className="text-[11px] text-[var(--muted)]">Bookings land on your primary Google Calendar with a Meet link.</p>
                            </div>
                          </div>
                          <div className="pl-12">
                            {!googleConnected ? (
                              <button
                                onClick={() => { window.location.href = `/api/auth/google?returnTo=${encodeURIComponent(`/dashboard/agents/${agentId}`)}`; }}
                                className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-medium inline-flex items-center gap-2"
                              >
                                <Plug className="w-3 h-3" /> Connect Google Calendar
                              </button>
                            ) : (
                              <button
                                onClick={async () => {
                                  if (!confirm("Disconnect Google Calendar?")) return;
                                  await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ google_disconnect: true, ...(calendarProvider === "google" ? { calendar_provider: calConnected ? "cal" : null } : {}) }) });
                                  setGoogleConnected(false);
                                  if (calendarProvider === "google") setCalendarProvider(calConnected ? "cal" : null);
                                  if (!calConnected) setTools((t) => ({ ...t, bookEnabled: false, rescheduleEnabled: false, cancelEnabled: false, availabilityEnabled: false }));
                                }}
                                className="text-[11px] text-red-400 hover:text-red-300"
                              >
                                Disconnect Google Calendar
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Active provider selector (only when both connected) */}
                        {calConnected && googleConnected && (
                          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 space-y-2">
                            <p className="text-sm font-semibold">Active calendar for this agent</p>
                            <p className="text-[11px] text-[var(--muted)]">Tools below will route through the provider you pick.</p>
                            <div className="flex gap-2">
                              {([
                                { v: "cal" as const, label: "Cal.com" },
                                { v: "google" as const, label: "Google Calendar" },
                              ]).map(({ v, label }) => (
                                <button
                                  key={v}
                                  onClick={async () => {
                                    setCalendarProvider(v);
                                    await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ calendar_provider: v }) });
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${calendarProvider === v ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "border-[var(--border)] hover:bg-white/[0.04]"}`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Shared tool toggles */}
                        {(calConnected || googleConnected) && (
                          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 space-y-2">
                            <p className="text-sm font-semibold">Calendar actions</p>
                            {[
                              { key: "availabilityEnabled" as const, label: "Check availability", desc: "Ask the calendar for open slots before booking." },
                              { key: "bookEnabled" as const, label: "Book appointment", desc: "Create a new booking from the call." },
                              { key: "rescheduleEnabled" as const, label: "Reschedule appointment", desc: "Move an existing booking to a new time." },
                              { key: "cancelEnabled" as const, label: "Cancel appointment", desc: "Cancel an existing booking when the caller asks." },
                            ].map(({ key, label, desc }) => (
                              <label key={key} className="flex items-start justify-between gap-3 py-1.5 cursor-pointer">
                                <div>
                                  <p className="text-sm text-[var(--foreground)]">{label}</p>
                                  <p className="text-[11px] text-[var(--muted)]">{desc}</p>
                                </div>
                                <div className="relative inline-flex items-center">
                                  <input type="checkbox" className="sr-only peer" checked={tools[key]} onChange={(e) => setTools((t) => ({ ...t, [key]: e.target.checked }))} />
                                  <div className="w-10 h-6 bg-[var(--border)] rounded-full peer-checked:bg-[var(--accent)] transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:w-5 after:h-5 after:transition-all peer-checked:after:translate-x-4" />
                                </div>
                              </label>
                            ))}
                          </div>
                        )}

                        {/* Always-on tools — work without any calendar provider connected. */}
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 space-y-2">
                          <p className="text-sm font-semibold">CRM &amp; communication</p>
                          <p className="text-[11px] text-[var(--muted)] -mt-1 mb-1">No setup required — these run on NextNote&apos;s infrastructure.</p>
                          {[
                            { key: "emailEnabled" as const, label: "Send email", desc: "Email the caller a quote, address, link, or confirmation mid-call." },
                            { key: "leadCaptureEnabled" as const, label: "Capture lead", desc: "Auto-save callers as prospects in your CRM, even if they don't book." },
                            { key: "takeMessageEnabled" as const, label: "Take a message", desc: "Record a callback message and email it to you immediately." },
                          ].map(({ key, label, desc }) => (
                            <label key={key} className="flex items-start justify-between gap-3 py-1.5 cursor-pointer">
                              <div>
                                <p className="text-sm text-[var(--foreground)]">{label}</p>
                                <p className="text-[11px] text-[var(--muted)]">{desc}</p>
                              </div>
                              <div className="relative inline-flex items-center">
                                <input type="checkbox" className="sr-only peer" checked={tools[key]} onChange={(e) => setTools((t) => ({ ...t, [key]: e.target.checked }))} />
                                <div className="w-10 h-6 bg-[var(--border)] rounded-full peer-checked:bg-[var(--accent)] transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:w-5 after:h-5 after:transition-all peer-checked:after:translate-x-4" />
                              </div>
                            </label>
                          ))}
                        </div>

                        {(() => {
                          // Only render the diagnostic banner when something is actually wrong
                          // (missing secret, no public URL, localhost). The green "all good"
                          // state is just noise for paying users on nextnote.to.
                          if (!toolsStatus) return null;
                          const { appUrl, reachable, isLocalhost, secretConfigured } = toolsStatus;
                          const ok = reachable && secretConfigured;
                          if (ok) return null;
                          return (
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-300/90 px-3 py-2.5 text-[11px] leading-5 space-y-1.5">
                              <div className="flex items-center gap-1.5 font-semibold">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Tools won&rsquo;t fire yet
                              </div>
                              {!secretConfigured && (
                                <div>
                                  Set <code className="font-mono">TOOLS_WEBHOOK_SECRET</code> in your env — webhooks reject any request without it.
                                </div>
                              )}
                              {isLocalhost && (
                                <div>
                                  You&rsquo;re on localhost. Start a tunnel (<code className="font-mono">ngrok http 3000</code>) and set{" "}
                                  <code className="font-mono">APP_URL</code> to the tunnel URL in <code className="font-mono">.env.local</code>, then Save.
                                </div>
                              )}
                              {!appUrl && !isLocalhost && (
                                <div>
                                  Set <code className="font-mono">APP_URL</code> (or deploy to Vercel to auto-use <code className="font-mono">VERCEL_URL</code>).
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {id === "behavior" && (
                      <>
                        <div>
                          <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Turn Timeout <span className="text-[var(--muted)]/60 normal-case font-normal">(seconds)</span></label>
                          <input type="number" value={turnTimeout} onChange={(e) => setTurnTimeout(parseFloat(e.target.value))} min={1} max={30} step={0.5}
                            className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] focus:outline-none focus:border-[var(--accent)] text-sm transition-colors" />
                          <p className="text-xs text-[var(--muted)] mt-1.5">How long the agent waits for the user to continue speaking before responding.</p>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Max Duration <span className="text-[var(--muted)]/60 normal-case font-normal">(seconds)</span></label>
                          <input type="number" value={maxDuration} onChange={(e) => setMaxDuration(parseInt(e.target.value))} min={60} max={3600} step={60}
                            className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] focus:outline-none focus:border-[var(--accent)] text-sm transition-colors" />
                          <p className="text-xs text-[var(--muted)] mt-1.5">Maximum conversation length before the agent ends the call. ({Math.round(maxDuration / 60)} min)</p>
                        </div>
                      </>
                    )}

                    {id === "advanced" && (
                      <div className="space-y-3 text-xs text-[var(--muted)]">
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 space-y-1.5">
                          <p className="font-semibold text-[var(--foreground)]">Agent ID</p>
                          <p className="font-mono text-[10px]">{agent?.agent_id}</p>
                        </div>
                        <div className="liquid-glass rounded-2xl p-5 space-y-3">
                          <div className="flex items-center gap-2 text-sm font-semibold"><Bot className="w-4 h-4 text-[var(--accent)]" /> Agent Info</div>
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-[var(--muted)]" /><span className="text-[var(--muted)]">Language:</span><span className="font-medium uppercase">{language}</span></div>
                            <div className="flex items-center gap-2"><Mic className="w-3.5 h-3.5 text-[var(--muted)]" /><span className="text-[var(--muted)]">Voice:</span><span className="font-medium truncate">{selectedVoice?.name || voiceId || "—"}</span></div>
                            <div className="flex items-center gap-2"><Settings2 className="w-3.5 h-3.5 text-[var(--muted)]" /><span className="text-[var(--muted)]">Model:</span><span className="font-medium">{LLM_OPTIONS.find((o) => o.value === llm)?.label || llm}</span></div>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            if (!confirm("Delete this agent? This cannot be undone.")) return;
                            await fetch(`/api/agents/elevenlabs/${agentId}`, { method: "DELETE" });
                            router.push("/dashboard/agents");
                          }}
                          className="w-full px-4 py-2.5 rounded-xl border border-red-500/20 text-red-400 text-sm hover:bg-red-500/10 transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" /> Delete Agent
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
