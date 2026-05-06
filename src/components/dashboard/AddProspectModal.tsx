"use client";

import { useState } from "react";
import { X, User, Phone, Mail, Briefcase, FileText, FolderOpen, FileBox, UserPlus } from "lucide-react";
import { Folder } from "@/types";
import { useProspects } from "@/context/ProspectsContext";
import { v4 as uuidv4 } from "uuid";

interface AddProspectModalProps {
  onClose: () => void;
  folders: Folder[];
  defaultFolderId?: string | null;
  defaultFileId?: string | null;
}

export default function AddProspectModal({ onClose, folders, defaultFolderId, defaultFileId }: AddProspectModalProps) {
  const { addProspect } = useProspects();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    service: "",
    notes: "",
    folderId: defaultFolderId || folders[0]?.id || "",
    fileId: defaultFileId || "",
  });

  const activeFolder = folders.find((f) => f.id === form.folderId);
  const availableFiles = activeFolder?.files ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addProspect({
      id: uuidv4(),
      name: form.name,
      phone: form.phone,
      email: form.email,
      service: form.service,
      notes: form.notes,
      folderId: form.folderId,
      fileId: form.fileId || undefined,
      status: "New",
      createdAt: new Date().toISOString().split("T")[0],
      appointments: [],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-3xl w-full max-w-lg shadow-[0_25px_80px_rgba(0,0,0,0.45)] overflow-hidden animate-[fadeInUp_0.3s_ease-out]">
        <div className="flex items-start justify-between px-6 pt-6 pb-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Add New Prospect</h2>
              <p className="text-xs text-[var(--muted)] mt-0.5">A local business you&apos;re reaching out to.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 -mt-1 -mr-1 rounded-lg hover:bg-[var(--background)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* WHERE TO FILE */}
          {folders.length > 0 && (
            <section className="space-y-3">
              <p className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-[0.12em]">Where to file</p>
              <div className="grid grid-cols-2 gap-3">
                <FieldShell icon={<FolderOpen className="w-3.5 h-3.5" />} label="Folder">
                  <select
                    value={form.folderId}
                    onChange={(e) => setForm((prev) => ({ ...prev, folderId: e.target.value, fileId: "" }))}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors appearance-none cursor-pointer"
                  >
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </FieldShell>
                <FieldShell icon={<FileBox className="w-3.5 h-3.5" />} label="File">
                  <select
                    value={form.fileId}
                    onChange={(e) => setForm((prev) => ({ ...prev, fileId: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors appearance-none cursor-pointer"
                  >
                    <option value="">Unfiled</option>
                    {availableFiles.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </FieldShell>
              </div>
            </section>
          )}

          {/* CONTACT */}
          <section className="space-y-3">
            <p className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-[0.12em]">Contact</p>

            <FieldShell icon={<User className="w-3.5 h-3.5" />} label="Business or contact name" required>
              <input
                type="text"
                placeholder="Acme Plumbing — or Mike Johnson"
                required
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-zinc-600"
              />
            </FieldShell>

            <div className="grid grid-cols-2 gap-3">
              <FieldShell icon={<Phone className="w-3.5 h-3.5" />} label="Phone">
                <input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-zinc-600"
                />
              </FieldShell>
              <FieldShell icon={<Mail className="w-3.5 h-3.5" />} label="Email">
                <input
                  type="email"
                  placeholder="mike@acme.com"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-zinc-600"
                />
              </FieldShell>
            </div>
            <p className="text-[11px] text-[var(--muted)] leading-snug -mt-1">At least one of phone or email keeps follow-up easy.</p>
          </section>

          {/* BUSINESS DETAILS */}
          <section className="space-y-3">
            <p className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-[0.12em]">About their business</p>

            <FieldShell icon={<Briefcase className="w-3.5 h-3.5" />} label="Industry / niche">
              <input
                type="text"
                placeholder="e.g. Plumbing, Roofing, HVAC, Med Spa"
                value={form.service}
                onChange={(e) => setForm((prev) => ({ ...prev, service: e.target.value }))}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-zinc-600"
              />
            </FieldShell>
            <p className="text-[11px] text-[var(--muted)] leading-snug -mt-1">What kind of business they run — used to tailor agents, websites, and outreach to their industry.</p>

            <FieldShell icon={<FileText className="w-3.5 h-3.5" />} label="Notes" align="top">
              <textarea
                placeholder="How you found them, who referred them, what they need..."
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-zinc-600 resize-none"
              />
            </FieldShell>
          </section>
        </form>

        <div className="flex gap-3 px-6 py-4 border-t border-[var(--border)] bg-[var(--background)]/40">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium hover:bg-[var(--card-hover)] transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors shadow-lg shadow-[var(--accent)]/20">
            Add Prospect
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldShell({
  icon,
  label,
  required,
  align = "center",
  children,
}: {
  icon: React.ReactNode;
  label: string;
  required?: boolean;
  align?: "center" | "top";
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
        {label}
        {required && <span className="text-[var(--accent)] ml-1">*</span>}
      </label>
      <div className="relative">
        <div className={`absolute left-3 ${align === "top" ? "top-3" : "top-1/2 -translate-y-1/2"} text-[var(--muted)] pointer-events-none`}>
          {icon}
        </div>
        {children}
      </div>
    </div>
  );
}
