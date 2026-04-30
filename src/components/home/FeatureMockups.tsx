"use client";

import { useEffect, useState } from "react";
import {
  Search,
  Phone,
  Mic,
  Sparkles,
  CheckCheck,
  MessageSquare,
  TrendingUp,
  Mail,
  Folder,
  Globe,
  PhoneOff,
  Zap,
  ExternalLink,
} from "lucide-react";
import { OrbitGridIcon, NextNoteWordmark } from "@/components/OrbitGridLogo";

const ACCENT = "#e8553d";
const ACCENT_BRIGHT = "#ff6a4d";

/* ─── Lead Intelligence ─── matches the real /dashboard/prospects kanban ─── */
const KANBAN_COLUMNS = [
  {
    label: "New",
    count: 86,
    dot: "bg-blue-400",
    grad: "from-blue-500/20 to-blue-500/5",
    cards: [
      { name: "Bay Detail Co", service: "Auto detailing", email: "ops@baydetail.co", phone: "(415) 555-0142" },
      { name: "Pacific Roofing", service: "Roof replacement", email: "info@pacificrf.com", phone: "(415) 555-0188" },
    ],
  },
  {
    label: "Contacted",
    count: 142,
    dot: "bg-amber-400",
    grad: "from-amber-500/20 to-amber-500/5",
    cards: [
      { name: "Lumen Studio", service: "Brand photography", email: "hi@lumen.studio", phone: "(415) 555-0167", appts: 1 },
      { name: "Elite HVAC", service: "HVAC install + repair", email: "team@elitehvac.io", phone: "(415) 555-0193" },
    ],
  },
  {
    label: "Qualified",
    count: 38,
    dot: "bg-purple-400",
    grad: "from-purple-500/20 to-purple-500/5",
    cards: [
      { name: "Northstar Legal", service: "Personal injury", email: "intake@nslegal.com", phone: "(415) 555-0124" },
    ],
  },
  {
    label: "Booked",
    count: 24,
    dot: "bg-emerald-400",
    grad: "from-emerald-500/20 to-emerald-500/5",
    cards: [
      { name: "Pivot Auto", service: "Used vehicle dealer", email: "sales@pivotauto.com", phone: "(415) 555-0179", appts: 1 },
    ],
  },
  {
    label: "Closed",
    count: 18,
    dot: "bg-rose-400",
    grad: "from-rose-500/20 to-rose-500/5",
    cards: [
      { name: "Crown Fitness", service: "Boutique gym chain", email: "ops@crownfit.com", phone: "(415) 555-0156" },
    ],
  },
];

