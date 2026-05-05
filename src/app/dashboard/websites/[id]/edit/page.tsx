"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Wand2, Send, MousePointerClick, MessageSquare,
  Save, RotateCcw, ExternalLink, Check, Globe2,
} from "lucide-react";
import InsufficientCreditsModal from "@/components/dashboard/InsufficientCreditsModal";
import CustomDomainModal from "@/components/dashboard/CustomDomainModal";

const WEBSITE_AI_EDIT_CREDITS = 15;
const WHITELABEL_HOST = "pitchsite.dev";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  // Present while a streaming edit is in progress; cleared when done.
  progress?: {
    phase: string;
    applied?: number;
    total?: number;
  } | null;
};

const PHASE_LABEL: Record<string, string> = {
  reading: "Reading your site",
  planning: "Planning the changes",
  applying: "Applying changes",
  saving: "Saving to your site",
};

const EDITABLE_TAGS = [
  "H1", "H2", "H3", "H4", "H5", "H6",
  "P", "SPAN", "A", "BUTTON",
  "LI", "BLOCKQUOTE", "LABEL",
  "DT", "DD", "FIGCAPTION", "SMALL",
];
const INLINE_CHILDREN_OK = new Set(["BR", "STRONG", "EM", "B", "I", "U", "MARK", "SPAN", "SMALL"]);

