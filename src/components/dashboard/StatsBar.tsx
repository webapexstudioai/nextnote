"use client";

import { StatsData } from "@/types";
import { Users, UserPlus, Phone, CheckCircle, Calendar, Trophy } from "lucide-react";

interface StatsBarProps {
  stats: StatsData;
}

const statCards = [
  { key: "total" as const, label: "Total Prospects", icon: Users, color: "text-indigo-400", bg: "bg-indigo-500/10" },
  { key: "new" as const, label: "New", icon: UserPlus, color: "text-blue-400", bg: "bg-blue-500/10" },
  { key: "contacted" as const, label: "Contacted", icon: Phone, color: "text-amber-400", bg: "bg-amber-500/10" },
  { key: "qualified" as const, label: "Qualified", icon: CheckCircle, color: "text-purple-400", bg: "bg-purple-500/10" },
  { key: "booked" as const, label: "Booked", icon: Calendar, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { key: "closed" as const, label: "Closed", icon: Trophy, color: "text-rose-400", bg: "bg-rose-500/10" },
];

export default function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {statCards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:bg-[var(--card-hover)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`${card.bg} rounded-lg p-2`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats[card.key]}</p>
                <p className="text-xs text-[var(--muted)]">{card.label}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
