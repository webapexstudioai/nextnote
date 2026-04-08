"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Users, Calendar, FileSpreadsheet, Settings, LogOut, Zap } from "lucide-react";
import { OrbitGridIcon } from "@/components/OrbitGridLogo";

interface SidebarProps {
  collapsed?: boolean;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Users, label: "Prospects", href: "/dashboard/prospects" },
  { icon: Calendar, label: "Appointments", href: "/dashboard/appointments" },
  { icon: FileSpreadsheet, label: "Import", href: "/dashboard/import" },
  { icon: Zap, label: "AI Insights", href: "/dashboard/ai-insights" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

export default function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname();
  const [profile, setProfile] = useState({ name: "User", agencyName: "NextNote" });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setProfile({ name: data.user.name || "User", agencyName: data.user.agencyName || "NextNote" });
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/auth/login";
  }

  return (
    <aside className={`flex flex-col h-screen bg-[var(--card)] border-r border-[var(--border)] ${collapsed ? "w-16" : "w-56"} transition-all duration-300 shrink-0`}>
      {/* Logo */}
      <div className="p-5 border-b border-[var(--border)]">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <OrbitGridIcon size={30} />
          {!collapsed && (
            <div>
              <h1 className="font-bold text-sm tracking-tight">Next<span className="text-[var(--accent)]">Note</span></h1>
              <p className="text-[10px] text-[var(--muted)]">by Apex Studio</p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-hover)]"
              }`}
              style={isActive ? { background: "rgba(232, 85, 61, 0.1)", color: "#e8553d" } : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="p-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#e8553d] to-[#ff8a6a] flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs">{profile.name.charAt(0).toUpperCase()}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile.name}</p>
              <p className="text-[10px] text-[var(--muted)] truncate">{profile.agencyName}</p>
            </div>
          )}
          {!collapsed && (
            <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-[var(--card-hover)] transition-colors">
              <LogOut className="w-4 h-4 text-[var(--muted)]" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
