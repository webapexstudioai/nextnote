"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, Calendar, Settings, LogOut, Zap, Crown, Phone,
  BarChart3, Bot, Coins, Globe, MapPin, LifeBuoy, MessageSquare, Sparkles,
  ChevronRight, Megaphone,
} from "lucide-react";
import { OrbitGridIcon, NextNoteWordmark } from "@/components/OrbitGridLogo";
import { TIERS, SubscriptionTier } from "@/lib/subscriptions";

interface SidebarProps {
  collapsed?: boolean;
}

type NavLeaf = {
  type: "item";
  icon: React.ElementType;
  label: string;
  href: string;
  minTier: SubscriptionTier;
  tourId: string;
};

type NavGroup = {
  type: "group";
  icon: React.ElementType;
  label: string;
  tourId: string;
  children: NavLeaf[];
};

type NavEntry = NavLeaf | NavGroup;

const navItems: NavEntry[] = [
  { type: "item", icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", minTier: "starter", tourId: "nav-dashboard" },
  { type: "item", icon: Users, label: "Prospects", href: "/dashboard/prospects", minTier: "starter", tourId: "nav-prospects" },
  { type: "item", icon: MapPin, label: "Sources", href: "/dashboard/sources", minTier: "starter", tourId: "nav-sources" },
  { type: "item", icon: Calendar, label: "Appointments", href: "/dashboard/appointments", minTier: "starter", tourId: "nav-appointments" },
  {
    type: "group", icon: Sparkles, label: "AI", tourId: "nav-group-ai",
    children: [
      { type: "item", icon: Zap, label: "Insights", href: "/dashboard/ai-insights", minTier: "pro", tourId: "nav-ai-insights" },
      { type: "item", icon: Bot, label: "Agents", href: "/dashboard/agents", minTier: "starter", tourId: "nav-agents" },
      { type: "item", icon: Globe, label: "Websites", href: "/dashboard/websites", minTier: "starter", tourId: "nav-websites" },
    ],
  },
  {
    type: "group", icon: MessageSquare, label: "Outreach", tourId: "nav-group-outreach",
    children: [
      { type: "item", icon: Phone, label: "Agency Phone", href: "/dashboard/agency-phone", minTier: "starter", tourId: "nav-agency-phone" },
      { type: "item", icon: Megaphone, label: "Voicedrops", href: "/dashboard/voicedrops", minTier: "pro", tourId: "nav-voicedrops" },
      { type: "item", icon: MessageSquare, label: "Templates", href: "/dashboard/sms-templates", minTier: "starter", tourId: "nav-sms-templates" },
      { type: "item", icon: MessageSquare, label: "Sequences", href: "/dashboard/sms-sequences", minTier: "starter", tourId: "nav-sms-sequences" },
    ],
  },
  { type: "item", icon: BarChart3, label: "Analytics", href: "/dashboard/analytics", minTier: "starter", tourId: "nav-analytics" },
  { type: "item", icon: Coins, label: "Billing", href: "/dashboard/billing", minTier: "starter", tourId: "nav-billing" },
  { type: "item", icon: LifeBuoy, label: "Support", href: "/dashboard/support", minTier: "starter", tourId: "nav-support" },
  { type: "item", icon: Settings, label: "Settings", href: "/dashboard/settings", minTier: "starter", tourId: "nav-settings" },
];

const tierRank: Record<SubscriptionTier, number> = {
  starter: 0,
  pro: 1,
};

const GROUP_STORAGE_KEY = "nextnote_sidebar_groups_v1";

export default function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname();
  const [profile, setProfile] = useState({ name: "User", agencyName: "NextNote", subscriptionTier: "starter" as SubscriptionTier, profileImageUrl: null as string | null });
  const [supportUnread, setSupportUnread] = useState(0);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const defaults: Record<string, boolean> = {};
    for (const entry of navItems) {
      if (entry.type === "group") {
        defaults[entry.label] = entry.children.some((c) => pathname === c.href);
      }
    }
    let stored: Record<string, boolean> = {};
    try {
      const raw = window.localStorage.getItem(GROUP_STORAGE_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch {}
    setOpenGroups({ ...defaults, ...stored });
  }, [pathname]);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try {
        window.localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/support/threads");
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        const threads = (json.threads ?? []) as { unread: boolean }[];
        setSupportUnread(threads.filter((t) => t.unread).length);
      } catch {}
    }
    load();
    const int = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(int);
    };
  }, [pathname]);

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

  function isLeafAccessible(leaf: NavLeaf) {
    return tierRank[profile.subscriptionTier] >= tierRank[leaf.minTier];
  }

  function renderLeaf(leaf: NavLeaf, opts: { nested?: boolean } = {}) {
    const Icon = leaf.icon;
    const isActive = pathname === leaf.href;
    const nested = !!opts.nested;
    return (
      <Link
        key={leaf.label}
        href={leaf.href}
        data-tour-id={leaf.tourId}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty("--sx", `${e.clientX - r.left}px`);
          e.currentTarget.style.setProperty("--sy", `${e.clientY - r.top}px`);
        }}
        className={`nav-spotlight w-full flex items-center gap-3 ${nested && !collapsed ? "pl-9 pr-3 py-2" : "px-3 py-2.5"} rounded-lg text-sm transition-colors ${
          isActive
            ? "text-[var(--accent)]"
            : "text-[var(--muted)] hover:text-[var(--foreground)]"
        }`}
        style={isActive ? { background: "rgba(232, 85, 61, 0.12)", color: "#e8553d" } : undefined}
      >
        {(!nested || collapsed) && <Icon className="w-4 h-4 shrink-0" />}
        {!collapsed && (
          <span className="relative z-[1] flex flex-1 items-center justify-between">
            <span>{leaf.label}</span>
            {leaf.label === "Support" && supportUnread > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {supportUnread}
              </span>
            )}
          </span>
        )}
      </Link>
    );
  }

  function renderGroup(group: NavGroup) {
    const accessibleChildren = group.children.filter(isLeafAccessible);
    if (accessibleChildren.length === 0) return null;

    const Icon = group.icon;
    const containsActive = accessibleChildren.some((c) => pathname === c.href);

    if (collapsed) {
      return (
        <div key={group.label} className="space-y-1">
          {accessibleChildren.map((child) => renderLeaf(child))}
        </div>
      );
    }

    const isOpen = openGroups[group.label] ?? containsActive;

    return (
      <div key={group.label} className="space-y-1">
        <button
          type="button"
          data-tour-id={group.tourId}
          onClick={() => toggleGroup(group.label)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            containsActive ? "text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <Icon className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-left">{group.label}</span>
          <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
        </button>
        {isOpen && (
          <div className="space-y-1">
            {accessibleChildren.map((child) => renderLeaf(child, { nested: true }))}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside data-tour-id="sidebar" className={`liquid-glass-strong flex flex-col h-screen border-r border-white/5 ${collapsed ? "w-16" : "w-56"} transition-all duration-300 shrink-0`}>
      <div className="p-5 border-b border-white/5">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <OrbitGridIcon size={30} />
          {!collapsed && <NextNoteWordmark className="text-xl" />}
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((entry) => {
          if (entry.type === "item") {
            return isLeafAccessible(entry) ? renderLeaf(entry) : null;
          }
          return renderGroup(entry);
        })}
      </nav>

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
