"use client";

import { Prospect, ProspectStatus } from "@/types";
import { ChevronRight, Voicemail, Loader2, X } from "lucide-react";
import { useState } from "react";

interface ProspectTableProps {
  prospects: Prospect[];
  onSelect: (prospect: Prospect) => void;
  selectedId?: string;
}

const statusBadge: Record<ProspectStatus, string> = {
  New: "bg-blue-500/15 text-blue-400",
  Contacted: "bg-amber-500/15 text-amber-400",
  Qualified: "bg-purple-500/15 text-purple-400",
  Booked: "bg-emerald-500/15 text-emerald-400",
  Closed: "bg-rose-500/15 text-rose-400",
};

export default function ProspectTable({ prospects, onSelect, selectedId }: ProspectTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkVm, setShowBulkVm] = useState(false);
  const [bulkVmMessage, setBulkVmMessage] = useState("");
  const [bulkVmSending, setBulkVmSending] = useState(false);
  const [bulkVmProgress, setBulkVmProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const [bulkVmDone, setBulkVmDone] = useState(false);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === prospects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(prospects.map((p) => p.id)));
    }
  };

  const selectedWithPhone = prospects.filter((p) => selectedIds.has(p.id) && p.phone);

  const handleBulkVoicemail = async () => {
    if (!bulkVmMessage.trim() || selectedWithPhone.length === 0) return;
    setBulkVmSending(true);
    setBulkVmDone(false);
    setBulkVmProgress({ sent: 0, failed: 0, total: selectedWithPhone.length });

    const isUrl = bulkVmMessage.startsWith("http://") || bulkVmMessage.startsWith("https://");

    for (let i = 0; i < selectedWithPhone.length; i++) {
      const p = selectedWithPhone[i];
      try {
        const res = await fetch("/api/slybroadcast/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: p.phone,
            ...(isUrl ? { audioUrl: bulkVmMessage } : { message: bulkVmMessage }),
            campaignName: `NextNote Bulk — ${new Date().toLocaleDateString()}`,
          }),
        });
        const data = await res.json();
        setBulkVmProgress((prev) => ({
          ...prev,
          sent: prev.sent + (data.success ? 1 : 0),
          failed: prev.failed + (data.success ? 0 : 1),
        }));
      } catch {
        setBulkVmProgress((prev) => ({ ...prev, failed: prev.failed + 1 }));
      }
      // 500ms delay between each to avoid rate limits
      if (i < selectedWithPhone.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    setBulkVmSending(false);
    setBulkVmDone(true);
  };

  if (prospects.length === 0) {
    return (
      <div className="text-center py-16 text-[var(--muted)]">
        <p className="text-lg">No prospects found</p>
        <p className="text-sm mt-1">Try adjusting your search or filter</p>
      </div>
    );
  }

  return (
    <>
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl mb-3" style={{ background: "rgba(232, 85, 61, 0.05)", border: "1px solid rgba(232, 85, 61, 0.2)" }}>
          <span className="text-xs text-[var(--accent)] font-medium">{selectedIds.size} selected</span>
          <button
            onClick={() => { setShowBulkVm(true); setBulkVmDone(false); setBulkVmMessage(""); }}
            disabled={selectedWithPhone.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-medium hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Voicemail className="w-3.5 h-3.5" />
            Bulk Voicemail Drop ({selectedWithPhone.length} with phone)
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] ml-auto"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02]">
              <th className="py-3 px-2 w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.size === prospects.length && prospects.length > 0}
                  onChange={toggleAll}
                  className="rounded border-zinc-600 bg-transparent cursor-pointer accent-[var(--accent)]"
                />
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Name</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-[var(--muted)] uppercase tracking-wider hidden md:table-cell">Phone</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-[var(--muted)] uppercase tracking-wider hidden lg:table-cell">Email</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Service</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Status</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {prospects.map((prospect) => (
              <tr
                key={prospect.id}
                onClick={() => onSelect(prospect)}
                className={`border-b border-white/5 cursor-pointer transition-colors ${
                  selectedId === prospect.id
                    ? ""
                    : selectedIds.has(prospect.id)
                    ? ""
                    : "hover:bg-white/[0.035]"
                }`}
                style={
                  selectedId === prospect.id
                    ? { background: "linear-gradient(90deg, rgba(232,85,61,0.14), rgba(232,85,61,0.04))", boxShadow: "inset 3px 0 0 rgba(232,85,61,0.9)" }
                    : selectedIds.has(prospect.id)
                    ? { background: "rgba(232, 85, 61, 0.06)" }
                    : undefined
                }
              >
                <td className="py-3 px-2" onClick={(e) => toggleSelect(prospect.id, e)}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(prospect.id)}
                    onChange={() => {}}
                    className="rounded border-zinc-600 bg-transparent cursor-pointer accent-[var(--accent)]"
                  />
                </td>
                <td className="py-3 px-4">
                  <div className="font-medium">{prospect.name}</div>
                  <div className="text-xs text-[var(--muted)] md:hidden">{prospect.phone}</div>
                </td>
                <td className="py-3 px-4 text-[var(--muted)] hidden md:table-cell">{prospect.phone}</td>
                <td className="py-3 px-4 text-[var(--muted)] hidden lg:table-cell">{prospect.email}</td>
                <td className="py-3 px-4 text-[var(--muted)]">{prospect.service}</td>
                <td className="py-3 px-4">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge[prospect.status]}`}>
                    {prospect.status}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <ChevronRight className="w-4 h-4 text-[var(--muted)]" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bulk Voicemail Modal */}
      {showBulkVm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="liquid-glass-strong rounded-2xl p-5 w-full max-w-md mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Voicemail className="w-4 h-4 text-amber-400" /> Bulk Voicemail Drop
              </h3>
              <button onClick={() => { setShowBulkVm(false); setBulkVmSending(false); }} className="p-1 rounded-lg hover:bg-[var(--background)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Sending to <span className="text-[var(--foreground)] font-medium">{selectedWithPhone.length}</span> prospects with phone numbers
            </p>
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">Audio URL or Message</label>
              <textarea
                value={bulkVmMessage}
                onChange={(e) => setBulkVmMessage(e.target.value)}
                rows={3}
                disabled={bulkVmSending}
                placeholder="Paste an audio URL (https://...) or type a message..."
                className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] resize-none placeholder:text-zinc-600 disabled:opacity-50"
              />
            </div>
            {(bulkVmSending || bulkVmDone) && (
              <div className="space-y-2">
                <div className="w-full bg-[var(--border)] rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-amber-400 h-full rounded-full transition-all"
                    style={{ width: `${bulkVmProgress.total > 0 ? ((bulkVmProgress.sent + bulkVmProgress.failed) / bulkVmProgress.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {bulkVmProgress.sent + bulkVmProgress.failed} / {bulkVmProgress.total} complete
                  {bulkVmProgress.sent > 0 && <span className="text-emerald-400 ml-2">{bulkVmProgress.sent} sent</span>}
                  {bulkVmProgress.failed > 0 && <span className="text-rose-400 ml-2">{bulkVmProgress.failed} failed</span>}
                </p>
              </div>
            )}
            <div className="flex gap-2">
              {!bulkVmDone ? (
                <button
                  onClick={handleBulkVoicemail}
                  disabled={bulkVmSending || !bulkVmMessage.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {bulkVmSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Voicemail className="w-4 h-4" />}
                  {bulkVmSending ? "Sending..." : "Send to All"}
                </button>
              ) : (
                <button
                  onClick={() => { setShowBulkVm(false); setSelectedIds(new Set()); }}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 transition-colors"
                >
                  Done
                </button>
              )}
              <button
                onClick={() => { setShowBulkVm(false); setBulkVmSending(false); }}
                className="px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card-hover)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
