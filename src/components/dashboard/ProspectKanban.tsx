"use client";

import { useState, useMemo } from "react";
import { Mail, Phone, GripVertical, Plus, FolderInput } from "lucide-react";
import { Prospect, ProspectStatus } from "@/types";
import { useProspects } from "@/context/ProspectsContext";

interface ProspectKanbanProps {
  prospects: Prospect[];
  onSelect?: (prospect: Prospect) => void;
  onAdd?: (status: ProspectStatus) => void;
  onMoveToFile?: (prospectId: string) => void;
}

const COLUMNS: { status: ProspectStatus; label: string; accent: string; dot: string }[] = [
  { status: "New", label: "New", accent: "from-blue-500/20 to-blue-500/5", dot: "bg-blue-400" },
  { status: "Contacted", label: "Contacted", accent: "from-amber-500/20 to-amber-500/5", dot: "bg-amber-400" },
  { status: "Qualified", label: "Qualified", accent: "from-purple-500/20 to-purple-500/5", dot: "bg-purple-400" },
  { status: "Booked", label: "Booked", accent: "from-emerald-500/20 to-emerald-500/5", dot: "bg-emerald-400" },
  { status: "Closed", label: "Closed", accent: "from-rose-500/20 to-rose-500/5", dot: "bg-rose-400" },
];

export default function ProspectKanban({ prospects, onSelect, onAdd, onMoveToFile }: ProspectKanbanProps) {
  const { updateStatus } = useProspects();
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverCol, setHoverCol] = useState<ProspectStatus | null>(null);

  const byStatus = useMemo(() => {
    const map = new Map<ProspectStatus, Prospect[]>();
    COLUMNS.forEach((c) => map.set(c.status, []));
    prospects.forEach((p) => map.get(p.status)?.push(p));
    return map;
  }, [prospects]);

  const handleDrop = (status: ProspectStatus) => {
    if (dragId) {
      const p = prospects.find((x) => x.id === dragId);
      if (p && p.status !== status) updateStatus(dragId, status);
    }
    setDragId(null);
    setHoverCol(null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
      {COLUMNS.map((col) => {
        const items = byStatus.get(col.status) ?? [];
        const isHover = hoverCol === col.status;
        return (
          <div
            key={col.status}
            onDragOver={(e) => {
              e.preventDefault();
              if (hoverCol !== col.status) setHoverCol(col.status);
            }}
            onDragLeave={() => setHoverCol((c) => (c === col.status ? null : c))}
            onDrop={() => handleDrop(col.status)}
            className={`liquid-glass rounded-2xl p-3 flex flex-col min-h-[60vh] transition-all ${
              isHover ? "ring-2 ring-[var(--accent)]/60 scale-[1.01]" : ""
            }`}
          >
            <div className={`rounded-xl bg-gradient-to-b ${col.accent} px-3 py-2 mb-3 flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]">{col.label}</span>
                <span className="text-[10px] text-[var(--muted)]">{items.length}</span>
              </div>
              {onAdd && (
                <button
                  onClick={() => onAdd(col.status)}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  title={`Add to ${col.label}`}
                >
                  <Plus className="w-3.5 h-3.5 text-[var(--muted)]" />
                </button>
              )}
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto">
              {items.map((p) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={() => setDragId(p.id)}
                  onDragEnd={() => { setDragId(null); setHoverCol(null); }}
                  onClick={() => onSelect?.(p)}
                  className={`group rounded-xl liquid-glass p-3 cursor-pointer transition-all hover:bg-white/[0.04] ${
                    dragId === p.id ? "opacity-40" : ""
                  }`}
                >
                  <div className="flex items-start gap-2 relative">
                    <GripVertical className="w-3.5 h-3.5 text-[var(--muted)] opacity-0 group-hover:opacity-100 mt-0.5 shrink-0" />
                    {onMoveToFile && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onMoveToFile(p.id); }}
                        className="absolute top-0 right-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--accent)]/20 text-[var(--accent)] transition-all"
                        title="Move to file"
                        aria-label="Move to file"
                      >
                        <FolderInput className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--foreground)] truncate">{p.name}</div>
                      {p.service && (
                        <div className="text-[11px] text-[var(--muted)] truncate mt-0.5">{p.service}</div>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-[var(--muted)]">
                        {p.email && <span className="flex items-center gap-1 truncate"><Mail className="w-2.5 h-2.5" /> {p.email}</span>}
                        {p.phone && <span className="flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> {p.phone}</span>}
                      </div>
                      {p.appointments.length > 0 && (
                        <div className="mt-2 text-[10px] text-emerald-400">
                          {p.appointments.length} appointment{p.appointments.length > 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="text-center text-[11px] text-[var(--muted)] py-6 border border-dashed border-white/5 rounded-xl">
                  Drop here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