export default function WebsiteEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const siteId = params.id;

  const [mode, setMode] = useState<"chat" | "visual">("chat");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [instruction, setInstruction] = useState("");
  const [applying, setApplying] = useState(false);
  const [creditsPaywall, setCreditsPaywall] = useState<{ required: number; balance: number } | null>(null);

  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [visualDirty, setVisualDirty] = useState(false);
  const [siteMeta, setSiteMeta] = useState<{ tier: "standard" | "whitelabel"; slug: string | null; prospectName: string | null } | null>(null);
  const [domainModalOpen, setDomainModalOpen] = useState(false);
  const [attachedDomain, setAttachedDomain] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [iframeVersion, setIframeVersion] = useState(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    // Prime: website exists and loads + fetch tier/slug for the Open button.
    const prime = async () => {
      const [previewRes, metaRes, domainRes] = await Promise.all([
        fetch(`/api/websites/${siteId}`, { cache: "no-store", method: "HEAD" }),
        fetch(`/api/websites/${siteId}/meta`, { cache: "no-store" }),
        fetch(`/api/websites/${siteId}/domain`, { cache: "no-store" }),
      ]);
      if (!previewRes.ok) setError("Failed to load website");
      if (metaRes.ok) {
        const m = await metaRes.json();
        setSiteMeta({ tier: m.tier, slug: m.slug ?? null, prospectName: m.prospect_name ?? null });
      }
      if (domainRes.ok) {
        const d = await domainRes.json();
        if (d.status === "verified" && d.domain) setAttachedDomain(d.domain);
      }
      setLoading(false);
    };
    prime();
  }, [siteId]);

  // Stripe checkout completion: drop a confirmation message into chat and
  // poll the domain endpoint for ~30s while Vercel finishes registration.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const purchase = params.get("domain_purchase");
    if (!purchase) return;
    // Strip the param so refreshes don't re-fire.
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);

    if (purchase === "canceled") {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Domain purchase canceled. No charge was made.", timestamp: Date.now() },
      ]);
      return;
    }

    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        text: "Payment received — registering your domain now. This usually takes under a minute…",
        timestamp: Date.now(),
        progress: { phase: "registering" },
      },
    ]);

    let tries = 0;
    const poll = async () => {
      tries++;
      try {
        const res = await fetch(`/api/websites/${siteId}/domain`, { cache: "no-store" });
        if (res.ok) {
          const d = await res.json();
          if (d.domain) {
            setAttachedDomain(d.status === "verified" ? d.domain : null);
            setMessages((m) =>
              m.map((msg) =>
                msg.progress?.phase === "registering"
                  ? {
                      ...msg,
                      text: d.status === "verified"
                        ? `✓ ${d.domain} is registered and live.`
                        : `✓ ${d.domain} is registered. Vercel is finishing the SSL certificate — usually a few more minutes.`,
                      progress: null,
                    }
                  : msg,
              ),
            );
            return;
          }
        }
      } catch {
        // ignore — keep polling
      }
      if (tries < 15) setTimeout(poll, 2000);
      else {
        setMessages((m) =>
          m.map((msg) =>
            msg.progress?.phase === "registering"
              ? { ...msg, text: "Domain payment cleared, but registration is taking longer than usual. Refresh in a minute or two.", progress: null }
              : msg,
          ),
        );
      }
    };
    setTimeout(poll, 1500);
  }, [siteId]);

  const openHref = siteMeta?.tier === "whitelabel" && siteMeta.slug
    ? `https://${siteMeta.slug}.${WHITELABEL_HOST}`
    : `/api/websites/${siteId}`;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, applying]);

  const refreshPreview = () => {
    setVisualDirty(false);
    // Use a timestamp instead of a small counter so the URL is guaranteed unique
    // — defeats any intermediate cache that might key on `?v=N` we already used.
    setIframeVersion(Date.now());
  };

  const applyVisualEditMode = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;

    // Remove previous editor styles so toggles are idempotent.
    doc.querySelectorAll("style[data-nn-editor]").forEach((s) => s.remove());
    doc.querySelectorAll("[data-nn-editable]").forEach((el) => {
      el.removeAttribute("contenteditable");
      el.removeAttribute("data-nn-editable");
    });

    if (modeRef.current !== "visual") return;

    const style = doc.createElement("style");
    style.setAttribute("data-nn-editor", "true");
    style.textContent = `
      [data-nn-editable] { transition: outline 0.12s ease, background 0.12s ease; }
      [data-nn-editable]:hover { outline: 2px dashed #6366f1 !important; outline-offset: 3px; cursor: text; }
      [data-nn-editable]:focus { outline: 2px solid #6366f1 !important; outline-offset: 3px; background: rgba(99,102,241,0.08) !important; }
      a[data-nn-editable], button[data-nn-editable] { pointer-events: auto !important; }
    `;
    doc.head.appendChild(style);

    const markEditable = (el: Element) => {
      if (!el.textContent?.trim()) return;
      // Only mark leaf-ish elements — all children are text or allowed inline formatting.
      const allInlineOk = Array.from(el.childNodes).every((n) => {
        if (n.nodeType === 3) return true;
        if (n.nodeType === 1) return INLINE_CHILDREN_OK.has((n as Element).tagName);
        return false;
      });
      if (!allInlineOk) return;
      el.setAttribute("contenteditable", "true");
      el.setAttribute("data-nn-editable", "true");
    };

    EDITABLE_TAGS.forEach((tag) => {
      doc.querySelectorAll(tag.toLowerCase()).forEach(markEditable);
    });

    // Block navigation on anchors / form submits while editing.
    const blockNav = (e: Event) => {
      const t = e.target as Element | null;
      if (!t) return;
      const anchor = t.closest("a");
      if (anchor) e.preventDefault();
    };
    doc.addEventListener("click", blockNav, true);

    const dirtyHandler = () => setVisualDirty(true);
    doc.body.addEventListener("input", dirtyHandler);

    // Force plain-text paste inside editable elements.
    const plainPaste = (e: ClipboardEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest("[data-nn-editable]")) return;
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain") ?? "";
      doc.execCommand("insertText", false, text);
    };
    doc.addEventListener("paste", plainPaste, true);

    // Stash cleanup on the doc so we can detach on remount.
    (doc as unknown as { __nnCleanup?: () => void }).__nnCleanup = () => {
      doc.removeEventListener("click", blockNav, true);
      doc.body.removeEventListener("input", dirtyHandler);
      doc.removeEventListener("paste", plainPaste, true);
    };
  }, []);

  const handleIframeLoad = () => {
    applyVisualEditMode();
  };

  // Re-apply edit mode when mode toggles without reloading the iframe.
  useEffect(() => {
    applyVisualEditMode();
  }, [mode, applyVisualEditMode]);

  const extractCleanedHtml = (): string | null => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.documentElement) return null;
    const clone = doc.documentElement.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("[data-nn-editable]").forEach((el) => {
      el.removeAttribute("contenteditable");
      el.removeAttribute("data-nn-editable");
    });
    clone.querySelectorAll("style[data-nn-editor]").forEach((el) => el.remove());
    return `<!DOCTYPE html>\n${clone.outerHTML}`;
  };

  const handleApplyAI = async () => {
    const text = instruction.trim();
    if (!text || applying) return;
    if (visualDirty) {
      setError("Save or revert your visual edits before using AI chat.");
      return;
    }
    setApplying(true);
    setError("");
    const placeholderTs = Date.now() + 1;
    setMessages((m) => [
      ...m,
      { role: "user", text, timestamp: Date.now() },
      {
        role: "assistant",
        text: "Reading your site…",
        timestamp: placeholderTs,
        progress: { phase: "reading" },
      },
    ]);
    setInstruction("");

    const updatePlaceholder = (
      patch: Partial<ChatMessage> | ((prev: ChatMessage) => ChatMessage),
    ) => {
      setMessages((m) =>
        m.map((msg) => {
          if (msg.timestamp !== placeholderTs) return msg;
          return typeof patch === "function" ? patch(msg) : { ...msg, ...patch };
        }),
      );
    };

    try {
      const res = await fetch(`/api/websites/${siteId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: text }),
      });

      // Non-streaming responses (auth, paywall, validation, domain redirect) come back as JSON.
      const contentType = res.headers.get("Content-Type") || "";
      if (!contentType.includes("text/event-stream")) {
        const data = await res.json().catch(() => ({}));
        // Domain operations are redirected to the modal — show the explanation as
        // a normal assistant reply (no warning) and pop the modal open.
        if (res.ok && data.kind === "domain_redirect") {
          const message = typeof data.message === "string"
            ? data.message
            : "Domains live in the Connect domain button — opening it now.";
          updatePlaceholder({ text: message, progress: null });
          setDomainModalOpen(true);
          return;
        }
        if (res.status === 402 && typeof data.required === "number" && typeof data.balance === "number") {
          setCreditsPaywall({ required: data.required, balance: data.balance });
          // Drop the user prompt + placeholder so the chat doesn't show a dangling request.
          setMessages((m) => m.filter((msg) => msg.timestamp !== placeholderTs).slice(0, -1));
          return;
        }
        const errMsg = data.error || "Edit failed";
        updatePlaceholder({ text: `⚠ ${errMsg}`, progress: null });
        setError(errMsg);
        return;
      }

      if (!res.body) {
        updatePlaceholder({ text: "⚠ Streaming not supported", progress: null });
        setError("Streaming not supported");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      let gotTerminal = false;

      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line.
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          if (!frame.trim()) continue;

          let event = "message";
          let dataLine = "";
          for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
          }
          if (!dataLine) continue;

          let payload: Record<string, unknown> = {};
          try { payload = JSON.parse(dataLine); } catch { continue; }

          if (event === "step") {
            const phase = String(payload.phase || "");
            const label = String(payload.label || PHASE_LABEL[phase] || phase);
            updatePlaceholder((prev) => ({
              ...prev,
              text: label,
              progress: {
                phase,
                applied: prev.progress?.applied,
                total: prev.progress?.total,
              },
            }));
          } else if (event === "progress") {
            const applied = Number(payload.applied ?? 0);
            const total = Number(payload.total ?? applied);
            updatePlaceholder((prev) => ({
              ...prev,
              progress: { phase: prev.progress?.phase || "applying", applied, total },
            }));
          } else if (event === "done") {
            const credits = Number(payload.creditsCharged ?? WEBSITE_AI_EDIT_CREDITS);
            const summary = typeof payload.summary === "string" ? payload.summary : "";
            const applied = Number(payload.applied ?? 0);
            const failed = Number(payload.failed ?? 0);
            const diffs = Array.isArray(payload.diffs)
              ? (payload.diffs as Array<{ find?: string; replace?: string; all?: boolean }>)
              : [];
            const failedNote = failed > 0 ? ` (${failed} skipped)` : "";
            const summaryNote = summary ? `\n${summary}` : "";
            const diffNote = diffs.length
              ? "\n\nChanges:\n" +
                diffs
                  .map((d) => {
                    const f = (d.find ?? "").replace(/\s+/g, " ").trim();
                    const r = (d.replace ?? "").replace(/\s+/g, " ").trim();
                    const arrow = d.all ? " ⇢ " : " → ";
                    return `• "${f}"${arrow}"${r}"`;
                  })
                  .join("\n")
              : "";
            updatePlaceholder({
              text: `✓ Applied ${applied} change${applied === 1 ? "" : "s"}${failedNote}. Charged ${credits} credits.${summaryNote}${diffNote}`,
              progress: null,
            });
            refreshPreview();
            finished = true;
            gotTerminal = true;
          } else if (event === "error") {
            const errMsg = String(payload.error || "Edit failed");
            updatePlaceholder({ text: `⚠ ${errMsg}`, progress: null });
            setError(errMsg);
            finished = true;
            gotTerminal = true;
          }
        }
      }

      // Stream ended without a done/error event — function timeout, dropped
      // connection, or proxy buffer flushed late. Surface it instead of leaving
      // the user staring at a half-finished phase label.
      if (!gotTerminal) {
        const errMsg = "The edit timed out before completing. Try a smaller change.";
        updatePlaceholder({ text: `⚠ ${errMsg}`, progress: null });
        setError(errMsg);
      }
    } catch {
      setError("Network error");
      updatePlaceholder({ text: "⚠ Network error", progress: null });
    } finally {
      setApplying(false);
    }
  };

  const handleSaveVisual = async () => {
    if (saving || !visualDirty) return;
    const html = extractCleanedHtml();
    if (!html) {
      setError("Nothing to save.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/websites/${siteId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        return;
      }
      setVisualDirty(false);
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1800);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleRevertVisual = () => {
    if (!visualDirty) return;
    refreshPreview();
  };

  return (
    <>
      <header className="sticky top-0 z-30 liquid-glass-strong border-b border-white/5">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                if (visualDirty && !confirm("You have unsaved visual edits. Leave anyway?")) return;
                router.push("/dashboard/websites");
              }}
              className="p-2 rounded-lg hover:bg-white/5 text-[var(--muted)] shrink-0"
              title="Back to websites"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight truncate">Edit Website</h1>
              <p className="text-xs text-[var(--muted)] mt-0.5 truncate">
                Click any text to edit it directly. Big changes? Ask the AI ({WEBSITE_AI_EDIT_CREDITS} credits each).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setDomainModalOpen(true)}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors ${
                attachedDomain
                  ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30"
                  : "bg-white/5 hover:bg-white/10"
              }`}
              title={attachedDomain ? `Connected: ${attachedDomain}` : "Connect your own domain"}
            >
              <Globe2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{attachedDomain ? "Domain" : "Connect domain"}</span>
            </button>
            <a
              href={attachedDomain ? `https://${attachedDomain}` : openHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open
            </a>
          </div>
        </div>
      </header>

      <div className="relative z-10 p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--muted)]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4 min-h-[calc(100vh-140px)]">
            {/* Preview / Visual Editor */}
            <div className="liquid-glass rounded-2xl overflow-hidden flex flex-col min-h-[60vh]">
              <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="text-[11px] uppercase tracking-wider text-[var(--muted)]">
                    {mode === "visual" ? "Visual Editor" : "Live Preview"}
                  </div>
                  {mode === "visual" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                      Click any text to edit
                    </span>
                  )}
                  {visualDirty && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">
                      Unsaved
                    </span>
                  )}
                </div>
                <button
                  onClick={refreshPreview}
                  className="text-[11px] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  Refresh
                </button>
              </div>
              <div className="flex-1 bg-zinc-950">
                <iframe
                  ref={iframeRef}
                  key={iframeVersion}
                  src={`/api/websites/${siteId}?v=${iframeVersion}`}
                  onLoad={handleIframeLoad}
                  className="w-full h-full min-h-[60vh]"
                  title="Website preview"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              </div>
            </div>

            {/* Sidebar: AI Chat / Visual tools */}
            <div className="liquid-glass rounded-2xl flex flex-col min-h-[60vh] overflow-hidden">
              <div className="px-2 py-2 border-b border-white/5 flex items-center gap-1">
                <button
                  onClick={() => setMode("chat")}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    mode === "chat"
                      ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                      : "text-[var(--muted)] hover:bg-white/5"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" /> AI Chat
                </button>
                <button
                  onClick={() => setMode("visual")}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    mode === "visual"
                      ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                      : "text-[var(--muted)] hover:bg-white/5"
                  }`}
                >
                  <MousePointerClick className="w-3.5 h-3.5" /> Visual Edit
                </button>
              </div>

              {mode === "chat" ? (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.length === 0 && (
                      <div className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-[var(--muted)] space-y-2">
                        <p className="font-medium text-[var(--foreground)]">Ask for big changes.</p>
                        <p>Examples:</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>Switch the whole color palette to emerald green</li>
                          <li>Add a FAQ section with 5 common questions</li>
                          <li>Replace the hero image with a family home</li>
                          <li>Make the CTA button larger and more urgent</li>
                        </ul>
                        <p className="pt-1 text-[10px]">Each AI edit costs <span className="text-[var(--foreground)] font-semibold">{WEBSITE_AI_EDIT_CREDITS} credits</span>. For small text tweaks, use the Visual Edit tab — that&apos;s free.</p>
                      </div>
                    )}
                    {messages.map((msg, i) => {
                      const inProgress = !!msg.progress;
                      return (
                        <div
                          key={i}
                          className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                            msg.role === "user"
                              ? "bg-[var(--accent)]/12 border border-[var(--accent)]/25 ml-6"
                              : "bg-white/[0.03] border border-white/5 mr-6"
                          }`}
                        >
                          {inProgress ? (
                            <div className="flex flex-col gap-1.5">
                              <div className="inline-flex items-center gap-2 text-[var(--muted)]">
                                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                                <span>{msg.text}</span>
                              </div>
                              {msg.progress?.total != null && msg.progress.total > 0 && (
                                <div className="text-[10px] text-[var(--muted)] pl-5">
                                  {msg.progress.applied ?? 0} of {msg.progress.total} applied
                                </div>
                              )}
                            </div>
                          ) : (
                            msg.text
                          )}
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="p-3 border-t border-white/5">
                    <div className="relative">
                      <textarea
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleApplyAI();
                          }
                        }}
                        placeholder="Describe the change… (Enter to send, Shift+Enter for newline)"
                        rows={3}
                        disabled={applying}
                        className="w-full px-3 py-2.5 pr-11 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder:text-zinc-600 resize-none disabled:opacity-50"
                      />
                      <button
                        onClick={handleApplyAI}
                        disabled={applying || !instruction.trim()}
                        className="absolute right-2 bottom-2 p-2 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40"
                        title="Send (Enter)"
                      >
                        {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="mt-2 text-[10px] text-[var(--muted)] flex items-center gap-1">
                      <Wand2 className="w-3 h-3" /> {WEBSITE_AI_EDIT_CREDITS} credits per AI edit
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <div className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-[var(--muted)] space-y-2">
                      <p className="font-medium text-[var(--foreground)] flex items-center gap-1.5">
                        <MousePointerClick className="w-3.5 h-3.5 text-indigo-300" /> How to edit
                      </p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Hover any text — you&apos;ll see a dashed indigo outline.</li>
                        <li>Click to edit inline. Type your change.</li>
                        <li>Click outside, then hit <span className="text-[var(--foreground)] font-semibold">Save</span>.</li>
                      </ul>
                      <p className="pt-1 text-[10px]">Visual edits are <span className="text-[var(--foreground)] font-semibold">free</span>. For color, layout, or new sections, switch to AI Chat.</p>
                    </div>

                    <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3 space-y-2">
                      <p className="text-[11px] uppercase tracking-wider text-[var(--muted)]">Editable elements</p>
                      <div className="flex flex-wrap gap-1.5">
                        {["Headings", "Paragraphs", "Buttons", "Links", "List items", "Labels"].map((tag) => (
                          <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[var(--muted)]">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] text-[var(--muted)] pt-1">
                        Images, color, and layout can&apos;t be edited visually — use AI Chat for those.
                      </p>
                    </div>
                  </div>
                  <div className="p-3 border-t border-white/5 flex items-center gap-2">
                    <button
                      onClick={handleRevertVisual}
                      disabled={!visualDirty || saving}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-40"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Revert
                    </button>
                    <div className="flex-1 text-[10px] text-[var(--muted)] text-center">
                      {visualDirty ? "You have unsaved changes" : "No changes yet"}
                    </div>
                    <button
                      onClick={handleSaveVisual}
                      disabled={!visualDirty || saving}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40"
                    >
                      {saving ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                      ) : savedTick ? (
                        <><Check className="w-3.5 h-3.5" /> Saved</>
                      ) : (
                        <><Save className="w-3.5 h-3.5" /> Save</>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="px-4 py-2 text-[11px] text-rose-400 border-t border-rose-500/20 bg-rose-500/5">
                  {error}
                </div>
              )}
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
          action="Applying an AI edit to this site"
        />
      )}

      <CustomDomainModal
        open={domainModalOpen}
        onClose={() => setDomainModalOpen(false)}
        siteId={siteId}
        defaultSearchTerm={siteMeta?.prospectName ?? null}
        onAttachedDomainChange={(d) => setAttachedDomain(d)}
      />
    </>
  );
}