export function LeadIntelligenceMockup() {
  return (
    <div className="absolute inset-0 flex text-[10px]">
      {/* Sidebar */}
      <div className="w-32 border-r border-white/5 bg-[rgba(8,8,12,0.6)] p-2 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 px-1.5 py-1.5 mb-1">
          <OrbitGridIcon size={14} />
          <NextNoteWordmark className="text-[10px] text-white/90" accent={ACCENT_BRIGHT} />
        </div>
        {[
          { l: "Dashboard", on: false },
          { l: "Prospects", on: true },
          { l: "Sources", on: false },
          { l: "Appointments", on: false },
          { l: "Analytics", on: false },
        ].map((it) => (
          <div
            key={it.l}
            className={`px-2 py-1.5 rounded-md text-[9.5px] ${
              it.on
                ? "bg-[rgba(232,85,61,0.15)] text-[var(--accent)] font-medium"
                : "text-white/50"
            }`}
          >
            {it.l}
          </div>
        ))}

        <div className="mt-2 pt-2 border-t border-white/5 space-y-0.5">
          <div className="text-[8.5px] uppercase tracking-wider text-white/30 px-2 mb-1">Folders</div>
          {[
            { name: "Roofing", color: "#3b82f6" },
            { name: "Auto", color: "#10b981" },
            { name: "Healthcare", color: "#a855f7" },
          ].map((f) => (
            <div key={f.name} className="flex items-center gap-1.5 px-2 py-1 text-[9px] text-white/50">
              <Folder className="w-2.5 h-2.5" style={{ color: f.color }} />
              {f.name}
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white/90 font-semibold text-[11px]">All prospects</div>
            <div className="text-white/40 text-[9px] mt-0.5">428 total · 5 stages</div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/5">
              <Search className="w-2.5 h-2.5 text-white/40" />
              <span className="text-white/40 text-[9px]">Search…</span>
            </div>
            <div
              className="px-2 py-1 rounded-md text-[9px] font-medium text-white whitespace-nowrap"
              style={{ background: `linear-gradient(135deg, ${ACCENT}, #d44429)` }}
            >
              + Add
            </div>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-1.5 flex-1 min-h-0">
          {KANBAN_COLUMNS.map((c) => (
            <div
              key={c.label}
              className="rounded-lg border border-white/5 bg-[rgba(255,255,255,0.02)] p-1.5 flex flex-col gap-1.5 min-w-0"
            >
              <div className={`rounded-md bg-gradient-to-b ${c.grad} px-1.5 py-1 flex items-center justify-between`}>
                <div className="flex items-center gap-1 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full ${c.dot} flex-shrink-0`} />
                  <span className="text-[8.5px] uppercase tracking-wide text-white/80 font-semibold truncate">
                    {c.label}
                  </span>
                </div>
                <span className="text-[8.5px] text-white/40 flex-shrink-0">{c.count}</span>
              </div>
              <div className="space-y-1.5">
                {c.cards.map((card, i) => (
                  <div
                    key={i}
                    className="rounded-md bg-[rgba(255,255,255,0.025)] border border-white/5 p-1.5 space-y-1 hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="text-white/90 font-medium text-[9.5px] leading-tight truncate">
                      {card.name}
                    </div>
                    <div className="text-white/40 text-[8.5px] leading-tight truncate">
                      {card.service}
                    </div>
                    <div className="space-y-0.5 pt-0.5">
                      <div className="flex items-center gap-1 text-white/35 text-[8px]">
                        <Mail className="w-2 h-2 flex-shrink-0" />
                        <span className="truncate">{card.email}</span>
                      </div>
                      <div className="flex items-center gap-1 text-white/35 text-[8px]">
                        <Phone className="w-2 h-2 flex-shrink-0" />
                        <span className="truncate">{card.phone}</span>
                      </div>
                    </div>
                    {card.appts && (
                      <div className="text-emerald-400 text-[8px] pt-0.5">
                        {card.appts} appointment
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── AI Agent ─── inbound call with streaming transcript ─── */
const TRANSCRIPT = [
  { who: "caller", text: "Hi, I've got a leak under my kitchen sink — can someone come out today?", delay: 0 },
  { who: "agent", text: "Sorry to hear that. I can get Mike out between 2 and 4pm today. What's the address?", delay: 1 },
  { who: "caller", text: "1247 Maple Ave. How much is the visit?", delay: 2 },
  { who: "agent", text: "$89 service call, applied to the repair. Booking you in now — Mike will text 15 min before arrival.", delay: 3 },
];

export function AIAgentMockup() {
  const [step, setStep] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setStep(TRANSCRIPT.length);
      return;
    }
    const id = setInterval(() => {
      setStep((s) => (s >= TRANSCRIPT.length ? 0 : s + 1));
      setSeconds((s) => (s >= 240 ? 0 : s + 12));
    }, 3200);
    return () => clearInterval(id);
  }, []);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="absolute inset-0 flex">
      {/* Left: call panel */}
      <div className="w-2/5 border-r border-white/5 bg-[rgba(8,8,12,0.6)] p-5 flex flex-col items-center justify-center gap-3">
        <div className="text-[9px] uppercase tracking-wider text-white/40 font-semibold">
          Incoming · Acme Plumbing
        </div>
        <div className="relative">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, #d44429)` }}
          >
            <Phone className="w-7 h-7 text-white" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-[#0a0a10]" />
          </span>
        </div>
        <div className="text-center">
          <div className="text-white/90 font-semibold text-xs">AI Receptionist · Live</div>
          <div className="text-white/40 text-[10px] mt-0.5 font-mono">{mm}:{ss}</div>
          <div className="text-emerald-400 text-[9px] mt-1 font-medium">Owner on job site</div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center">
            <Mic className="w-3 h-3 text-white/60" />
          </div>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
          >
            <Phone className="w-3.5 h-3.5 text-white" style={{ transform: "rotate(135deg)" }} />
          </div>
          <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
          </div>
        </div>
        {/* Audio waveform */}
        <div className="flex items-end gap-0.5 h-6 mt-1">
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="w-0.5 rounded-full"
              style={{
                height: `${20 + Math.sin(i * 0.7) * 40 + Math.cos(i * 0.3) * 30}%`,
                background: ACCENT,
                opacity: 0.4 + (i % 3) * 0.2,
                animation: "audioBar 1.2s ease-in-out infinite",
                animationDelay: `${i * 60}ms`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Right: transcript */}
      <div className="flex-1 p-4 flex flex-col gap-2.5 overflow-hidden">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-[var(--accent)]" />
            <span className="text-white/90 text-[10px] font-semibold">Live transcript</span>
          </div>
          <span className="text-[9px] text-white/40 font-mono">+1 (415) 555-0142 · Caller</span>
        </div>

        {TRANSCRIPT.slice(0, step).map((t, i) => {
          const isCaller = t.who === "caller";
          return (
            <div
              key={i}
              className={`flex ${isCaller ? "justify-start" : "justify-end"} fade-in-up`}
              style={{ animationDelay: "0s", animationDuration: "0.4s" }}
            >
              <div className={`max-w-[85%] flex flex-col ${isCaller ? "items-start" : "items-end"}`}>
                <span className="text-[8px] text-white/40 mb-0.5 font-medium uppercase tracking-wide">
                  {isCaller ? "Caller" : "AI"}
                </span>
                <div
                  className={`rounded-2xl px-2.5 py-1.5 text-[10px] leading-snug ${
                    isCaller
                      ? "bg-white/5 text-white/90 rounded-bl-sm"
                      : "text-white rounded-br-sm"
                  }`}
                  style={
                    !isCaller
                      ? { background: `linear-gradient(135deg, ${ACCENT}, #d44429)` }
                      : undefined
                  }
                >
                  {t.text}
                </div>
              </div>
            </div>
          );
        })}

        {step < TRANSCRIPT.length && (
          <div className={`flex ${step % 2 === 0 ? "justify-start" : "justify-end"}`}>
            <div className="rounded-2xl bg-white/5 px-3 py-2 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1 h-1 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "120ms" }} />
              <span className="w-1 h-1 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "240ms" }} />
            </div>
          </div>
        )}

        <div className="mt-auto pt-2 border-t border-white/5 flex items-center gap-2">
          <Sparkles className="w-2.5 h-2.5 text-[var(--accent)]" />
          <span className="text-[9px] text-white/50">
            Appointment will sync to your calendar + text you a summary
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Outbound ─── SMS sequence with delivery stats ─── */
export function OutboundMockup() {
  return (
    <div className="absolute inset-0 p-4 flex flex-col gap-3 text-[10px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-white/90 font-semibold text-xs mb-0.5">Spring Outreach · Live</div>
          <div className="text-white/40 text-[9px]">3-step sequence · No-answer trigger</div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <span className="text-emerald-400 text-[9px] font-medium">Active</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Sent", value: "1,247", trend: "+18%" },
          { label: "Replied", value: "164", trend: "13.2%" },
          { label: "Booked", value: "31", trend: "+9%" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-white/5 bg-[rgba(255,255,255,0.02)] p-2.5"
          >
            <div className="text-white/40 text-[9px] uppercase tracking-wider mb-0.5">{s.label}</div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-white/90 text-base font-bold">{s.value}</span>
              <span className="text-emerald-400 text-[9px] font-medium flex items-center gap-0.5">
                <TrendingUp className="w-2 h-2" />
                {s.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Steps timeline */}
      <div className="flex-1 flex items-stretch gap-2">
        {[
          { step: 1, body: "Hey {first_name}, saw your work…", delay: "Right away", sent: 1247, color: ACCENT },
          { step: 2, body: "Quick follow-up — got 3 min for a chat?", delay: "+24h", sent: 892, color: ACCENT },
          { step: 3, body: "Last note, then I'll let you go…", delay: "+72h", sent: 416, color: ACCENT },
        ].map((s, i) => (
          <div key={s.step} className="flex-1 flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-white/10 bg-[rgba(255,255,255,0.03)] p-2.5 space-y-1.5 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                    style={{ background: s.color }}
                  >
                    {s.step}
                  </span>
                  <MessageSquare className="w-2.5 h-2.5 text-white/40" />
                </div>
                <span className="text-[8.5px] text-white/40 font-mono">{s.delay}</span>
              </div>
              <div className="text-white/70 text-[9px] leading-snug italic">{s.body}</div>
              <div className="flex items-center gap-1 pt-1 border-t border-white/5">
                <CheckCheck className="w-2.5 h-2.5 text-emerald-400" />
                <span className="text-[8.5px] text-white/50">{s.sent.toLocaleString()} sent</span>
              </div>
            </div>
            {i < 2 && (
              <span className="text-white/30 text-[10px] flex-shrink-0">→</span>
            )}
          </div>
        ))}
      </div>

      {/* Bar chart strip */}
      <div className="rounded-lg border border-white/5 bg-[rgba(255,255,255,0.02)] p-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-white/60 text-[9px] font-medium">Last 7 days · replies</span>
          <span className="text-[var(--accent)] text-[9px] font-semibold">↑ 22%</span>
        </div>
        <div className="flex items-end gap-1 h-8">
          {[40, 65, 50, 80, 70, 92, 100].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm relative overflow-hidden"
              style={{
                height: `${h}%`,
                background: `linear-gradient(180deg, ${ACCENT}cc, ${ACCENT}33)`,
              }}
            >
              <div
                className="absolute inset-x-0 top-0 h-full opacity-60"
                style={{
                  background: `linear-gradient(180deg, ${ACCENT}, transparent)`,
                  animation: "barGrow 1.4s ease-out forwards",
                  animationDelay: `${i * 90}ms`,
                  transformOrigin: "bottom",
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Website Builder ─── live AI build flow + high-converting preview ─── */
const BUILD_STEPS = [
  { label: "Detected niche · Home Services / Trades", done: true },
  { label: "Locked design system · System A", done: true },
  { label: "Fetched 13 photos from Pexels", done: true },
  { label: "Generated brand mark SVG", done: true },
  { label: "Composing hero + 6 services", done: false, active: true },
  { label: "Wiring booking form → CRM", done: false },
];

/* Brutalist palette extracted (Home Services / Trades · seed Acme):
   --asphalt #0b2545 · --safety #ffb703 · --rust #c84a1c · --concrete #ebe8e2 */
const SITE = {
  asphalt: "#0b2545",
  safety: "#ffb703",
  rust: "#c84a1c",
  concrete: "#ebe8e2",
  rebar: "#4a4a4a",
  concreteDim: "#d2cec5",
};

export function WebsiteBuilderMockup() {
  // Phase progresses: 0 = just started, 1-5 = each step finishing in turn,
  // 6 = build complete, full site renders. ~700ms per step → ~4.2s total build.
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 700),
      setTimeout(() => setPhase(2), 1400),
      setTimeout(() => setPhase(3), 2100),
      setTimeout(() => setPhase(4), 2800),
      setTimeout(() => setPhase(5), 3500),
      setTimeout(() => setPhase(6), 4200),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);
  const isComplete = phase >= 6;
  const pct = Math.min(100, Math.round((phase / 6) * 100));
  const activeStepLabel = BUILD_STEPS[Math.min(phase, BUILD_STEPS.length - 1)]?.label || "Finalizing";

  return (
    <div className="absolute inset-0 flex text-[10px]">
      {/* ── Left: AI build flow ── */}
      <div className="w-[34%] border-r border-white/5 bg-[rgba(8,8,12,0.6)] p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-[var(--accent)]" />
            <span className="text-white/90 text-[10px] font-semibold">AI website builder</span>
          </div>
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[8px] font-semibold border border-emerald-500/20">
            LIVE
          </span>
        </div>

        {/* Prospect card */}
        <div className="rounded-md border border-white/5 bg-[rgba(255,255,255,0.02)] p-2 flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, #d44429)` }}
          >
            A
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-white/90 font-semibold text-[10px] truncate">Acme Plumbing</div>
            <div className="text-white/40 text-[8.5px] font-mono truncate">San Mateo, CA · trades</div>
          </div>
        </div>

        {/* Build progress checklist — driven by phase */}
        <div className="space-y-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[8.5px] uppercase tracking-wider text-white/40">Build progress</span>
            <span className="text-[8.5px] font-mono text-[var(--accent)] font-semibold">{pct}%</span>
          </div>
          {BUILD_STEPS.map((s, i) => {
            const done = i < phase;
            const active = i === phase && !isComplete;
            return (
              <div key={i} className="flex items-center gap-1.5">
                {done ? (
                  <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
                    <CheckCheck className="w-2 h-2 text-emerald-400" />
                  </div>
                ) : active ? (
                  <div className="w-3 h-3 rounded-full border border-[var(--accent)]/40 flex items-center justify-center flex-shrink-0 relative">
                    <span className="absolute inset-0 rounded-full bg-[var(--accent)]/20 animate-ping" />
                    <span className="relative w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                  </div>
                ) : (
                  <div className="w-3 h-3 rounded-full border border-white/10 flex-shrink-0" />
                )}
                <span className={`text-[9px] ${done ? "text-white/60" : active ? "text-white/90 font-medium" : "text-white/30"}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Locked design system swatch */}
        <div className="rounded-md border border-white/5 bg-[rgba(255,255,255,0.02)] p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[8.5px] uppercase tracking-wider text-white/40">Design system A</span>
            <span className="text-[7.5px] font-mono text-white/30">brutalist</span>
          </div>
          <div className="flex gap-1">
            <span className="w-5 h-5 rounded-sm" style={{ background: SITE.asphalt }} title="--asphalt" />
            <span className="w-5 h-5 rounded-sm" style={{ background: SITE.safety }} title="--safety" />
            <span className="w-5 h-5 rounded-sm" style={{ background: SITE.rust }} title="--rust" />
            <span className="w-5 h-5 rounded-sm border border-white/10" style={{ background: SITE.concrete }} title="--concrete" />
            <span className="w-5 h-5 rounded-sm flex items-center justify-center text-[7.5px] text-white/50" style={{ background: "rgba(255,255,255,0.04)" }}>
              Aa
            </span>
          </div>
          <div className="text-[7.5px] font-mono text-white/40 truncate">Archivo Black · Barlow · JetBrains</div>
        </div>

        {/* Footer status */}
        <div
          className="mt-auto rounded-md p-2 flex items-center gap-1.5"
          style={{
            background: `linear-gradient(135deg, ${ACCENT}26, ${ACCENT}0d)`,
            border: `1px solid ${ACCENT}33`,
          }}
        >
          <Zap className="w-3 h-3 text-[var(--accent)] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-white/90 font-semibold text-[9px]">
              {isComplete ? "Site ready · 4.2s" : `${phase} of ${BUILD_STEPS.length} sections built`}
            </div>
            <div className="text-white/40 text-[8.5px] truncate">acme.pitchsite.dev · white-label</div>
          </div>
        </div>
      </div>

      {/* ── Right: actual NextNote-generated site preview (System A · brutalist) ── */}
      <div className="flex-1 relative overflow-hidden">
        {/* Loading overlay — visible until build completes, then fades out */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center px-4 transition-opacity duration-500 z-20"
          style={{
            background: `linear-gradient(180deg, ${SITE.asphalt} 0%, #061629 100%)`,
            opacity: isComplete ? 0 : 1,
            pointerEvents: isComplete ? "none" : "auto",
            backgroundImage: `linear-gradient(180deg, ${SITE.asphalt}f8 0%, #061629f8 100%), linear-gradient(rgba(255,194,14,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,194,14,0.04) 1px, transparent 1px)`,
            backgroundSize: "auto, 14px 14px, 14px 14px",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3 h-3" style={{ color: SITE.safety }} />
            <span
              className="uppercase tracking-[0.2em]"
              style={{ fontFamily: "'Archivo Black', Impact, sans-serif", color: SITE.concrete, fontSize: 10 }}
            >
              Building Acme Plumbing
            </span>
          </div>

          {/* Big percent */}
          <div
            className="leading-none mb-2"
            style={{
              fontFamily: "'Archivo Black', Impact, sans-serif",
              color: SITE.safety,
              fontSize: 56,
              letterSpacing: "-0.04em",
              WebkitTextStroke: `1px ${SITE.safety}`,
              textShadow: `0 0 20px ${SITE.safety}40`,
            }}
          >
            {pct}
            <span style={{ fontSize: 22, color: SITE.concrete, marginLeft: 4 }}>%</span>
          </div>

          {/* Progress bar */}
          <div
            className="w-[70%] h-1.5 mb-2 relative overflow-hidden"
            style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${SITE.safety}40` }}
          >
            <div
              className="h-full transition-all duration-500 ease-out"
              style={{
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${SITE.safety}, ${SITE.rust})`,
                boxShadow: `0 0 8px ${SITE.safety}`,
              }}
            />
            {/* Hazard stripe overlay on the fill */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                width: `${pct}%`,
                backgroundImage: "repeating-linear-gradient(-45deg, transparent 0 4px, rgba(20,20,20,0.2) 4px 5px)",
              }}
            />
          </div>

          {/* Active step label */}
          <div
            className="font-mono uppercase tracking-[0.2em] mb-3 flex items-center gap-1"
            style={{ color: SITE.concreteDim, fontSize: 7 }}
          >
            <span className="inline-block w-1 h-1 rounded-full glow-pulse" style={{ background: SITE.safety }} />
            {activeStepLabel}
            <span className="inline-block w-2 text-left">{".".repeat((phase % 3) + 1)}</span>
          </div>

          {/* Console log feed */}
          <div
            className="w-[80%] p-1.5 font-mono space-y-0.5"
            style={{
              background: "rgba(0,0,0,0.35)",
              border: `1px solid ${SITE.safety}30`,
              fontSize: 6.5,
              letterSpacing: "0.05em",
              color: SITE.concreteDim,
            }}
          >
            {[
              { phase: 1, text: "✓ Niche detected: Home Services / Trades" },
              { phase: 2, text: "✓ Locked design system: System A · brutalist" },
              { phase: 3, text: "✓ Pexels: 13 photos fetched (avg 412ms)" },
              { phase: 4, text: "✓ Brand mark: SVG icon generated" },
              { phase: 5, text: "✓ Hero + 6 services composed (Claude · 2.1k tokens)" },
              { phase: 6, text: "✓ Booking form wired → Acme prospects CRM" },
            ]
              .filter((l) => phase >= l.phase)
              .slice(-4)
              .map((l, i) => (
                <div key={i} className="fade-in-up" style={{ color: i === 3 - 1 ? SITE.safety : SITE.concreteDim }}>
                  <span style={{ color: SITE.rebar }}>$</span> {l.text}
                </div>
              ))}
            {!isComplete && (
              <div className="flex items-center gap-1" style={{ color: SITE.safety }}>
                <span style={{ color: SITE.rebar }}>$</span>
                <span>{activeStepLabel.toLowerCase()}</span>
                <span className="glow-pulse">▋</span>
              </div>
            )}
          </div>
        </div>

        {/* Actual site (hidden behind loader until complete) */}
        <div
          className="absolute inset-0 flex flex-col overflow-hidden transition-opacity duration-700"
          style={{
            background: SITE.concrete,
            color: SITE.asphalt,
            fontFamily: "'Barlow Condensed', 'Inter', system-ui, sans-serif",
            backgroundImage:
              "linear-gradient(rgba(20,20,20,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(20,20,20,0.06) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
            opacity: isComplete ? 1 : 0,
          }}
        >
        {/* Top utility bar */}
        <div
          className="flex items-center justify-between px-2.5 py-1 text-[6.5px] font-mono uppercase tracking-[0.18em]"
          style={{ background: SITE.asphalt, color: SITE.concrete }}
        >
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-[5px] h-[5px] rounded-full glow-pulse"
              style={{ background: SITE.rust, boxShadow: `0 0 4px ${SITE.rust}` }}
            />
            Licensed · Bonded · Insured · CA #847291
          </span>
          <span className="flex gap-2">
            <span>(415) 555-0142</span>
            <span style={{ color: SITE.concreteDim }}>Mon–Sat · 7A–6P</span>
          </span>
        </div>

        {/* Sticky nav */}
        <div
          className="flex items-center justify-between px-2.5 py-1.5"
          style={{ background: SITE.concrete, borderBottom: `2px solid ${SITE.asphalt}` }}
        >
          <div className="flex items-center gap-1.5">
            {/* Custom brand mark — pipe wrench icon (matches generated SVG) */}
            <svg viewBox="0 0 48 48" className="w-[22px] h-[22px]" aria-hidden="true">
              <rect x="2" y="2" width="44" height="44" fill={SITE.asphalt} />
              <polygon points="46,2 46,16 32,2" fill={SITE.rust} />
              <path
                d="M14 30 L14 22 L19 22 L19 16 Q19 13 22 13 L30 13 Q33 13 33 16 L33 22 L38 22 L38 30 L33 30 L33 36 Q33 39 30 39 L22 39 Q19 39 19 36 L19 30 Z"
                fill={SITE.safety}
              />
              <circle cx="26" cy="26" r="3" fill={SITE.asphalt} />
            </svg>
            <div className="leading-[0.95]">
              <div
                className="text-[10.5px] font-black tracking-tight"
                style={{ fontFamily: "'Archivo Black', Impact, sans-serif" }}
              >
                ACME PLUMBING
              </div>
              <div
                className="text-[5.5px] font-mono uppercase tracking-[0.2em] mt-px"
                style={{ color: SITE.rebar }}
              >
                Est. 2007 · San Mateo, CA
              </div>
            </div>
          </div>
          <div
            className="flex items-center gap-2 text-[6.5px] font-bold uppercase tracking-[0.1em]"
            style={{ color: SITE.asphalt }}
          >
            <span className="flex items-baseline gap-0.5">
              <span style={{ fontFamily: "monospace", color: SITE.rebar, fontSize: 5 }}>01 /</span>
              Capabilities
            </span>
            <span className="flex items-baseline gap-0.5">
              <span style={{ fontFamily: "monospace", color: SITE.rebar, fontSize: 5 }}>02 /</span>
              Process
            </span>
            <span
              className="px-1.5 py-1 text-[7px]"
              style={{
                background: SITE.safety,
                color: SITE.asphalt,
                border: `2px solid ${SITE.asphalt}`,
                boxShadow: `2px 2px 0 ${SITE.asphalt}`,
                fontFamily: "'Archivo Black', Impact, sans-serif",
              }}
            >
              GET QUOTE →
            </span>
          </div>
        </div>

        {/* Hero — 1.4fr / 1fr grid */}
        <div
          className="px-2.5 pt-2.5 pb-2 grid gap-2.5"
          style={{ gridTemplateColumns: "1.4fr 1fr", borderBottom: `2px solid ${SITE.asphalt}` }}
        >
          {/* Left column */}
          <div className="flex flex-col">
            {/* Meta cells */}
            <div
              className="grid grid-cols-3 gap-1.5 pb-1 mb-1.5 text-[5.5px] font-mono uppercase tracking-[0.2em]"
              style={{ borderBottom: `1px solid ${SITE.asphalt}`, color: SITE.rebar }}
            >
              <div>
                EST
                <strong
                  className="block text-[8px] mt-0.5"
                  style={{ color: SITE.asphalt, fontFamily: "'Archivo Black', sans-serif" }}
                >
                  2007
                </strong>
              </div>
              <div>
                JOBS
                <strong
                  className="block text-[8px] mt-0.5"
                  style={{ color: SITE.asphalt, fontFamily: "'Archivo Black', sans-serif" }}
                >
                  8,400+
                </strong>
              </div>
              <div>
                CREW
                <strong
                  className="block text-[8px] mt-0.5"
                  style={{ color: SITE.asphalt, fontFamily: "'Archivo Black', sans-serif" }}
                >
                  14
                </strong>
              </div>
            </div>

            {/* Heavy uppercase H1 with stripe / outline / rust spans */}
            <div
              className="text-[20px] uppercase leading-[0.85] tracking-[-0.025em]"
              style={{ fontFamily: "'Archivo Black', Impact, sans-serif", color: SITE.asphalt }}
            >
              <div>WATER</div>
              <div>
                <span
                  className="inline-block px-1"
                  style={{
                    backgroundColor: SITE.safety,
                    backgroundImage:
                      "repeating-linear-gradient(-45deg, transparent 0 5px, rgba(20,20,20,0.18) 5px 6px)",
                  }}
                >
                  WHERE
                </span>
              </div>
              <div>
                <span
                  style={{
                    color: "transparent",
                    WebkitTextStroke: `1px ${SITE.asphalt}`,
                  }}
                >
                  YOU
                </span>{" "}
                <span style={{ color: SITE.rust }}>NEED IT.</span>
              </div>
            </div>

            {/* Sub copy + actions */}
            <div className="grid grid-cols-[1fr_auto] gap-1.5 mt-1.5 items-end">
              <div className="flex flex-col gap-1">
                <p className="text-[7px] leading-snug" style={{ color: SITE.rebar }}>
                  24/7 emergency plumbing in San Mateo County. Same-day repair, no surprise pricing.
                </p>
                {/* Trust list — credentials + value props */}
                <ul
                  className="space-y-[2px] uppercase"
                  style={{
                    fontFamily: "monospace",
                    fontSize: 5.5,
                    letterSpacing: "0.12em",
                    color: SITE.asphalt,
                  }}
                >
                  {[
                    "Family-owned · 14-person crew · est. 2007",
                    "CA Master Plumber Lic #847291 · BBB A+",
                    "Flat-rate pricing · no after-hours surcharge",
                    "1-yr workmanship warranty · all parts",
                  ].map((line) => (
                    <li
                      key={line}
                      className="flex items-start gap-1 pt-[2px]"
                      style={{ borderTop: `1px dashed ${SITE.asphalt}30` }}
                    >
                      <span style={{ color: SITE.rust, fontWeight: 700 }}>+</span>
                      <span className="leading-tight">{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-1">
                <span
                  className="px-1.5 py-0.5 text-[7px] uppercase text-center inline-flex items-center gap-1 justify-center"
                  style={{
                    background: SITE.safety,
                    color: SITE.asphalt,
                    border: `2px solid ${SITE.asphalt}`,
                    boxShadow: `2px 2px 0 ${SITE.asphalt}`,
                    fontFamily: "'Archivo Black', sans-serif",
                  }}
                >
                  Free Estimate <span>→</span>
                </span>
                <span
                  className="px-1.5 py-0.5 text-[7px] uppercase text-center"
                  style={{
                    background: SITE.asphalt,
                    color: SITE.concrete,
                    border: `2px solid ${SITE.asphalt}`,
                    boxShadow: `2px 2px 0 ${SITE.rust}`,
                    fontFamily: "'Archivo Black', sans-serif",
                  }}
                >
                  See Projects
                </span>
              </div>
            </div>
          </div>

          {/* Right column — bordered hero photo with stamp + tag */}
          <div
            className="relative overflow-hidden"
            style={{
              border: `2px solid ${SITE.asphalt}`,
              aspectRatio: "4 / 5",
              background: "linear-gradient(135deg, #1f2933 0%, #0a0f15 100%)",
            }}
          >
            {/* Real plumbing photo (Pexels-style — same source the API uses) */}
            <img
              src="https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=70"
              alt="Plumber working on pipes"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: "contrast(1.05) saturate(0.85) brightness(0.85)" }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            {/* Subtle yellow grid overlay (matches generated CSS) */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,194,14,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,194,14,0.05) 1px, transparent 1px)",
                backgroundSize: "14px 14px",
              }}
            />
            {/* Vertical gradient overlay for legibility */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(11,37,69,0) 50%, rgba(11,37,69,0.75) 100%)",
              }}
            />

            {/* Rotated yellow stamp */}
            <div
              className="absolute top-1 right-1 px-1 py-0.5 z-10"
              style={{
                background: SITE.safety,
                color: SITE.asphalt,
                border: `1.5px solid ${SITE.asphalt}`,
                fontFamily: "monospace",
                fontSize: 5.5,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                fontWeight: 700,
                transform: "rotate(3deg)",
              }}
            >
              JOB 1247 · SAN MATEO
            </div>

            {/* Photo tag bottom-left */}
            <div
              className="absolute bottom-1 left-1 z-10"
              style={{
                color: SITE.concrete,
                fontFamily: "monospace",
                fontSize: 5.5,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
              }}
            >
              JOBS THIS YEAR
              <span
                className="block leading-[0.85] mt-0.5"
                style={{ color: SITE.safety, fontSize: 18, fontFamily: "'Archivo Black', sans-serif", letterSpacing: "-0.02em" }}
              >
                1,284
              </span>
            </div>

            {/* Trust corner badge */}
            <div
              className="absolute bottom-1 right-1 z-10 flex items-center gap-1 px-1 py-0.5"
              style={{
                background: "rgba(11,37,69,0.85)",
                border: `1px solid ${SITE.safety}`,
              }}
            >
              <span style={{ color: SITE.safety, fontSize: 6, letterSpacing: "0.15em", fontFamily: "monospace", textTransform: "uppercase", fontWeight: 700 }}>
                ★ 4.9
              </span>
              <span style={{ color: SITE.concreteDim, fontSize: 5.5, fontFamily: "monospace", letterSpacing: "0.1em" }}>
                487 reviews
              </span>
            </div>
          </div>
        </div>

        {/* Hazard stripes divider */}
        <div
          className="h-2"
          style={{
            backgroundImage: `repeating-linear-gradient(-45deg, ${SITE.safety} 0 8px, ${SITE.asphalt} 8px 16px)`,
          }}
        />

        {/* Stats bar */}
        <div
          className="px-2.5 py-1.5 grid grid-cols-4 gap-1.5"
          style={{ background: SITE.asphalt, color: SITE.concrete }}
        >
          {[
            { num: "18", small: "YRS", label: "IN BUSINESS" },
            { num: "8.4K", small: "", label: "JOBS DONE" },
            { num: "98", small: "%", label: "ON-TIME" },
            { num: "<60", small: "MIN", label: "RESPONSE" },
          ].map((s, i) => (
            <div key={i} className="pl-1.5" style={{ borderLeft: `2px solid ${SITE.safety}` }}>
              <div
                className="leading-[0.9] tracking-[-0.02em]"
                style={{ fontFamily: "'Archivo Black', Impact, sans-serif", fontSize: 13 }}
              >
                {s.num}
                {s.small && (
                  <span className="ml-0.5" style={{ color: SITE.safety, fontSize: 7 }}>
                    {s.small}
                  </span>
                )}
              </div>
              <div
                className="font-mono uppercase tracking-[0.18em] mt-px"
                style={{ color: SITE.concreteDim, fontSize: 5 }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Services preview — mirrors the real services-grid (3 of 6 visible) */}
        <div
          className="px-2.5 pt-2 pb-1.5 flex-1 flex flex-col"
          style={{ borderTop: `2px solid ${SITE.asphalt}`, background: SITE.concrete }}
        >
          <div className="flex items-end justify-between mb-1.5 pb-1" style={{ borderBottom: `1px solid ${SITE.asphalt}` }}>
            <span
              className="font-mono uppercase tracking-[0.18em]"
              style={{ color: SITE.rebar, fontSize: 5.5 }}
            >
              <span style={{ color: SITE.rust, marginRight: 4 }}>◆</span>
              Section / 01 — Capabilities
            </span>
            <span
              className="uppercase tracking-tight leading-none"
              style={{
                fontFamily: "'Archivo Black', Impact, sans-serif",
                color: SITE.asphalt,
                fontSize: 11,
              }}
            >
              What we <span style={{ color: SITE.rust }}>fix.</span>
            </span>
          </div>

          <div
            className="grid grid-cols-3"
            style={{ border: `2px solid ${SITE.asphalt}`, background: SITE.asphalt, gap: 2 }}
          >
            {[
              {
                no: "01",
                title: "EMERGENCY",
                desc: "24/7 dispatch.",
                bullets: ["Burst pipe", "Slab leak"],
                icon: (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={SITE.rust} strokeWidth="2.2" strokeLinecap="round">
                    <path d="M12 2 L4 14 L12 14 L10 22 L20 10 L12 10 Z" fill={SITE.rust} />
                  </svg>
                ),
              },
              {
                no: "02",
                title: "REPAIRS",
                desc: "Leak-free, guaranteed.",
                bullets: ["Drain clearing", "Faucet/toilet"],
                icon: (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={SITE.asphalt} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.7 6.3a4.6 4.6 0 0 0-6.5 0l-1.4 1.4a4.6 4.6 0 0 0 0 6.5l5.5 5.5a1 1 0 0 0 1.4 0l1.4-1.4a1 1 0 0 0 0-1.4l-1.6-1.6 1.6-1.6a3.5 3.5 0 0 0 0-5l-1.4-1.4Z" fill={SITE.safety} />
                    <circle cx="17" cy="7" r="2" fill={SITE.asphalt} />
                  </svg>
                ),
              },
              {
                no: "03",
                title: "INSTALLS",
                desc: "Tankless · re-pipe.",
                bullets: ["Water heater", "Whole-home"],
                icon: (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={SITE.asphalt} strokeWidth="2" strokeLinecap="round">
                    <rect x="6" y="3" width="12" height="14" rx="1.5" fill={SITE.safety} stroke={SITE.asphalt} />
                    <line x1="9" y1="7" x2="15" y2="7" stroke={SITE.asphalt} />
                    <line x1="9" y1="11" x2="15" y2="11" stroke={SITE.asphalt} />
                    <path d="M10 17 v3 M14 17 v3" stroke={SITE.asphalt} strokeWidth="2" />
                  </svg>
                ),
              },
            ].map((s, i) => (
              <div key={i} className="px-1.5 py-1.5 relative" style={{ background: SITE.concrete }}>
                <div
                  className="flex items-center justify-between mb-1"
                  style={{ fontFamily: "monospace", fontSize: 5.5, color: SITE.rebar, letterSpacing: "0.15em" }}
                >
                  <span>NO. {s.no}</span>
                  <span
                    className="flex items-center justify-center"
                    style={{
                      width: 12,
                      height: 12,
                      border: `1px solid ${SITE.asphalt}`,
                      fontSize: 7,
                      color: SITE.asphalt,
                      lineHeight: 1,
                    }}
                  >
                    ↗
                  </span>
                </div>
                <div className="flex items-start gap-1 mb-0.5">
                  {s.icon}
                  <div
                    style={{
                      fontFamily: "'Archivo Black', Impact, sans-serif",
                      fontSize: 9,
                      lineHeight: 0.9,
                      color: SITE.asphalt,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {s.title}
                  </div>
                </div>
                <p
                  className="leading-snug mb-1"
                  style={{ fontSize: 6.5, color: SITE.rebar }}
                >
                  {s.desc}
                </p>
                <ul
                  className="space-y-0.5"
                  style={{ fontFamily: "monospace", fontSize: 5.5, letterSpacing: "0.1em", color: SITE.asphalt }}
                >
                  {s.bullets.map((b) => (
                    <li
                      key={b}
                      className="uppercase pt-0.5"
                      style={{ borderTop: `1px dashed ${SITE.asphalt}40` }}
                    >
                      + {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Voicemail Drops ─── batch ringless drop with delivery feed ─── */
const RECIPIENTS = [
  { name: "Carlos M.", num: "(415) 555-0119", status: "Delivered", color: "text-emerald-400" },
  { name: "Tanya R.", num: "(628) 555-0203", status: "Delivered", color: "text-emerald-400" },
  { name: "James W.", num: "(415) 555-0188", status: "Delivered", color: "text-emerald-400" },
  { name: "Priya K.", num: "(650) 555-0142", status: "Sending…", color: "text-[var(--accent)]" },
  { name: "Mark D.", num: "(415) 555-0177", status: "Queued", color: "text-white/40" },
];

export function VoicemailDropMockup() {
  return (
    <div className="absolute inset-0 p-3 flex flex-col gap-2.5 text-[10px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, #d44429)` }}
          >
            <PhoneOff className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <div className="text-white/90 font-semibold text-[10px]">Reactivation Drop</div>
            <div className="text-white/40 text-[8.5px]">Ringless · 0:23 audio · 247 recipients</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <span className="text-emerald-400 text-[9px] font-medium">Sending</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Sent", value: "164" },
          { label: "Delivered", value: "152", trend: "92.7%" },
          { label: "Callbacks", value: "31", trend: "+18.9%" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-white/5 bg-[rgba(255,255,255,0.02)] p-2">
            <div className="text-white/40 text-[8.5px] uppercase tracking-wider mb-0.5">{s.label}</div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-white/90 text-base font-bold">{s.value}</span>
              {s.trend && (
                <span className="text-emerald-400 text-[8.5px] font-medium">{s.trend}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Audio waveform card */}
      <div className="rounded-lg border border-white/5 bg-[rgba(255,255,255,0.02)] p-2.5 flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, #d44429)` }}
        >
          <Mic className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-white/80 text-[9px] font-medium mb-1">"Hey, it's Mike from Acme Plumbing — checking in…"</div>
          <div className="flex items-end gap-0.5 h-4">
            {Array.from({ length: 32 }).map((_, i) => (
              <span
                key={i}
                className="flex-1 rounded-full"
                style={{
                  height: `${20 + Math.sin(i * 0.6) * 35 + Math.cos(i * 0.25) * 30}%`,
                  background: ACCENT,
                  opacity: 0.35 + (i % 4) * 0.18,
                  animation: "audioBar 1.4s ease-in-out infinite",
                  animationDelay: `${i * 45}ms`,
                }}
              />
            ))}
          </div>
        </div>
        <span className="text-white/40 text-[8.5px] font-mono">0:23</span>
      </div>

      {/* Recipients live feed */}
      <div className="flex-1 rounded-lg border border-white/5 bg-[rgba(255,255,255,0.02)] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/5">
          <span className="text-white/60 text-[9px] font-medium">Live delivery</span>
          <span className="text-white/30 text-[8.5px] font-mono">just now</span>
        </div>
        <div className="flex-1 divide-y divide-white/5">
          {RECIPIENTS.map((r) => (
            <div key={r.num} className="px-2.5 py-1.5 flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[8.5px] text-white/70 font-medium flex-shrink-0">
                {r.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white/85 text-[9.5px] font-medium truncate">{r.name}</div>
                <div className="text-white/40 text-[8.5px] font-mono">{r.num}</div>
              </div>
              <span className={`text-[8.5px] font-medium ${r.color}`}>{r.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
