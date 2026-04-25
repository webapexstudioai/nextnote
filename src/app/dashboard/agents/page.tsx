"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bot, Plus, Search, Trash2, Loader2, RefreshCw, AlertCircle,
  MoreVertical, Phone, MessageSquare, BarChart2, Settings2,
  Clock, CheckCircle2, TrendingUp,
  Mic, PhoneCall, PhoneOff, Link2, X, ChevronUp, ChevronDown, Coins,
} from "lucide-react";
import Link from "next/link";
import AgentTestWidget from "@/components/dashboard/AgentTestWidget";
import InsufficientCreditsModal from "@/components/dashboard/InsufficientCreditsModal";

interface ElevenAgent {
  agent_id: string;
  name: string;
  tags?: string[];
  created_at_unix_secs?: number;
  archived?: boolean;
  last_call_time_unix_secs?: number | null;
  last_7_day_call_count?: number;
  access_info?: {
    is_creator?: boolean;
    creator_name?: string;
    role?: string;
  };
}

type NavSection = "agents" | "test-agent" | "phone-numbers" | "call-history" | "analytics";

interface Conversation {
  conversation_id: string;
  agent_id?: string;
  agent_name?: string;
  status?: string;
  start_time_unix_secs?: number;
  end_time_unix_secs?: number;
  call_duration_secs?: number;
  transcript?: { role: string; message: string; time_in_call_secs?: number }[];
  analysis?: {
    call_successful?: string;
    transcript_summary?: string;
    user_sentiment?: string;
  };
  metadata?: {
    phone_call?: { from_number?: string; to_number?: string };
  };
}

interface PhoneNumber {
  phone_number_id: string;
  phone_number: string;
  label?: string;
  assigned_agent?: { agent_id: string; agent_name: string } | null;
  type?: string;
  supports_inbound?: boolean;
  supports_outbound?: boolean;
}

const NAV: { id: NavSection; label: string; icon: React.ElementType }[] = [
  { id: "agents", label: "My Agents", icon: Bot },
  { id: "test-agent", label: "Test Agent", icon: Mic },
  { id: "phone-numbers", label: "Phone Numbers", icon: Phone },
  { id: "call-history", label: "Call History", icon: MessageSquare },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
];

