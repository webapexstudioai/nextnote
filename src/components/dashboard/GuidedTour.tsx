"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { FINALE_EVENT } from "@/components/dashboard/TourFinaleSplash";

const TOUR_KEY = "nextnote_guided_tour_done";
const LAUNCH_EVENT = "nextnote:start-tour";

type TourStep = {
  element?: string;
  route?: string;
  title: string;
  description: string;
  side?: "top" | "bottom" | "left" | "right";
};

/**
 * The tour actually walks users through each page — clicking Next on a step
 * with a `route` navigates to that page, waits for the target to mount,
 * then highlights it. On pages like Sources it steps through the ACTUAL
 * workflow (type niche → pick location → choose count → hit import).
 */
const TOUR_STEPS: TourStep[] = [
  {
    element: '[data-tour-id="sidebar"]',
    title: "Welcome to NextNote",
    description:
      "This is your outbound command center. Everything — prospects, calls, AI agents, billing — lives in this sidebar. I'll walk you through each section in about 90 seconds.",
    side: "right",
  },

  // ─── Prospects ────────────────────────────────────────────
  {
    element: '[data-tour-id="prospects-import"]',
    route: "/dashboard/prospects",
    title: "Prospects — import your list",
    description:
      "First stop: the Prospects page. Click this Import button to upload a CSV or XLSX — Claude auto-maps columns like Name, Phone, and Company.",
    side: "bottom",
  },
  {
    element: '[data-tour-id="prospects-add"]',
    title: "Or add one at a time",
    description:
      "Type in a single prospect — name, phone, notes. Good for the occasional one-off lead.",
    side: "bottom",
  },
  {
    element: '[data-tour-id="prospects-kanban"]',
    title: "Drag through your pipeline",
    description:
      "Prospects flow through New → Contacted → Qualified → Booked → Closed. Drag cards between columns. Click any card for a full detail panel with call history, voicedrops, and deal value.",
    side: "top",
  },

  // ─── Sources ──────────────────────────────────────────────
  {
    element: '[data-tour-id="sources-niche"]',
    route: "/dashboard/sources",
    title: "Sources — don't have a list yet?",
    description:
      "No prospects? No problem. Sources pulls real businesses with phone numbers in ~60 seconds. Start here: type a niche (Plumbers, Roofers, Dentists…).",
    side: "bottom",
  },
  {
    element: '[data-tour-id="sources-location"]',
    title: "Pick where they are",
    description:
      "Choose a state — and optionally narrow down to a city. This is how you keep the list geographically focused so the outreach actually converts.",
    side: "bottom",
  },
  {
    element: '[data-tour-id="sources-count"]',
    title: "Choose how many",
    description:
      "25, 50, or 100 per batch. Each prospect costs 5 credits — and you're only charged for ones that come back with a verified phone number.",
    side: "top",
  },
  {
    element: '[data-tour-id="sources-import"]',
    title: "Hit import",
    description:
      "Click this and NextNote drops the results into a new folder under Prospects, ready to call, email, or voicedrop. That's how you go from zero to a working pipeline in under a minute.",
    side: "top",
  },

  // ─── Appointments ─────────────────────────────────────────
  {
    element: '[data-tour-id="appointments-calendar"]',
    route: "/dashboard/appointments",
    title: "Appointments — every booking in one view",
    description:
      "Bookings auto-create Google Calendar events with Meet links. Confirmation emails send from your Gmail once you connect it in Settings → Integrations.",
    side: "top",
  },

  // ─── Agents ───────────────────────────────────────────────
  {
    element: '[data-tour-id="agents-buy-number"]',
    route: "/dashboard/agents",
    title: "AI Agents — voice receptionists",
    description:
      "Buy a US phone number (500 credits one-time, 500/mo) and point it at an AI agent. It answers calls in your voice 24/7 — no call-center needed.",
    side: "bottom",
  },

  // ─── Websites ─────────────────────────────────────────────
  {
    element: '[data-tour-id="websites-generate"]',
    route: "/dashboard/websites",
    title: "AI Websites — custom page in 60s",
    description:
      "Describe the business, pick a style, hit generate. You get a live, editable landing page on a NextNote subdomain — great for pitching a prospect before the call.",
    side: "left",
  },

  // ─── Billing ──────────────────────────────────────────────
  {
    element: '[data-tour-id="billing-topup"]',
    route: "/dashboard/billing",
    title: "Credits run everything",
    description:
      "1 credit = $0.01. Voicemail drops, AI calls, websites, prospect imports — all metered in credits. Top up anytime; credits never expire.",
    side: "top",
  },

  // ─── Finish ───────────────────────────────────────────────
  {
    title: "You're good to go",
    description:
      "Start with Sources to build your first folder, or import a list you already have. You can re-run this tour anytime from Settings → Profile.",
  },
];

