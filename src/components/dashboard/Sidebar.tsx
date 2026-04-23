"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Users, Calendar, Settings, LogOut, Zap, Crown, Phone, BarChart3, Bot, Coins, Globe, MapPin } from "lucide-react";
import { OrbitGridIcon } from "@/components/OrbitGridLogo";
import { TIERS, SubscriptionTier } from "@/lib/subscriptions";

interface SidebarProps {
  collapsed?: boolean;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", minTier: "starter", tourId: "nav-dashboard" },
  { icon: Users, label: "Prospects", href: "/dashboard/prospects", minTier: "starter", tourId: "nav-prospects" },
  { icon: MapPin, label: "Sources", href: "/dashboard/sources", minTier: "starter", tourId: "nav-sources" },
  { icon: Calendar, label: "Appointments", href: "/dashboard/appointments", minTier: "starter", tourId: "nav-appointments" },
  { icon: Zap, label: "AI Insights", href: "/dashboard/ai-insights", minTier: "pro", tourId: "nav-ai-insights" },
  { icon: Bot, label: "AI Agents", href: "/dashboard/agents", minTier: "starter", tourId: "nav-agents" },
  { icon: Globe, label: "AI Websites", href: "/dashboard/websites", minTier: "starter", tourId: "nav-websites" },
  { icon: BarChart3, label: "Analytics", href: "/dashboard/analytics", minTier: "starter", tourId: "nav-analytics" },
  { icon: Coins, label: "Billing", href: "/dashboard/billing", minTier: "starter", tourId: "nav-billing" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings", minTier: "starter", tourId: "nav-settings" },
] as const;

const tierRank: Record<SubscriptionTier, number> = {
  starter: 0,
  pro: 1,
};

export default function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname();
  const [profile, setProfile] = useState({ name: "User", agencyName: "NextNote", subscriptionTier: "starter" as SubscriptionTier, profileImageUrl: null as string | null });

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      const applyUser = (user?: { name?: string; agencyName?: string; subscriptionTier?: string; profileImageUrl?: string | null } | null) => {
        if (!mounted || !user) return;
        setProfile({
          name: user.name || "User",
          agencyName: user.agencyName || "NextNote",
          subscriptionTier: (user.subscriptionTier || "starter") as SubscriptionTier,
          profileImageUrl: user.profileImageUrl || null,
        });
      };

      fetch("/api/auth/me")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => applyUser(data?.user))
        .catch(() => {});

      const syncFromStorage = () => {
        try {
          const raw = window.localStorage.getItem("nextnote_profile_preview");
          if (!raw) return;
          applyUser(JSON.parse(raw));
        } catch {}
      };

      syncFromStorage();
      window.addEventListener("storage", syncFromStorage);
      window.addEventListener("nextnote:profile-updated", syncFromStorage as EventListener);

      return () => {
        window.removeEventListener("storage", syncFromStorage);
        window.removeEventListener("nextnote:profile-updated", syncFromStorage as EventListener);
      };
    };

    let cleanup: (() => void) | undefined;
    loadProfile().then((fn) => {
      cleanup = fn;
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/auth/login";
  }

  return (
    <aside data-tour-id="sidebar" className={`liquid-glass-strong flex flex-col h-screen border-r border-white/5 ${collapsed ? "w-16" : "w-56"} transition-all duration-300 shrink-0`}>
      {/* Logo */}
      <div className="p-5 border-b border-white/5">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <OrbitGridIcon size={30} />
          {!collapsed && (
            <h1 className="font-bold text-xl tracking-tight leading-none">Next<span className="text-[var(--accent)]">Note</span></h1>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems
          .filter((item) => tierRank[profile.subscriptionTier] >= tierRank[item.minTier])
          .map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              data-tour-id={item.tourId}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty("--sx", `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty("--sy", `${e.clientY - r.top}px`);
              }}
              className={`nav-spotlight w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "text-[var(--accent)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
              style={isActive ? { background: "rgba(232, 85, 61, 0.12)", color: "#e8553d" } : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="relative z-[1]">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#e8553d] to-[#ff8a6a] flex items-center justify-center shrink-0 overflow-hidden">
            {profile.profileImageUrl ? (
              <img src={profile.profileImageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-bold text-xs">{profile.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile.name}</p>
              <p className="text-[10px] text-[var(--muted)] truncate">{profile.agencyName}</p>
              <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-[rgba(232,85,61,0.2)] bg-[rgba(232,85,61,0.08)] px-2 py-0.5 text-[10px] text-[var(--accent)]">
                <Crown className="w-3 h-3" />
                {TIERS[profile.subscriptionTier].name}
              </div>
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
