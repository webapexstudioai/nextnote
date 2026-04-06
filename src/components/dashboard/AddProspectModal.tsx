"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Folder } from "@/types";
import { useProspects } from "@/context/ProspectsContext";
import { v4 as uuidv4 } from "uuid";

interface AddProspectModalProps {
  onClose: () => void;
  folders: Folder[];
  defaultFolderId?: string | null;
}

export default function AddProspectModal({ onClose, folders, defaultFolderId }: AddProspectModalProps) {
  const { addProspect } = useProspects();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    service: "",
    notes: "",
    folderId: defaultFolderId || folders[0]?.id || "",
  });

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
      status: "New",
      createdAt: new Date().toISOString().split("T")[0],
      appointments: [],
    });
    onClose();
  };

  const fields = [
    { key: "name", label: "Full Name", type: "text", placeholder: "John Doe", required: true },
    { key: "phone", label: "Phone Number", type: "tel", placeholder: "(555) 123-4567", required: true },
    { key: "email", label: "Email Address", type: "email", placeholder: "john@example.com", required: true },
    { key: "service", label: "Service Interested In", type: "text", placeholder: "Brand Identity Package", required: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-2xl w-full max-w-lg shadow-2xl fade-in">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <h2 className="text-lg font-bold">Add New Prospect</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--background)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Folder Select */}
          {folders.length > 0 && (
            <div>
              <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1.5 block">Folder</label>
              <select
                value={form.folderId}
                onChange={(e) => setForm((prev) => ({ ...prev, folderId: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
              >
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          {fields.map((field) => (
            <div key={field.key}>
              <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
                {field.label}
              </label>
              <input
                type={field.type}
                placeholder={field.placeholder}
                required={field.required}
                value={form[field.key as keyof typeof form]}
                onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-zinc-600"
              />
            </div>
          ))}

          <div>
            <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1.5 block">Notes</label>
            <textarea
              placeholder="Any additional notes..."
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-zinc-600 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--card-hover)] transition-colors">
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors">
              Add Prospect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
