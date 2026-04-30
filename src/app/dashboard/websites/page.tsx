"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Globe, Plus, ExternalLink, Copy, Loader2, Search,
  Crown, Check, X, ChevronDown, Trash2, Wand2, Sparkles,
} from "lucide-react";
import { Folder as FolderIcon, FileText, ChevronRight, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useProspects } from "@/context/ProspectsContext";
import InsufficientCreditsModal from "@/components/dashboard/InsufficientCreditsModal";
const WEBSITE_GENERATION_CREDITS = 50;
const WEBSITE_WHITELABEL_CREDITS = 200;

interface GeneratedSite {
  id: string;
  prospect_id: string | null;
  prospect_name: string;
  tier: "standard" | "whitelabel";
  slug: string | null;
  created_at: string;
}

const WHITELABEL_HOST = "pitchsite.dev";

function publicSiteUrl(site: GeneratedSite, origin: string): string {
  if (site.tier === "whitelabel" && site.slug) {
    return `https://${site.slug}.${WHITELABEL_HOST}`;
  }
  return `${origin}/api/websites/${site.id}`;
}

type Tier = "standard" | "whitelabel";

export default function WebsitesPage() {
  const { prospects, folders } = useProspects();
  const [sites, setSites] = useState<GeneratedSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [creditsPaywall, setCreditsPaywall] = useState<{ required: number; balance: number; tier: Tier } | null>(null);

  // Generate form
  const [showForm, setShowForm] = useState(false);
  const [selectedProspectId, setSelectedProspectId] = useState("");
  const [customName, setCustomName] = useState("");
  const [customService, setCustomService] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [customAddress, setCustomAddress] = useState("");
  const [customContact, setCustomContact] = useState("");
  const [selectedTier, setSelectedTier] = useState<Tier>("standard");
  const [showProspectPicker, setShowProspectPicker] = useState(false);
  const [pickerFolderId, setPickerFolderId] = useState<string | null>(null);
  const [pickerFileId, setPickerFileId] = useState<string | null>(null);
  const [prospectSearch, setProspectSearch] = useState("");
  const [promptMode, setPromptMode] = useState<"auto" | "custom">("auto");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [draftingPrompt, setDraftingPrompt] = useState(false);
  const [promptError, setPromptError] = useState("");

  const loadSites = useCallback(async () => {
    try {
      const res = await fetch("/api/websites/list");
      if (res.ok) {
        const data = await res.json();
        setSites(data.websites || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSites(); }, [loadSites]);

  const selectedProspect = prospects.find((p) => p.id === selectedProspectId);

  const fillFromProspect = (prospectId: string) => {
    const p = prospects.find((pr) => pr.id === prospectId);
    if (!p) return;
    setSelectedProspectId(prospectId);
    setCustomName(p.name);
    setCustomService(p.service || "");
    setCustomPhone(p.phone || "");
    setCustomEmail(p.email || "");
    setCustomAddress(p.address || "");
    setCustomContact(p.contactName || "");
    setShowProspectPicker(false);
    setPickerFolderId(null);
    setPickerFileId(null);
    setProspectSearch("");
  };

  const ALL_IN_FOLDER = "__all__";
  const pickerFolder = pickerFolderId ? folders.find((f) => f.id === pickerFolderId) : null;
  const pickerFile = pickerFolder && pickerFileId && pickerFileId !== ALL_IN_FOLDER
    ? pickerFolder.files.find((f) => f.id === pickerFileId)
    : null;
  const isPickingAllInFolder = pickerFileId === ALL_IN_FOLDER;
  const pickerProspects = isPickingAllInFolder && pickerFolderId
    ? prospects.filter((p) => p.folderId === pickerFolderId)
    : pickerFileId
    ? prospects.filter((p) => p.fileId === pickerFileId)
    : pickerFolderId
    ? prospects.filter((p) => p.folderId === pickerFolderId)
    : [];

  const enterFolder = (folderId: string) => {
    const f = folders.find((fl) => fl.id === folderId);
    setPickerFolderId(folderId);
    if (f && f.files.length === 0) setPickerFileId(ALL_IN_FOLDER);
    else setPickerFileId(null);
  };

  const resetForm = () => {
    setSelectedProspectId("");
    setCustomName("");
    setCustomService("");
    setCustomPhone("");
    setCustomEmail("");
    setCustomAddress("");
    setCustomContact("");
    setSelectedTier("standard");
    setError("");
    setShowProspectPicker(false);
    setPickerFolderId(null);
    setPickerFileId(null);
    setProspectSearch("");
    setPromptMode("auto");
    setExtraInstructions("");
    setPromptError("");
  };

  const draftPrompt = async () => {
    if (!customName.trim()) {
      setPromptError("Add a business name first so the AI has something to work with.");
      return;
    }
    setPromptError("");
    setDraftingPrompt(true);
    try {
      const res = await fetch("/api/websites/suggest-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customName.trim(),
          service: customService.trim(),
          address: customAddress.trim(),
          contactName: customContact.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPromptError(data.error || "Couldn't draft a prompt.");
        return;
      }
      setExtraInstructions(data.prompt || "");
    } catch {
      setPromptError("Network error. Try again.");
    } finally {
      setDraftingPrompt(false);
    }
  };

  const handleGenerate = async () => {
    if (!customName.trim()) { setError("Business name is required"); return; }
    setGenerating(true);
    setError("");
    setShowForm(false);
    try {
      const res = await fetch("/api/websites/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId: selectedProspectId || null,
          name: customName.trim(),
          service: customService.trim(),
          phone: customPhone.trim(),
          email: customEmail.trim(),
          address: customAddress.trim(),
          contactName: customContact.trim(),
          tier: selectedTier,
          extraInstructions: promptMode === "custom" ? extraInstructions.trim() : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402 && typeof data.required === "number" && typeof data.balance === "number") {
          setCreditsPaywall({ required: data.required, balance: data.balance, tier: selectedTier });
          setShowForm(true);
          return;
        }
        setError(data.error || "Generation failed");
        setShowForm(true);
        return;
      }
      resetForm();
      loadSites();
    } catch {
      setError("Network error");
      setShowForm(true);
    } finally {
      setGenerating(false);
    }
  };

  const GENERATION_STEPS = [
    { label: "Analyzing the niche", sub: "Picking the right palette and imagery direction" },
    { label: "Designing the logo", sub: "Generating a custom brand mark for the business" },
    { label: "Drafting the layout", sub: "Building a 9-section editorial structure" },
    { label: "Writing the copy", sub: "Crafting aspirational headlines and specific services" },
    { label: "Sourcing imagery", sub: "Matching real photos to the business niche" },
    { label: "Polishing the design", sub: "Tightening typography, spacing, and CTAs" },
    { label: "Finalizing the page", sub: "Almost there — saving your new site" },
  ];
  const [genStep, setGenStep] = useState(0);
  useEffect(() => {
    if (!generating) { setGenStep(0); return; }
    const id = setInterval(() => {
      setGenStep((s) => Math.min(s + 1, GENERATION_STEPS.length - 1));
    }, 7000);
    return () => clearInterval(id);
  }, [generating]);

  const copyUrl = (site: GeneratedSite) => {
    const url = publicSiteUrl(site, window.location.origin);
    navigator.clipboard.writeText(url);
    setCopied(site.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDelete = async (siteId: string) => {
    setDeleting(siteId);
    try {
      const res = await fetch("/api/websites/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
      });
      if (res.ok) {
        setSites((prev) => prev.filter((s) => s.id !== siteId));
      }
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  const filteredSites = search
    ? sites.filter((s) => s.prospect_name.toLowerCase().includes(search.toLowerCase()))
    : sites;

  const searchedPickerProspects = prospectSearch
    ? pickerProspects.filter((p) =>
        p.name.toLowerCase().includes(prospectSearch.toLowerCase()) ||
        (p.service || "").toLowerCase().includes(prospectSearch.toLowerCase())
      )
    : pickerProspects;

  const creditCost = selectedTier === "whitelabel" ? WEBSITE_WHITELABEL_CREDITS : WEBSITE_GENERATION_CREDITS;

  return (
    <>
      <header className="sticky top-0 z-30 liquid-glass-strong border-b border-white/5">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">AI Websites</h1>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Generate professional landing pages for your prospects
            </p>
          </div>
          <button
            onClick={() => { setShowForm(true); resetForm(); }}
            data-tour-id="websites-generate"
            className="liquid-btn shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Generate Website</span>
          </button>
        </div>
      </header>

      <div className="relative z-10 p-4 sm:p-6 space-y-6">
        {/* Search */}
        {sites.length > 0 && (
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search websites..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder:text-zinc-600"
            />
          </div>
        )}

        {/* Stats */}
        {sites.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="liquid-glass rounded-xl p-4">
              <p className="text-2xl font-bold">{sites.length}</p>
              <p className="text-xs text-[var(--muted)] mt-1">Total Sites</p>
            </div>
            <div className="liquid-glass rounded-xl p-4">
              <p className="text-2xl font-bold">{sites.filter((s) => s.tier === "standard").length}</p>
              <p className="text-xs text-[var(--muted)] mt-1">Standard</p>
            </div>
            <div className="liquid-glass rounded-xl p-4">
              <p className="text-2xl font-bold text-amber-400">{sites.filter((s) => s.tier === "whitelabel").length}</p>
              <p className="text-xs text-[var(--muted)] mt-1">White-label</p>
            </div>
          </div>
        )}

        {/* Sites Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--muted)]" />
          </div>
        ) : filteredSites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center mb-4">
              <Globe className="w-8 h-8 text-[var(--accent)]" />
            </div>
            <h2 className="text-lg font-semibold mb-1">
              {search ? "No matching websites" : "No websites yet"}
            </h2>
            <p className="text-sm text-[var(--muted)] max-w-sm mb-6">
              {search
                ? "Try a different search term."
                : "Generate your first AI landing page for a prospect. It takes about 30 seconds and costs 50 credits."
              }
            </p>
            {!search && (
              <button
                onClick={() => { setShowForm(true); resetForm(); }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)] transition-colors shadow-lg shadow-[var(--accent)]/20"
              >
                <Wand2 className="w-4 h-4" /> Generate Your First Website
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredSites.map((site) => (
              <div key={site.id} className="liquid-glass rounded-2xl overflow-hidden group">
                {/* Preview iframe */}
                <div className="relative h-48 bg-zinc-900 overflow-hidden border-b border-white/5">
                  <iframe
                    src={`/api/websites/${site.id}`}
                    className="w-[200%] h-[200%] origin-top-left scale-50 pointer-events-none"
                    title={site.prospect_name}
                    loading="lazy"
                    sandbox="allow-scripts allow-same-origin"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <a
                    href={publicSiteUrl(site, typeof window !== "undefined" ? window.location.origin : "")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <span className="px-4 py-2 rounded-lg bg-white/10 backdrop-blur-md text-white text-sm font-medium flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" /> Open Site
                    </span>
                  </a>
                </div>

                {/* Info */}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold truncate">{site.prospect_name}</h3>
                      <p className="text-[10px] text-[var(--muted)] mt-0.5">
                        {new Date(site.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                      {site.tier === "whitelabel" && site.slug ? (
                        <p className="text-[10px] text-amber-400/90 mt-1 font-mono truncate" title={`${site.slug}.${WHITELABEL_HOST}`}>
                          {site.slug}.{WHITELABEL_HOST}
                        </p>
                      ) : null}
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      site.tier === "whitelabel"
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-blue-500/15 text-blue-400"
                    }`}>
                      {site.tier === "whitelabel" && <Crown className="w-3 h-3" />}
                      {site.tier === "whitelabel" ? "White-label" : "Standard"}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/dashboard/websites/${site.id}/edit`}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors"
                    >
                      <Wand2 className="w-3.5 h-3.5" /> Customize
                    </Link>
                    <a
                      href={publicSiteUrl(site, typeof window !== "undefined" ? window.location.origin : "")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => copyUrl(site)}
                      className="flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                      title="Copy URL"
                    >
                      {copied === site.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {confirmDelete === site.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDelete(site.id)}
                          disabled={deleting === site.id}
                          className="flex items-center justify-center gap-1 text-xs font-medium px-3 py-2 rounded-lg bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition-colors"
                        >
                          {deleting === site.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="flex items-center justify-center text-xs px-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(site.id)}
                        className="flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-white/5 hover:bg-rose-500/15 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generate Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => { setShowForm(false); resetForm(); }} />
          <div className="relative w-full max-w-lg liquid-glass-strong rounded-3xl overflow-hidden my-auto">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/60 to-transparent" />

            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Generate Landing Page</h2>
                <p className="text-xs text-[var(--muted)] mt-0.5">Fill in business details or pick a prospect</p>
              </div>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="p-2 rounded-lg hover:bg-white/5 text-[var(--muted)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Prospect Picker — Folder → File → Prospect drill-down */}
              {folders.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">Auto-fill from prospect</label>
                  {!showProspectPicker ? (
                    <button
                      onClick={() => { setShowProspectPicker(true); setPickerFolderId(null); setPickerFileId(null); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm hover:border-[var(--accent)]/40 transition-colors"
                    >
                      <span className={selectedProspect ? "text-[var(--foreground)]" : "text-zinc-500"}>
                        {selectedProspect ? selectedProspect.name : "Choose from your folders..."}
                      </span>
                      <ChevronDown className="w-4 h-4 text-[var(--muted)]" />
                    </button>
                  ) : (
                    <div className="rounded-xl bg-[var(--background)] border border-[var(--border)] overflow-hidden">
                      {/* Breadcrumb */}
                      <div className="flex items-center gap-1 px-3 py-2 bg-white/[0.02] border-b border-[var(--border)] text-[11px]">
                        <button
                          onClick={() => { setPickerFolderId(null); setPickerFileId(null); setProspectSearch(""); }}
                          className={`hover:text-[var(--accent)] transition-colors ${!pickerFolderId ? "text-[var(--foreground)] font-medium" : "text-[var(--muted)]"}`}
                        >
                          Folders
                        </button>
                        {pickerFolder && (
                          <>
                            <ChevronRight className="w-3 h-3 text-[var(--muted)]" />
                            <button
                              onClick={() => {
                                setPickerFileId(pickerFolder.files.length === 0 ? ALL_IN_FOLDER : null);
                                setProspectSearch("");
                              }}
                              className={`hover:text-[var(--accent)] transition-colors truncate max-w-[100px] ${
                                !pickerFileId || (isPickingAllInFolder && pickerFolder.files.length === 0)
                                  ? "text-[var(--foreground)] font-medium"
                                  : "text-[var(--muted)]"
                              }`}
                            >
                              {pickerFolder.name}
                            </button>
                          </>
                        )}
                        {pickerFile && (
                          <>
                            <ChevronRight className="w-3 h-3 text-[var(--muted)]" />
                            <span className="text-[var(--foreground)] font-medium truncate max-w-[100px]">{pickerFile.name}</span>
                          </>
                        )}
                        {isPickingAllInFolder && pickerFolder && pickerFolder.files.length > 0 && (
                          <>
                            <ChevronRight className="w-3 h-3 text-[var(--muted)]" />
                            <span className="text-[var(--foreground)] font-medium truncate max-w-[140px]">All prospects</span>
                          </>
                        )}
                        <button
                          onClick={() => { setShowProspectPicker(false); setPickerFolderId(null); setPickerFileId(null); setProspectSearch(""); }}
                          className="ml-auto p-0.5 rounded hover:bg-white/10 text-[var(--muted)]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="max-h-56 overflow-y-auto">
                        {/* Level 1: Folders */}
                        {!pickerFolderId && (
                          <div>
                            {folders.map((folder) => {
                              const count = prospects.filter((p) => p.folderId === folder.id).length;
                              return (
                                <button
                                  key={folder.id}
                                  onClick={() => enterFolder(folder.id)}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                                >
                                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${folder.color}15` }}>
                                    <FolderIcon className="w-3.5 h-3.5" style={{ color: folder.color }} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{folder.name}</p>
                                    <p className="text-[10px] text-[var(--muted)]">{count} prospects · {folder.files.length} files</p>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-[var(--muted)] shrink-0" />
                                </button>
                              );
                            })}
                            {folders.length === 0 && (
                              <p className="px-3 py-6 text-xs text-[var(--muted)] text-center">No folders yet</p>
                            )}
                          </div>
                        )}

                        {/* Level 2: Files in folder (only when files exist) */}
                        {pickerFolderId && !pickerFileId && pickerFolder && pickerFolder.files.length > 0 && (
                          <div>
                            {/* Quick "all prospects in folder" entry — handles unfiled prospects too */}
                            <button
                              onClick={() => setPickerFileId(ALL_IN_FOLDER)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left border-b border-[var(--border)]"
                            >
                              <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
                                <FolderIcon className="w-3.5 h-3.5 text-[var(--accent)]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">All prospects in this folder</p>
                                <p className="text-[10px] text-[var(--muted)]">
                                  {prospects.filter((p) => p.folderId === pickerFolderId).length} prospects
                                </p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-[var(--muted)] shrink-0" />
                            </button>
                            {pickerFolder.files.map((file) => {
                              const count = prospects.filter((p) => p.fileId === file.id).length;
                              return (
                                <button
                                  key={file.id}
                                  onClick={() => setPickerFileId(file.id)}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                                >
                                  <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                    <FileText className="w-3.5 h-3.5 text-[var(--muted)]" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{file.name}</p>
                                    <p className="text-[10px] text-[var(--muted)]">{count} prospects · {file.source}</p>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-[var(--muted)] shrink-0" />
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Level 3: Prospects in file or all-in-folder */}
                        {pickerFileId && (
                          <div>
                            <div className="sticky top-0 p-2 bg-[var(--background)] border-b border-[var(--border)]">
                              <input
                                autoFocus
                                value={prospectSearch}
                                onChange={(e) => setProspectSearch(e.target.value)}
                                placeholder={isPickingAllInFolder ? "Search prospects in this folder..." : "Search prospects in this file..."}
                                className="w-full px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs focus:outline-none focus:border-[var(--accent)] placeholder:text-zinc-600"
                              />
                            </div>
                            {searchedPickerProspects.length > 0 ? (
                              searchedPickerProspects.map((p) => (
                                <button
                                  key={p.id}
                                  onClick={() => fillFromProspect(p.id)}
                                  className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors flex items-center gap-3"
                                >
                                  <div className="w-7 h-7 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0 text-[10px] font-bold text-[var(--accent)]">
                                    {p.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{p.name}</p>
                                    <p className="text-[10px] text-[var(--muted)] truncate">
                                      {[p.service, p.phone, p.email].filter(Boolean).join(" · ") || "No details"}
                                    </p>
                                  </div>
                                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
                                    p.status === "Closed" ? "bg-rose-500/15 text-rose-400"
                                    : p.status === "Booked" ? "bg-emerald-500/15 text-emerald-400"
                                    : p.status === "Qualified" ? "bg-purple-500/15 text-purple-400"
                                    : p.status === "Contacted" ? "bg-amber-500/15 text-amber-400"
                                    : "bg-blue-500/15 text-blue-400"
                                  }`}>{p.status}</span>
                                </button>
                              ))
                            ) : (
                              <p className="px-3 py-6 text-xs text-[var(--muted)] text-center">
                                {prospectSearch
                                  ? "No matching prospects"
                                  : isPickingAllInFolder
                                    ? "No prospects in this folder yet"
                                    : "No prospects in this file"}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">Business Name *</label>
                  <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. Bay Area Roofing" className="w-full px-3 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder:text-zinc-600" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">Service / Industry</label>
                  <input value={customService} onChange={(e) => setCustomService(e.target.value)} placeholder="e.g. Roofing" className="w-full px-3 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder:text-zinc-600" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">Contact Person</label>
                  <input value={customContact} onChange={(e) => setCustomContact(e.target.value)} placeholder="e.g. John Smith" className="w-full px-3 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder:text-zinc-600" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">Phone</label>
                  <input value={customPhone} onChange={(e) => setCustomPhone(e.target.value)} placeholder="+1 555 555 5555" className="w-full px-3 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder:text-zinc-600" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">Email</label>
                  <input value={customEmail} onChange={(e) => setCustomEmail(e.target.value)} placeholder="name@company.com" className="w-full px-3 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder:text-zinc-600" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">Address</label>
                  <input value={customAddress} onChange={(e) => setCustomAddress(e.target.value)} placeholder="Street, City, State" className="w-full px-3 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder:text-zinc-600" />
                </div>
              </div>

              {/* Design direction (optional) */}
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-2">Design direction</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setPromptMode("auto")}
                    className={`rounded-lg border px-3 py-2 text-left transition-all ${
                      promptMode === "auto"
                        ? "border-[var(--accent)]/60 bg-[var(--accent)]/[0.06]"
                        : "border-[var(--border)] hover:border-[var(--border)]"
                    }`}
                  >
                    <p className="text-xs font-semibold">Auto from details</p>
                    <p className="text-[10px] text-[var(--muted)] mt-0.5">Let NextNote pick the look</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromptMode("custom")}
                    className={`rounded-lg border px-3 py-2 text-left transition-all ${
                      promptMode === "custom"
                        ? "border-[var(--accent)]/60 bg-[var(--accent)]/[0.06]"
                        : "border-[var(--border)] hover:border-[var(--border)]"
                    }`}
                  >
                    <p className="text-xs font-semibold">Custom prompt</p>
                    <p className="text-[10px] text-[var(--muted)] mt-0.5">Describe the vibe yourself</p>
                  </button>
                </div>
                {promptMode === "custom" && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[11px] text-[var(--muted)]">
                        Add a few notes on the vibe, palette, or hero imagery you want.
                      </p>
                      <button
                        type="button"
                        onClick={draftPrompt}
                        disabled={draftingPrompt}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--accent)]/10 hover:bg-[var(--accent)]/15 text-[var(--accent)] text-[11px] font-medium transition-colors disabled:opacity-50"
                      >
                        {draftingPrompt ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Drafting...</>
                        ) : (
                          <><Sparkles className="w-3 h-3" /> AI-suggest</>
                        )}
                      </button>
                    </div>
                    <textarea
                      value={extraInstructions}
                      onChange={(e) => setExtraInstructions(e.target.value)}
                      placeholder="e.g. warm sandstone palette with deep navy accents, sun-washed exterior hero shot, headline angle around craftsmanship, copy tone confident and unhurried"
                      rows={5}
                      className="w-full px-3 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder:text-zinc-600 resize-y"
                    />
                    {promptError && <p className="text-[11px] text-rose-400 mt-1">{promptError}</p>}
                  </div>
                )}
              </div>

              {/* Tier Selection */}
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-2">Plan</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedTier("standard")}
                    className={`relative rounded-xl p-4 border text-left transition-all ${
                      selectedTier === "standard"
                        ? "border-[var(--accent)]/60 bg-[var(--accent)]/[0.06]"
                        : "border-[var(--border)] hover:border-[var(--border)]"
                    }`}
                  >
                    {selectedTier === "standard" && (
                      <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <Globe className="w-5 h-5 text-blue-400 mb-2" />
                    <p className="text-sm font-semibold">Standard</p>
                    <p className="text-[10px] text-[var(--muted)] mt-0.5">Includes &quot;Powered by NextNote&quot; badge</p>
                    <p className="text-xs font-bold text-[var(--accent)] mt-2">{WEBSITE_GENERATION_CREDITS} credits</p>
                  </button>
                  <button
                    onClick={() => setSelectedTier("whitelabel")}
                    className={`relative rounded-xl p-4 border text-left transition-all ${
                      selectedTier === "whitelabel"
                        ? "border-amber-500/60 bg-amber-500/[0.06]"
                        : "border-[var(--border)] hover:border-[var(--border)]"
                    }`}
                  >
                    {selectedTier === "whitelabel" && (
                      <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <Crown className="w-5 h-5 text-amber-400 mb-2" />
                    <p className="text-sm font-semibold">White-label</p>
                    <p className="text-[10px] text-[var(--muted)] mt-0.5">No branding — fully clean</p>
                    <p className="text-xs font-bold text-amber-400 mt-2">{WEBSITE_WHITELABEL_CREDITS} credits</p>
                  </button>
                </div>
              </div>

              {error && <p className="text-xs text-rose-400 text-center">{error}</p>}
            </div>

            <div className="px-6 pb-6 pt-2 flex items-center justify-between gap-3">
              <p className="text-[11px] text-[var(--muted)]">
                Cost: <span className="font-semibold text-[var(--foreground)]">{creditCost} credits</span>
              </p>
              <div className="flex gap-2">
                <button onClick={() => { setShowForm(false); resetForm(); }} className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generating || !customName.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 shadow-lg shadow-[var(--accent)]/20"
                >
                  {generating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                  ) : (
                    <><Wand2 className="w-4 h-4" /> Generate</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generation loading overlay */}
      {generating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
          <div className="w-full max-w-md liquid-glass rounded-3xl p-8 text-center relative overflow-hidden">
            {/* Animated accent glow */}
            <div className="pointer-events-none absolute -top-20 -left-20 w-64 h-64 rounded-full bg-[var(--accent)]/20 blur-3xl animate-pulse" />
            <div className="pointer-events-none absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-[var(--accent)]/10 blur-3xl animate-pulse" />

            <div className="relative">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-[var(--accent)]/15 flex items-center justify-center mb-5">
                <Wand2 className="w-7 h-7 text-[var(--accent)] animate-pulse" />
              </div>

              <h2 className="text-xl font-bold tracking-tight mb-1">
                Generating your website
              </h2>
              <p className="text-xs text-[var(--muted)] mb-6">
                This usually takes 30-60 seconds. Don&apos;t close this tab.
              </p>

              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden mb-6">
                <div
                  className="h-full bg-[var(--accent)] transition-all duration-700 ease-out"
                  style={{ width: `${((genStep + 1) / GENERATION_STEPS.length) * 100}%` }}
                />
              </div>

              {/* Steps */}
              <ul className="space-y-2.5 text-left">
                {GENERATION_STEPS.map((step, i) => {
                  const done = i < genStep;
                  const active = i === genStep;
                  return (
                    <li
                      key={step.label}
                      className={`flex items-start gap-3 transition-opacity ${
                        done || active ? "opacity-100" : "opacity-40"
                      }`}
                    >
                      <span className="mt-0.5 w-5 h-5 shrink-0 flex items-center justify-center">
                        {done ? (
                          <Check className="w-4 h-4 text-[var(--accent)]" />
                        ) : active ? (
                          <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                        )}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium">{step.label}</span>
                        {active && (
                          <span className="block text-[11px] text-[var(--muted)] mt-0.5">
                            {step.sub}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {creditsPaywall && (
        <InsufficientCreditsModal
          open
          onClose={() => setCreditsPaywall(null)}
          required={creditsPaywall.required}
          balance={creditsPaywall.balance}
          action={creditsPaywall.tier === "whitelabel" ? "Generating a white-label landing page" : "Generating a landing page"}
        />
      )}
    </>
  );
}
