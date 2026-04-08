"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, Edit3, X, Check } from "lucide-react";
import { ProspectStatus } from "@/types";
import { useProspects } from "@/context/ProspectsContext";
import SearchFilter from "@/components/dashboard/SearchFilter";
import DetailPanel from "@/components/dashboard/DetailPanel";
import AddProspectModal from "@/components/dashboard/AddProspectModal";

const statusBadge: Record<ProspectStatus, string> = {
  New: "bg-blue-500/15 text-blue-400",
  Contacted: "bg-amber-500/15 text-amber-400",
  Qualified: "bg-purple-500/15 text-purple-400",
  Booked: "bg-emerald-500/15 text-emerald-400",
  Closed: "bg-rose-500/15 text-rose-400",
};

export default function ProspectsPage() {
  const { prospects, folders, updateProspect, deleteProspect } = useProspects();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | "All">("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", service: "", notes: "" });

  const filtered = useMemo(() => {
    return prospects.filter((p) => {
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.email.toLowerCase().includes(search.toLowerCase()) ||
        p.service.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "All" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [prospects, search, statusFilter]);

  const selected = selectedId ? prospects.find((p) => p.id === selectedId) : null;

  const startEdit = (p: typeof prospects[0]) => {
    setEditingId(p.id);
    setEditForm({ name: p.name, email: p.email, phone: p.phone, service: p.service, notes: p.notes });
  };

  const saveEdit = (id: string) => {
    updateProspect(id, editForm);
    setEditingId(null);
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-[var(--header-bg)] backdrop-blur-xl border-b border-[var(--border)]">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4">
          <div>
            <h1 className="text-xl font-bold">Prospects</h1>
            <p className="text-xs text-[var(--muted)]">{prospects.length} total prospects</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Prospect</span>
          </button>
        </div>
      </header>

      <div className="p-4 sm:p-6 space-y-6">
        <SearchFilter
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />

        <div className="space-y-2">
          {filtered.map((p) => (
            <div
              key={p.id}
              className={`rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:bg-[var(--card-hover)] transition-colors ${
                selectedId === p.id ? "border-[rgba(232,85,61,0.5)]" : ""
              }`}
            >
              {editingId === p.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Name"
                      className="px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
                    />
                    <input
                      value={editForm.email}
                      onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="Email"
                      className="px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
                    />
                    <input
                      value={editForm.phone}
                      onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="Phone"
                      className="px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
                    />
                    <input
                      value={editForm.service}
                      onChange={(e) => setEditForm((f) => ({ ...f, service: e.target.value }))}
                      placeholder="Service"
                      className="px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Notes"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(p.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 transition-colors">
                      <Check className="w-3 h-3" /> Save
                    </button>
                    <button onClick={() => setEditingId(null)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--border)]/50 text-[var(--muted)] text-xs font-medium hover:bg-[var(--border)] transition-colors">
                      <X className="w-3 h-3" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedId(p.id)}>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{p.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusBadge[p.status]}`}>
                        {p.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                      <span>{p.email}</span>
                      <span>{p.phone}</span>
                      <span>{p.service}</span>
                    </div>
                    {p.notes && <p className="text-xs text-[var(--muted)] mt-1.5 line-clamp-1">{p.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => startEdit(p)} className="p-2 rounded-lg hover:bg-[var(--background)] transition-colors">
                      <Edit3 className="w-3.5 h-3.5 text-[var(--muted)]" />
                    </button>
                    <button onClick={() => deleteProspect(p.id)} className="p-2 rounded-lg hover:bg-rose-500/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-rose-400/60 hover:text-rose-400" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-[var(--muted)]">
              <p className="text-lg">No prospects found</p>
              <p className="text-sm mt-1">Try adjusting your search or filter</p>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <DetailPanel
          prospect={selected}
          onClose={() => setSelectedId(null)}
        />
      )}

      {showAddModal && (
        <AddProspectModal
          onClose={() => setShowAddModal(false)}
          folders={folders}
        />
      )}
    </>
  );
}