function waitForElement(selector: string, timeout = 4000): Promise<Element | null> {
  return new Promise((resolve) => {
    const found = document.querySelector(selector);
    if (found) return resolve(found);

    const start = Date.now();
    const interval = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(interval);
        resolve(el);
      } else if (Date.now() - start > timeout) {
        clearInterval(interval);
        resolve(null);
      }
    }, 80);
  });
}

export default function GuidedTour() {
  const driverRef = useRef<Driver | null>(null);
  const router = useRouter();

  useEffect(() => {
    const build = () => {
      let reachedLast = false;

      // driver.js step array — we strip our custom fields (route, side) and
      // map them into the shape driver.js expects.
      const steps = TOUR_STEPS.map((s, idx) => ({
        element: s.element,
        popover: {
          title: s.title,
          description: s.description,
          side: s.side,
          align: "start" as const,
        },
        onHighlightStarted: async () => {
          // If this step needs a specific element and it's not there yet
          // (e.g. we just navigated), wait for it before driver.js tries to
          // position the popover. Driver.js will re-query when we call
          // refresh(), so we wait then nudge.
          if (s.element) {
            const el = await waitForElement(s.element, 3500);
            if (el && driverRef.current) {
              driverRef.current.refresh();
            }
          }
        },
        onNextClick: async () => {
          const next = TOUR_STEPS[idx + 1];
          if (next?.route) {
            router.push(next.route);
            if (next.element) {
              await waitForElement(next.element, 4000);
            } else {
              await new Promise((r) => setTimeout(r, 250));
            }
          }
          driverRef.current?.moveNext();
        },
      }));

      return driver({
        showProgress: true,
        animate: true,
        overlayColor: "rgba(5, 5, 7, 0.78)",
        stagePadding: 6,
        stageRadius: 12,
        allowClose: true,
        progressText: "{{current}} / {{total}}",
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Finish",
        steps,
        onHighlighted: (_el, _step, { state }) => {
          if (typeof state.activeIndex === "number" && state.activeIndex === steps.length - 1) {
            reachedLast = true;
          }
        },
        onDestroyed: () => {
          try {
            window.localStorage.setItem(TOUR_KEY, "1");
          } catch {}
          if (reachedLast) {
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent(FINALE_EVENT));
            }, 150);
          }
        },
      });
    };

    const start = () => {
      if (driverRef.current) driverRef.current.destroy();
      // Always begin the tour on /dashboard/prospects-agnostic territory —
      // we start with a sidebar step so wherever the user is when they trigger
      // it is fine, but we push them back to /dashboard for a consistent start.
      router.push("/dashboard");
      const d = build();
      driverRef.current = d;
      setTimeout(() => d.drive(), 400);
    };

    const handler = () => start();
    window.addEventListener(LAUNCH_EVENT, handler);

    return () => {
      window.removeEventListener(LAUNCH_EVENT, handler);
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
    };
  }, [router]);

  return null;
}

export function startGuidedTour() {
  try {
    window.localStorage.removeItem(TOUR_KEY);
  } catch {}
  window.dispatchEvent(new CustomEvent(LAUNCH_EVENT));
}

/**
 * Fire the guided tour only if the user hasn't seen it before.
 * Used by the onboarding setup-guide modal when the user skips it — first-time
 * only, so returning users who dismiss the setup guide aren't re-prompted.
 */
export function maybeStartGuidedTour(): boolean {
  try {
    if (window.localStorage.getItem(TOUR_KEY) === "1") return false;
  } catch {
    return false;
  }
  window.dispatchEvent(new CustomEvent(LAUNCH_EVENT));
  return true;
}