function formatTs(ts?: number | null) {
  if (!ts) return "Never";
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AgentsPage() {
  const [nav, setNav] = useState<NavSection>("agents");
  const [agents, setAgents] = useState<ElevenAgent[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loadingPhones, setLoadingPhones] = useState(false);
  const [showImportPhone, setShowImportPhone] = useState(false);
  const [importForm, setImportForm] = useState({ label: "", phone_number: "", sid: "", token: "" });
  const [importingPhone, setImportingPhone] = useState(false);
  const [importError, setImportError] = useState("");
  const [deletingPhoneId, setDeletingPhoneId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignAgentId, setAssignAgentId] = useState<string>("");
  const [showBuyNumber, setShowBuyNumber] = useState(false);
  const [buyForm, setBuyForm] = useState({ areaCode: "", country: "US" });
  const [searchingNumbers, setSearchingNumbers] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<{ phone_number: string; friendly_name: string; locality?: string; region?: string; capabilities?: { voice?: boolean; sms?: boolean } }[]>([]);
  const [purchasingNumber, setPurchasingNumber] = useState<string | null>(null);
  const [buyError, setBuyError] = useState("");
  const [buySuccess, setBuySuccess] = useState("");
  const [creditsPaywall, setCreditsPaywall] = useState<{ required: number; balance: number } | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [expandedConvId, setExpandedConvId] = useState<string | null>(null);
  const [convDetail, setConvDetail] = useState<Record<string, Conversation>>({});
  const [filterAgentId, setFilterAgentId] = useState("");
  const [deletingConvId, setDeletingConvId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number; openUp: boolean } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close the row-action menu when clicking outside of it.
  useEffect(() => {
    if (!menuId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuId(null);
      }
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuId(null); };
    const closeOnScroll = () => { setMenuId(null); setMenuAnchor(null); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnScroll);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", closeOnScroll);
    };
  }, [menuId]);
  const [mounted, setMounted] = useState(false);
  const [selectedTestAgentId, setSelectedTestAgentId] = useState("");

  const loadConversations = useCallback(async (agentId?: string) => {
    setLoadingConvs(true);
    try {
      const params = new URLSearchParams({ page_size: "50" });
      if (agentId) params.set("agent_id", agentId);
      const res = await fetch(`/api/agents/elevenlabs/conversations?${params}`);
      const data = await res.json();
      if (res.ok) setConversations(data.conversations || []);
    } catch {} finally { setLoadingConvs(false); }
  }, []);

  const loadPhones = useCallback(async () => {
    setLoadingPhones(true);
    try {
      const res = await fetch("/api/agents/elevenlabs/phone-numbers");
      const data = await res.json();
      if (res.ok) setPhoneNumbers(data.phoneNumbers || []);
    } catch {} finally { setLoadingPhones(false); }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [agentsRes, phonesRes] = await Promise.all([
        fetch("/api/agents/elevenlabs/list"),
        fetch("/api/agents/elevenlabs/phone-numbers"),
      ]);
      const agentsData = await agentsRes.json();
      const phonesData = await phonesRes.json();
      if (!agentsRes.ok) throw new Error(agentsData.error || "Failed to load agents");
      setAgents(agentsData.agents || []);
      setPhoneNumbers(phonesData.phoneNumbers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    load();
  }, [load]);

  async function handleDelete(agentId: string) {
    setDeletingId(agentId);
    try {
      await fetch(`/api/agents/elevenlabs/${agentId}`, { method: "DELETE" });
      setAgents((prev) => prev.filter((a) => a.agent_id !== agentId));
    } finally {
      setDeletingId(null);
      setMenuId(null);
    }
  }

  const filtered = useMemo(() =>
    agents.filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase())),
    [agents, search]
  );

  const totalCalls = agents.reduce((s, a) => s + (a.last_7_day_call_count || 0), 0);
  const activeAgents = agents.filter((a) => !a.archived).length;

  return (
    <div className={`flex flex-col h-full transition-all duration-700 ${mounted ? "opacity-100" : "opacity-0"}`}>
      {/* Top bar */}
      <header className="sticky top-0 z-30 liquid-glass-strong border-b border-white/5">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#e8553d] to-[#d44429] flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold">AI Agents</h1>
              <p className="text-[10px] text-[var(--muted)]">Your ElevenLabs voice agents</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/[0.04] transition-all">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            {nav === "agents" && (
              <Link href="/dashboard" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#e8553d] to-[#d44429] text-white text-xs font-semibold shadow-lg shadow-[#e8553d]/20 hover:from-[#f06a54] hover:to-[#e8553d] transition-all">
                <Plus className="w-3.5 h-3.5" /> Build Receptionist
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-4 p-4 sm:p-6 flex-1 overflow-hidden">
        {/* Sidebar nav */}
        <aside className="liquid-glass rounded-2xl p-2 lg:w-56 shrink-0 lg:self-start lg:sticky lg:top-24 flex lg:flex-col overflow-x-auto lg:overflow-x-visible gap-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setNav(id); if (id === "call-history" && conversations.length === 0) loadConversations(); }}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                nav === id
                  ? "bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30 shadow-[0_0_24px_rgba(232,85,61,0.18)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </aside>

        {/* Main content */}
        <main className="flex-1 liquid-glass rounded-2xl overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {loading && !error && (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
            </div>
          )}

          {/* ── Agents ── */}
          {!loading && !error && nav === "agents" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search agents..."
                    className="w-full pl-9 pr-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                </div>
                <span className="text-xs text-[var(--muted)]">{filtered.length} agent{filtered.length !== 1 ? "s" : ""}</span>
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-[var(--border)] p-12 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-[rgba(232,85,61,0.08)] border border-[rgba(232,85,61,0.15)] flex items-center justify-center mx-auto">
                    <Bot className="w-7 h-7 text-[var(--accent)]" />
                  </div>
                  <p className="font-semibold text-sm">No agents yet</p>
                  <p className="text-xs text-[var(--muted)]">Go to a prospect and click Build Receptionist to create your first AI agent.</p>
                  <Link href="/dashboard" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#e8553d] to-[#d44429] text-white text-sm font-semibold shadow-lg shadow-[#e8553d]/20 hover:from-[#f06a54] hover:to-[#e8553d] transition-all">
                    <Plus className="w-4 h-4" /> Build Receptionist
                  </Link>
                </div>
              ) : (
                <div className="liquid-glass rounded-2xl overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_100px_120px_100px_48px] gap-4 px-5 py-3 border-b border-[var(--border)] bg-[var(--background)]">
                    {["Agent Name", "Status", "Last Call", "7d Calls", ""].map((h) => (
                      <div key={h} className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">{h}</div>
                    ))}
                  </div>

                  {filtered.map((agent) => {
                    return (
                      <div key={agent.agent_id} className="border-b border-[var(--border)] last:border-0">
                        <Link
                          href={`/dashboard/agents/${agent.agent_id}`}
                          className="grid grid-cols-[1fr_100px_120px_100px_48px] gap-4 px-5 py-4 hover:bg-white/[0.04] transition-colors items-center group cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-[rgba(232,85,61,0.1)] flex items-center justify-center shrink-0">
                              <Bot className="w-3.5 h-3.5 text-[var(--accent)]" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{agent.name}</p>
                              <p className="text-[10px] text-[var(--muted)] font-mono truncate">{agent.agent_id}</p>
                            </div>
                          </div>
                          <div>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${agent.archived ? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}>
                              {agent.archived ? "Archived" : "Active"}
                            </span>
                          </div>
                          <div className="text-xs text-[var(--muted)]">{formatTs(agent.last_call_time_unix_secs)}</div>
                          <div className="text-sm font-semibold">{agent.last_7_day_call_count || 0}</div>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (menuId === agent.agent_id) {
                                  setMenuId(null);
                                  setMenuAnchor(null);
                                  return;
                                }
                                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                const MENU_HEIGHT = 88;
                                const openUp = window.innerHeight - rect.bottom < MENU_HEIGHT + 16;
                                setMenuAnchor({
                                  top: openUp ? rect.top - MENU_HEIGHT - 4 : rect.bottom + 4,
                                  left: rect.right - 144,
                                  openUp,
                                });
                                setMenuId(agent.agent_id);
                              }}
                              className="p-1.5 rounded-lg hover:bg-[var(--border)] transition-colors"
                              aria-label="Agent actions"
                            >
                              <MoreVertical className="w-4 h-4 text-[var(--muted)]" />
                            </button>
                            <Settings2 className="w-4 h-4 text-[var(--muted)]" />
                          </div>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Test Agent ── */}
          {!loading && !error && nav === "test-agent" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-semibold">Test Agent</h2>
                <p className="text-xs text-[var(--muted)] mt-1">Pick an agent and have a real-time voice conversation. Editing lives under My Agents.</p>
              </div>

              <div className="liquid-glass rounded-2xl p-5 max-w-xl">
                <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Select Agent</label>
                <select
                  value={selectedTestAgentId}
                  onChange={(e) => setSelectedTestAgentId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm"
                >
                  <option value="">Choose an agent...</option>
                  {agents.map((agent) => (
                    <option key={agent.agent_id} value={agent.agent_id}>{agent.name}</option>
                  ))}
                </select>
              </div>

              {selectedTestAgentId ? (
                <AgentTestWidget
                  key={selectedTestAgentId}
                  agentId={selectedTestAgentId}
                  agentName={agents.find((a) => a.agent_id === selectedTestAgentId)?.name}
                />
              ) : (
                <div className="liquid-glass rounded-2xl border-dashed p-10 text-center text-sm text-[var(--muted)]">
                  Choose an agent above to start a live test.
                </div>
              )}
            </div>
          )}

          {/* ── Phone Numbers ── */}
          {nav === "phone-numbers" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-semibold">Phone Numbers</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setShowBuyNumber(!showBuyNumber); setShowImportPhone(false); setBuyError(""); setBuySuccess(""); setAvailableNumbers([]); }}
                    data-tour-id="agents-buy-number"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-xs hover:bg-white/[0.04] transition-all">
                    <Phone className="w-3.5 h-3.5 text-[var(--accent)]" /> Buy a Number
                  </button>
                  <button onClick={() => { setShowImportPhone(true); setShowBuyNumber(false); setImportError(""); setImportForm({ label: "", phone_number: "", sid: "", token: "" }); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#e8553d] to-[#d44429] text-white text-xs font-semibold shadow-lg shadow-[#e8553d]/20 transition-all">
                    <Plus className="w-3.5 h-3.5" /> Import Number
                  </button>
                </div>
              </div>

              {showBuyNumber && (
                <div className="liquid-glass rounded-2xl p-5 space-y-4 border border-[rgba(232,85,61,0.18)] animate-[fadeInUp_0.3s_ease-out]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2"><Phone className="w-4 h-4 text-[var(--accent)]" /> Buy a Phone Number</h3>
                    <button onClick={() => setShowBuyNumber(false)} className="p-1.5 rounded-lg hover:bg-white/[0.04]"><X className="w-4 h-4" /></button>
                  </div>
                  <p className="text-xs text-[var(--muted)]">Pick an area code, find an available number, and attach it to an agent.</p>
                  <div className="rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/5 px-3 py-2 text-[11px] text-[var(--muted)] flex items-center gap-2">
                    <Coins className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                    <span><span className="text-[var(--foreground)] font-semibold">500 credits</span> (~$5) to buy · then <span className="text-[var(--foreground)] font-semibold">500 credits/mo</span> (~$5) to keep the line active. Cancel anytime by releasing the number.</span>
                  </div>
                  {buyError && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{buyError}</div>}
                  {buySuccess && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">{buySuccess}</div>}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Area Code <span className="text-[var(--muted)]/60 normal-case font-normal">(optional)</span></label>
                      <input value={buyForm.areaCode} onChange={(e) => setBuyForm((p) => ({ ...p, areaCode: e.target.value }))} placeholder="e.g. 312, 773, 415" className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Country</label>
                      <select value={buyForm.country} onChange={(e) => setBuyForm((p) => ({ ...p, country: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm">
                        <option value="US">United States</option>
                        <option value="CA">Canada</option>
                        <option value="GB">United Kingdom</option>
                        <option value="AU">Australia</option>
                      </select>
                    </div>
                  </div>
                  <button
                    disabled={searchingNumbers}
                    onClick={async () => {
                      setSearchingNumbers(true); setBuyError(""); setAvailableNumbers([]);
                      try {
                        const res = await fetch("/api/agents/twilio/available-numbers", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(buyForm),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error);
                        setAvailableNumbers(data.numbers || []);
                      } catch (err) { setBuyError(err instanceof Error ? err.message : "Search failed"); }
                      finally { setSearchingNumbers(false); }
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] text-sm font-medium hover:bg-white/[0.04] transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {searchingNumbers ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching...</> : <><Search className="w-4 h-4" /> Search Available Numbers</>}
                  </button>

                  {availableNumbers.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold">{availableNumbers.length} numbers found — click to purchase</p>
                      <div className="rounded-2xl border border-[var(--border)] overflow-hidden max-h-72 overflow-y-auto">
                        {availableNumbers.map((num) => (
                          <div key={num.phone_number} className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] last:border-0 hover:bg-white/[0.04] transition-colors">
                            <div>
                              <p className="text-sm font-medium">{num.friendly_name || num.phone_number}</p>
                              <p className="text-[10px] text-[var(--muted)]">{[num.locality, num.region].filter(Boolean).join(", ") || "US"}</p>
                            </div>
                            <button
                              disabled={purchasingNumber === num.phone_number}
                              onClick={async () => {
                                setPurchasingNumber(num.phone_number); setBuyError(""); setBuySuccess("");
                                try {
                                  const res = await fetch("/api/agents/twilio/purchase-number", {
                                    method: "POST", headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ phoneNumber: num.phone_number }),
                                  });
                                  const data = await res.json();
                                  if (res.status === 402 && typeof data?.required === "number" && typeof data?.balance === "number") {
                                    setCreditsPaywall({ required: data.required, balance: data.balance });
                                    return;
                                  }
                                  if (!res.ok) throw new Error(data.error);
                                  setBuySuccess(`${num.phone_number} purchased and imported!`);
                                  setAvailableNumbers([]);
                                  setShowBuyNumber(false);
                                  await loadPhones();
                                } catch (err) { setBuyError(err instanceof Error ? err.message : "Purchase failed"); }
                                finally { setPurchasingNumber(null); }
                              }}
                              className="px-3 py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-semibold hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                            >
                              {purchasingNumber === num.phone_number ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5" />}
                              Buy · 500 cr
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {showImportPhone && (
                <div className="liquid-glass rounded-2xl p-5 space-y-4 border border-[rgba(232,85,61,0.18)]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2"><Link2 className="w-4 h-4 text-[var(--accent)]" /> Import Twilio Number</h3>
                    <button onClick={() => setShowImportPhone(false)} className="p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                  <p className="text-xs text-[var(--muted)]">Connect a Twilio phone number to route calls to your AI agent. You need your Twilio Account SID and Auth Token.</p>
                  {importError && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{importError}</div>}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Label</label>
                      <input value={importForm.label} onChange={(e) => setImportForm((p) => ({ ...p, label: e.target.value }))} placeholder="e.g. Main Reception Line" className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Phone Number</label>
                      <input value={importForm.phone_number} onChange={(e) => setImportForm((p) => ({ ...p, phone_number: e.target.value }))} placeholder="+1 555 000 0000" className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Twilio Account SID</label>
                      <input value={importForm.sid} onChange={(e) => setImportForm((p) => ({ ...p, sid: e.target.value }))} placeholder="ACxxxxxxxxxxxxxxxx" className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm font-mono" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Twilio Auth Token</label>
                      <input type="password" value={importForm.token} onChange={(e) => setImportForm((p) => ({ ...p, token: e.target.value }))} placeholder="••••••••••••••••" className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowImportPhone(false)} className="px-4 py-3 rounded-xl border border-[var(--border)] text-sm hover:bg-white/[0.04] transition-colors">Cancel</button>
                    <button
                      disabled={importingPhone || !importForm.phone_number || !importForm.sid || !importForm.token}
                      onClick={async () => {
                        setImportingPhone(true);
                        setImportError("");
                        try {
                          const res = await fetch("/api/agents/elevenlabs/phone-numbers", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              label: importForm.label,
                              phone_number: importForm.phone_number,
                              sid: importForm.sid,
                              token: importForm.token,
                            }),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || "Failed to import");
                          setShowImportPhone(false);
                          await loadPhones();
                        } catch (err) {
                          setImportError(err instanceof Error ? err.message : "Failed to import number");
                        } finally { setImportingPhone(false); }
                      }}
                      className="flex-1 px-4 py-3 rounded-xl bg-[var(--accent)] text-white text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:bg-[var(--accent-hover)]"
                    >
                      {importingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                      {importingPhone ? "Importing..." : "Import Number"}
                    </button>
                  </div>
                </div>
              )}

              {loadingPhones ? (
                <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" /></div>
              ) : phoneNumbers.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-[var(--border)] p-12 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-[rgba(232,85,61,0.08)] flex items-center justify-center mx-auto"><Phone className="w-7 h-7 text-[var(--accent)]" /></div>
                  <p className="font-semibold text-sm">No phone numbers yet</p>
                  <p className="text-xs text-[var(--muted)]">Import a Twilio number to let your agent receive and make calls.</p>
                </div>
              ) : (
                <div className="liquid-glass rounded-2xl overflow-hidden">
                  <div className="grid grid-cols-[1fr_120px_180px_100px_48px] gap-4 px-5 py-3 border-b border-[var(--border)] bg-[var(--background)]">
                    {["Number", "Type", "Assigned Agent", "Capabilities", ""].map((h) => (
                      <div key={h} className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">{h}</div>
                    ))}
                  </div>
                  {phoneNumbers.map((phone) => (
                    <div key={phone.phone_number_id} className="grid grid-cols-[1fr_120px_180px_100px_48px] gap-4 px-5 py-4 border-b border-[var(--border)] last:border-0 hover:bg-white/[0.04] transition-colors items-center">
                      <div>
                        <p className="text-sm font-medium">{phone.phone_number}</p>
                        <p className="text-[10px] text-[var(--muted)]">{phone.label || "—"}</p>
                      </div>
                      <div><span className="inline-flex px-2 py-0.5 rounded-full text-[10px] border bg-blue-500/10 text-blue-400 border-blue-500/20">{phone.type || "Twilio"}</span></div>
                      <div>
                        {phone.assigned_agent ? (
                          <span className="text-xs text-emerald-400 font-medium truncate block">{phone.assigned_agent.agent_name}</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <select
                              value={assigningId === phone.phone_number_id ? assignAgentId : ""}
                              onChange={(e) => { setAssigningId(phone.phone_number_id); setAssignAgentId(e.target.value); }}
                              className="flex-1 px-2 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-xs"
                            >
                              <option value="">Assign agent...</option>
                              {agents.map((a) => <option key={a.agent_id} value={a.agent_id}>{a.name}</option>)}
                            </select>
                            {assigningId === phone.phone_number_id && assignAgentId && (
                              <button
                                onClick={async () => {
                                  const res = await fetch(`/api/agents/elevenlabs/phone-numbers/${phone.phone_number_id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ agent_id: assignAgentId }),
                                  });
                                  if (res.ok) { setAssigningId(null); setAssignAgentId(""); await loadPhones(); }
                                }}
                                className="px-2 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-[10px] hover:bg-emerald-500/30 transition-colors"
                              >
                                Save
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        {phone.supports_inbound !== false && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><PhoneCall className="w-3 h-3 inline" /></span>}
                        {phone.supports_outbound !== false && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20"><PhoneOff className="w-3 h-3 inline" /></span>}
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={async () => {
                            if (!confirm("Remove this number?")) return;
                            setDeletingPhoneId(phone.phone_number_id);
                            await fetch(`/api/agents/elevenlabs/phone-numbers/${phone.phone_number_id}`, { method: "DELETE" });
                            setPhoneNumbers((prev) => prev.filter((p) => p.phone_number_id !== phone.phone_number_id));
                            setDeletingPhoneId(null);
                          }}
                          disabled={deletingPhoneId === phone.phone_number_id}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                          {deletingPhoneId === phone.phone_number_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Call History ── */}
          {nav === "call-history" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-sm font-semibold">Call History</h2>
                <div className="flex items-center gap-3">
                  <select
                    value={filterAgentId}
                    onChange={(e) => { setFilterAgentId(e.target.value); loadConversations(e.target.value || undefined); }}
                    className="px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="">All Agents</option>
                    {agents.map((a) => <option key={a.agent_id} value={a.agent_id}>{a.name}</option>)}
                  </select>
                  <button onClick={() => loadConversations(filterAgentId || undefined)} disabled={loadingConvs}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-xs hover:bg-white/[0.04] transition-all">
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingConvs ? "animate-spin" : ""}`} /> Refresh
                  </button>
                </div>
              </div>

              {conversations.length === 0 && !loadingConvs && (
                <div className="rounded-2xl border-2 border-dashed border-[var(--border)] p-12 text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-[rgba(232,85,61,0.08)] flex items-center justify-center mx-auto"><MessageSquare className="w-7 h-7 text-[var(--accent)]" /></div>
                  <p className="font-semibold text-sm">No calls yet</p>
                  <p className="text-xs text-[var(--muted)]">Conversations will appear here once your agents start receiving calls.</p>
                  <button onClick={() => loadConversations()} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm hover:bg-white/[0.04] transition-all">
                    <RefreshCw className="w-4 h-4" /> Load Conversations
                  </button>
                </div>
              )}

              {loadingConvs && (
                <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" /></div>
              )}

              {conversations.length > 0 && (
                <div className="liquid-glass rounded-2xl overflow-hidden">
                  <div className="grid grid-cols-[1fr_120px_110px_100px_90px_48px] gap-4 px-5 py-3 border-b border-[var(--border)] bg-[var(--background)]">
                    {["Caller / ID", "Agent", "Duration", "Status", "Sentiment", ""].map((h) => (
                      <div key={h} className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">{h}</div>
                    ))}
                  </div>
                  {conversations.map((conv) => {
                    const isExp = expandedConvId === conv.conversation_id;
                    const detail = convDetail[conv.conversation_id];
                    const dur = conv.call_duration_secs
                      ? `${Math.floor(conv.call_duration_secs / 60)}m ${conv.call_duration_secs % 60}s`
                      : "—";
                    const sentiment = conv.analysis?.user_sentiment;
                    const success = conv.analysis?.call_successful;
                    return (
                      <div key={conv.conversation_id} className="border-b border-[var(--border)] last:border-0">
                        <div
                          className="grid grid-cols-[1fr_120px_110px_100px_90px_48px] gap-4 px-5 py-4 hover:bg-white/[0.04] transition-colors items-center cursor-pointer group"
                          onClick={async () => {
                            const next = isExp ? null : conv.conversation_id;
                            setExpandedConvId(next);
                            if (next && !convDetail[next]) {
                              const res = await fetch(`/api/agents/elevenlabs/conversations/${next}`);
                              const data = await res.json();
                              if (res.ok) setConvDetail((prev) => ({ ...prev, [next]: data }));
                            }
                          }}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{conv.metadata?.phone_call?.from_number || conv.conversation_id.slice(0, 16) + "..."}</p>
                            {conv.start_time_unix_secs && (
                              <p className="text-[10px] text-[var(--muted)]">
                                {new Date(conv.start_time_unix_secs * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                              </p>
                            )}
                          </div>
                          <div className="text-xs text-[var(--muted)] truncate">{conv.agent_name || "—"}</div>
                          <div className="text-xs font-medium">{dur}</div>
                          <div>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                              success === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                              success === "failure" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                              "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                            }`}>
                              {success === "success" ? "Success" : success === "failure" ? "Failed" : conv.status || "Done"}
                            </span>
                          </div>
                          <div className="text-xs text-[var(--muted)] capitalize">{sentiment || "—"}</div>
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={async (e) => { e.stopPropagation(); if (!confirm("Delete this conversation?")) return; setDeletingConvId(conv.conversation_id); await fetch(`/api/agents/elevenlabs/conversations/${conv.conversation_id}`, { method: "DELETE" }); setConversations((prev) => prev.filter((c) => c.conversation_id !== conv.conversation_id)); setDeletingConvId(null); }}
                              disabled={deletingConvId === conv.conversation_id}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                            >
                              {deletingConvId === conv.conversation_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                            {isExp ? <ChevronUp className="w-4 h-4 text-[var(--muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--muted)]" />}
                          </div>
                        </div>
                        {isExp && (
                          <div className="border-t border-[var(--border)] px-5 py-5 bg-[var(--background)] space-y-4 animate-[fadeInUp_0.2s_ease-out]">
                            {!detail ? (
                              <div className="flex items-center gap-2 text-xs text-[var(--muted)]"><Loader2 className="w-4 h-4 animate-spin" /> Loading transcript...</div>
                            ) : (
                              <>
                                {detail.analysis?.transcript_summary && (
                                  <div className="rounded-2xl border border-[rgba(232,85,61,0.18)] bg-[rgba(232,85,61,0.06)] p-4">
                                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-2">Summary</p>
                                    <p className="text-sm leading-6">{detail.analysis.transcript_summary}</p>
                                  </div>
                                )}
                                {detail.transcript && detail.transcript.length > 0 && (
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-3">Transcript</p>
                                    <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                                      {detail.transcript.map((line, idx) => (
                                        <div key={idx} className={`flex ${line.role === "user" ? "justify-end" : "justify-start"}`}>
                                          <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                                            line.role === "user"
                                              ? "bg-[var(--accent)] text-white"
                                              : "liquid-glass text-[var(--foreground)]"
                                          }`}>
                                            {line.message}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Analytics ── */}
          {!loading && !error && nav === "analytics" && (
            <div className="space-y-5">
              <h2 className="text-sm font-semibold">Agent Analytics</h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: "Total Agents", value: agents.length, icon: Bot, color: "text-[var(--accent)]" },
                  { label: "Active Agents", value: activeAgents, icon: CheckCircle2, color: "text-emerald-400" },
                  { label: "Calls (7 days)", value: totalCalls, icon: Phone, color: "text-blue-400" },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="liquid-glass rounded-2xl p-5">
                    <div className={`w-9 h-9 rounded-xl bg-[var(--card-hover)] flex items-center justify-center mb-3 ${color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="text-xs text-[var(--muted)] mt-1">{label}</p>
                  </div>
                ))}
              </div>
              <div className="liquid-glass rounded-2xl p-5">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[var(--accent)]" /> Per Agent Activity</h3>
                {agents.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No agents to display.</p>
                ) : (
                  <div className="space-y-3">
                    {agents.map((a) => (
                      <div key={a.agent_id} className="flex items-center gap-4">
                        <div className="w-7 h-7 rounded-lg bg-[rgba(232,85,61,0.1)] flex items-center justify-center shrink-0"><Bot className="w-3.5 h-3.5 text-[var(--accent)]" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{a.name}</p>
                          <div className="h-1.5 rounded-full bg-[var(--background)] mt-1 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-[#e8553d] to-[#ff8a6a] rounded-full" style={{ width: `${Math.min(((a.last_7_day_call_count || 0) / Math.max(totalCalls, 1)) * 100, 100)}%` }} />
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-[var(--accent)] shrink-0">{a.last_7_day_call_count || 0}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>

      {mounted && menuId && menuAnchor && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: menuAnchor.top, left: menuAnchor.left, width: 144 }}
          className="bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-xl z-[100] py-1 animate-[fadeInUp_0.15s_ease-out]"
        >
          <button
            onClick={() => { setSelectedTestAgentId(menuId); setNav("test-agent"); setMenuId(null); setMenuAnchor(null); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[var(--foreground)] hover:bg-white/[0.04] transition-colors"
          >
            <Mic className="w-3.5 h-3.5 text-[var(--accent)]" /> Test Agent
          </button>
          <button
            onClick={() => { handleDelete(menuId); setMenuAnchor(null); }}
            disabled={deletingId === menuId}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
          >
            {deletingId === menuId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete Agent
          </button>
        </div>,
        document.body
      )}

      <InsufficientCreditsModal
        open={creditsPaywall !== null}
        onClose={() => setCreditsPaywall(null)}
        required={creditsPaywall?.required ?? 0}
        balance={creditsPaywall?.balance ?? 0}
        action="Buying a phone number"
      />
    </div>
  );
}
