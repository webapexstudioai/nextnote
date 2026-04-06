"use client";

import { ProspectStatus } from "@/types";
import { Search, Filter } from "lucide-react";

interface SearchFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: ProspectStatus | "All";
  onStatusFilterChange: (value: ProspectStatus | "All") => void;
}

const statuses: (ProspectStatus | "All")[] = ["All", "New", "Contacted", "Qualified", "Booked", "Closed"];

const statusColors: Record<string, string> = {
  All: "bg-zinc-700 text-zinc-200",
  New: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Contacted: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Qualified: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Booked: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Closed: "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

export default function SearchFilter({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: SearchFilterProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
        <input
          type="text"
          placeholder="Search by name, email, or service..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--muted)]"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-[var(--muted)] hidden sm:block" />
        {statuses.map((status) => (
          <button
            key={status}
            onClick={() => onStatusFilterChange(status)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              statusFilter === status
                ? statusColors[status] + " border-current"
                : "bg-transparent border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {status}
          </button>
        ))}
      </div>
    </div>
  );
}
