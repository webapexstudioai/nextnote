"use client";

import { StatsData } from "@/types";
import { Users, UserPlus, Phone, CheckCircle, Calendar, Trophy } from "lucide-react";

interface StatsBarProps {
  stats: StatsData;
}

const statCards = [
  { key: "total" as const, label: "Total Prospects", icon: Users, color: "text-[var(--accent)]", bg: "rgba(232, 85, 61, 0.1)" },
  { key: "new" as const, label: "New", icon: UserPlus, color: "text-blue-400", bg: "rgba(59, 130, 246, 0.1)" },
  { key: "contacted" as const, label: "Contacted", icon: Phone, color: "text-amber-400", bg: "rgba(245, 158, 11, 0.1)" },
  { key: "qualified" as const, label: "Qualified", icon: CheckCircle, color: "text-purple-400", bg: "rgba(168, 85, 247, 0.1)" },
  { key: "booked" as const, label: "Booked", icon: Calendar, color: "text-emerald-400", bg: "rgba(16, 185, 129, 0.1)" },
  { key: "closed" as const, label: "Closed", icon: Trophy, color: "text-rose-400", bg: "rgba(244, 63, 94, 0.1)" },
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
              <div className="rounded-lg p-2" style={{ background: card.bg }}>
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
