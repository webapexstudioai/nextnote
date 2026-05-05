"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  ScrollText,
  ArrowUpRight,
  Shield,
  Receipt,
  Wallet,
  ShieldCheck,
  Radio,
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, match: "exact" as const },
  { href: "/admin/users", label: "Users", icon: Users, match: "prefix" as const },
  { href: "/admin/business-profiles", label: "Business profiles", icon: ShieldCheck, match: "prefix" as const },
  { href: "/admin/a2p", label: "10DLC compliance", icon: Radio, match: "prefix" as const },
  { href: "/admin/support", label: "Support", icon: MessageSquare, match: "prefix" as const },
  { href: "/admin/pricing", label: "Pricing", icon: Receipt, match: "prefix" as const },
  { href: "/admin/infrastructure", label: "Infrastructure", icon: Wallet, match: "prefix" as const },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText, match: "prefix" as const },
];

export default function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-neutral-900 bg-neutral-950">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-600/15 text-violet-400">
          <Shield className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight">NextNote</div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">Admin console</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map((item) => {
          const active =
            item.match === "exact" ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-400 hover:bg-neutral-900/60 hover:text-neutral-100"
              }`}
            >
              <Icon
                className={`h-4 w-4 ${active ? "text-violet-400" : "text-neutral-500 group-hover:text-neutral-300"}`}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-neutral-900 px-3 py-4 space-y-2">
        <Link
          href="/dashboard"
          className="flex items-center justify-between rounded-md px-3 py-2 text-xs text-neutral-400 hover:bg-neutral-900/60 hover:text-neutral-100"
        >
          <span>Back to app</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
        <div className="px-3 pt-1">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-800 text-[11px] font-medium text-neutral-300">
              {email.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs text-neutral-300">{email}</div>
              <div className="text-[10px] text-neutral-500">Signed in</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
