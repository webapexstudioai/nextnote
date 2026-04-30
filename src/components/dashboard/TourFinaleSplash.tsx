"use client";

import { useEffect, useState } from "react";
import { OrbitGridIcon, NextNoteWordmark } from "@/components/OrbitGridLogo";

const FINALE_KEY = "nextnote_tour_finale_shown";
export const FINALE_EVENT = "nextnote:tour-finale";

export default function TourFinaleSplash() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => {
      try {
        if (window.localStorage.getItem(FINALE_KEY) === "1") return;
        window.localStorage.setItem(FINALE_KEY, "1");
      } catch {}
      setVisible(true);
      // Total: 400ms fade in + 1500ms hold + 500ms fade out = 2400ms
      setTimeout(() => setVisible(false), 2400);
    };
    window.addEventListener(FINALE_EVENT, handler);
    return () => window.removeEventListener(FINALE_EVENT, handler);
  }, []);

  if (!visible) return null;

  return (
    <div className="tour-finale-overlay" aria-hidden>
      <div className="tour-finale-inner">
        <div className="tour-finale-logo">
          <OrbitGridIcon size={140} />
        </div>
        <h2 className="tour-finale-title">
          Welcome to <NextNoteWordmark />,
        </h2>
        <p className="tour-finale-sub">the best unfair advantage to close.</p>
      </div>
    </div>
  );
}
