"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import Sidebar from "@/components/dashboard/Sidebar";
import CursorSpotlight from "@/components/dashboard/CursorSpotlight";
import OnboardingTour from "@/components/dashboard/OnboardingTour";
import GuidedTour from "@/components/dashboard/GuidedTour";
import TourFinaleSplash from "@/components/dashboard/TourFinaleSplash";
import CreditGiftCelebration from "@/components/dashboard/CreditGiftCelebration";
import ImpersonationBanner from "@/components/dashboard/ImpersonationBanner";
import TrialBanner from "@/components/dashboard/TrialBanner";
import { ProspectsProvider } from "@/context/ProspectsContext";

function applyAccent(hex: string) {
  const clean = /^#?([0-9a-fA-F]{6})$/.exec(hex)?.[1];
  if (!clean) return;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const lighten = (c: number) => Math.min(255, Math.round(c + (255 - c) * 0.15));
  const hover = `#${[lighten(r), lighten(g), lighten(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  const root = document.documentElement;
  root.style.setProperty("--accent", `#${clean}`);
  root.style.setProperty("--accent-hover", hover);
  root.style.setProperty("--accent-rgb", `${r}, ${g}, ${b}`);
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    try {
      const cached = window.localStorage.getItem("nextnote_theme");
      if (cached === "light" || cached === "dark") {
        root.setAttribute("data-theme", cached);
      }
      const cachedAccent = window.localStorage.getItem("nextnote_accent");
      if (cachedAccent) applyAccent(cachedAccent);
      const cachedIntensity = window.localStorage.getItem("nextnote_bg_intensity");
      if (cachedIntensity === "minimal" || cachedIntensity === "balanced" || cachedIntensity === "cinematic") {
        root.setAttribute("data-bg-intensity", cachedIntensity);
      }
    } catch {}

    async function loadCustomization() {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) return;
        const s = await res.json();
        const theme = s.theme_mode || "dark";
        root.setAttribute("data-theme", theme);
        if (s.accent_color) applyAccent(s.accent_color);
        const intensity = s.background_intensity || "balanced";
        root.setAttribute("data-bg-intensity", intensity);
        try {
          window.localStorage.setItem("nextnote_theme", theme);
          if (s.accent_color) window.localStorage.setItem("nextnote_accent", s.accent_color);
          window.localStorage.setItem("nextnote_bg_intensity", intensity);
        } catch {}
      } catch {
        // Silently ignore — defaults apply
      }
    }
    loadCustomization();
  }, []);

  return (
    <ProspectsProvider>
      <ImpersonationBanner />
      <div className="relative flex h-screen bg-[var(--background)]">
        <div className="dashboard-stage" aria-hidden />
        <div className="ambient-bg" aria-hidden>
          <div className="ambient-mid" />
        </div>
        <CursorSpotlight />
        <div className="hidden lg:block relative z-10">
          <Sidebar />
        </div>

        <main className="flex-1 overflow-y-auto relative z-[1]" style={{ isolation: "isolate" }}>
          <div className="lg:hidden sticky top-0 z-30 liquid-glass-strong border-b border-white/5 px-4 py-3">
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2 rounded-lg hover:bg-[var(--card)] transition-colors"
            >
              {showMobileMenu ? <X className="w-5 h-5 text-[var(--foreground)]" /> : <Menu className="w-5 h-5 text-[var(--foreground)]" />}
            </button>
          </div>

          <TrialBanner />
          {children}
        </main>

        <OnboardingTour />
        <GuidedTour />
        <TourFinaleSplash />
        <CreditGiftCelebration />

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
