"use client";

import { useEffect, useState } from "react";
import { Gift, Sparkles, X } from "lucide-react";

const SEEN_KEY = "nextnote_gifts_seen";
const DISPLAY_MS = 5200;

interface Gift {
  id: string;
  amount: number;
  note: string | null;
  createdAt: string;
}

function getSeen(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function markSeen(id: string) {
  try {
    const set = getSeen();
    set.add(id);
    // Cap at 50 IDs so localStorage doesn't grow forever
    const arr = Array.from(set).slice(-50);
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch {}
}

export default function CreditGiftCelebration() {
  const [queue, setQueue] = useState<Gift[]>([]);
  const [current, setCurrent] = useState<Gift | null>(null);
  const [closing, setClosing] = useState(false);

  // Poll for new gifts on mount + when the tab regains focus
  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const res = await fetch("/api/credits/gifts", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { gifts?: Gift[] };
        if (!mounted) return;
        const seen = getSeen();
        const fresh = (json.gifts ?? [])
          .filter((g) => !seen.has(g.id))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        if (fresh.length > 0) {
          setQueue((q) => [...q, ...fresh]);
        }
      } catch {
        // network errors — not worth surfacing
      }
    };

    check();
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => {
      mounted = false;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // Dequeue into current
  useEffect(() => {
    if (current || queue.length === 0) return;
    const next = queue[0];
    setQueue((q) => q.slice(1));
    setClosing(false);
    setCurrent(next);
    markSeen(next.id);

    const closeTimer = setTimeout(() => setClosing(true), DISPLAY_MS - 600);
    const clearTimer = setTimeout(() => setCurrent(null), DISPLAY_MS);
    return () => {
      clearTimeout(closeTimer);
      clearTimeout(clearTimer);
    };
  }, [queue, current]);

  if (!current) return null;

  const dismissNow = () => {
    setClosing(true);
    setTimeout(() => setCurrent(null), 400);
  };

  return (
    <div className={`gift-overlay ${closing ? "gift-closing" : ""}`} aria-live="polite">
      <div className="gift-backdrop" onClick={dismissNow} />

      {/* Confetti layer */}
      <div className="gift-confetti" aria-hidden>
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} className={`gift-confetti-piece gift-confetti-${i % 6}`} style={{ left: `${(i * 5.6 + 2) % 100}%` }} />
        ))}
      </div>

      <div className="gift-card">
        <button className="gift-close" onClick={dismissNow} aria-label="Close">
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="gift-shine" aria-hidden />

        <div className="gift-badge">
          <Sparkles className="w-3 h-3" />
          Reward unlocked
        </div>

        <div className="gift-icon-wrap">
          <span className="gift-icon-ring" aria-hidden />
          <span className="gift-icon-ring gift-icon-ring-2" aria-hidden />
          <div className="gift-icon">
            <Gift className="w-8 h-8" />
          </div>
        </div>

        <div className="gift-amount">
          <span className="gift-amount-plus">+</span>
          {current.amount.toLocaleString()}
        </div>
        <div className="gift-amount-unit">credits added to your balance</div>

        <div className="gift-divider" aria-hidden />

        {current.note ? (
          <p className="gift-note">&ldquo;{current.note}&rdquo;</p>
        ) : (
          <p className="gift-note gift-note-muted">A little something from the NextNote team</p>
        )}

        <button className="gift-cta" onClick={dismissNow}>
          Awesome, thanks
        </button>
      </div>
    </div>
  );
}
