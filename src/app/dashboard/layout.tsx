"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import Sidebar from "@/components/dashboard/Sidebar";
import { ProspectsProvider } from "@/context/ProspectsContext";
import { ACCENT_COLORS, UI_DENSITIES } from "@/lib/subscriptions";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Load and apply user customization on mount
  useEffect(() => {
    async function loadCustomization() {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) return;
        const s = await res.json();

        const color = ACCENT_COLORS.find((c) => c.id === s.accent_color);
        if (color) {
          document.documentElement.style.setProperty("--accent", color.css);
          document.documentElement.style.setProperty("--accent-hover", color.hover);
          document.documentElement.style.setProperty("--accent-glow", color.glow);
        }

        const density = UI_DENSITIES.find((d) => d.id === s.ui_density);
        if (density) {
          document.documentElement.style.setProperty("--ui-scale", density.scale.toString());
        }
      } catch {
        // Silently ignore — defaults apply
      }
    }
    loadCustomization();
  }, []);

  return (
    <ProspectsProvider>
      <div className="flex h-screen bg-[var(--background)]">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {/* Mobile Header */}
          <div className="lg:hidden sticky top-0 z-30 bg-[rgba(10,10,15,0.85)] backdrop-blur-xl border-b border-[var(--border)] px-4 py-3">
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2 rounded-lg hover:bg-[var(--card)] transition-colors"
            >
              {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {children}
        </main>

        {/* Mobile Menu Overlay */}
        {showMobileMenu && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileMenu(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-56">
              <Sidebar />
            </div>
          </div>
        )}
      </div>
    </ProspectsProvider>
  );
}
