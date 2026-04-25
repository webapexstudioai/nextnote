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
 * then highlights it. No more "highlight the sidebar and hope they figure it out".
 */
const TOUR_STEPS: TourStep[] = [
  {
    element: '[data-tour-id="sidebar"]',
    title: "Welcome to NextNote",
    description:
      "This is your outbound command center. Everything — prospects, calls, AI agents, billing — lives in this sidebar. I'll walk you through each section in about a minute.",
    side: "right",
  },
  {
    element: '[data-tour-id="nav-prospects"]',
    route: "/dashboard/prospects",
    title: "Prospects — the heart of NextNote",
    description:
      "Click Next and I'll take you to the Prospects page so you can see how the pipeline works.",
    side: "right",
  },
  {
    element: '[data-tour-id="prospects-import"]',
    title: "Import your list",
    description:
      "Upload a CSV or XLSX — Claude auto-maps columns like Name, Phone, Company. Bring your own prospects or pull from Sources.",
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
    title: "Your Kanban pipeline",
    description:
      "Drag prospects through stages: New → Contacted → Qualified → Booked → Closed. Click any card for a full detail panel with call history, voicedrops, and deal value.",
    side: "top",
  },
  {
    element: '[data-tour-id="nav-sources"]',
    route: "/dashboard/sources",
    title: "Sources — find new prospects",
    description:
      "Next up: how to fill your pipeline when you don't have a list yet.",
    side: "right",
  },
  {
    element: '[data-tour-id="sources-niche"]',
    title: "Type a niche, pick a region",
    description:
      "Tell NextNote who you want (e.g. 'Plumbers') and where. We'll pull verified prospects with phone numbers into a folder ready to work. 5 credits per prospect.",
    side: "bottom",
  },
  {
    element: '[data-tour-id="nav-appointments"]',
    route: "/dashboard/appointments",
    title: "Appointments",
    description:
      "Every booked meeting shows here — let's take a look.",
    side: "right",
  },
  {
    element: '[data-tour-id="appointments-calendar"]',
    title: "Calendar + Google sync",
    description:
      "Bookings auto-create Google Calendar events with Meet links. Confirmation emails send from your Gmail once you connect it in Settings → Integrations.",
    side: "top",
  },
  {
    element: '[data-tour-id="nav-agents"]',
    route: "/dashboard/agents",
    title: "AI Agents — voice receptionists",
    description:
      "Build an AI agent that answers calls for you 24/7. Let me show you.",
    side: "right",
  },
  {
    element: '[data-tour-id="agents-buy-number"]',
    title: "Buy a US phone number",
    description:
      "500 credits one-time + 500/mo. Point the number at any agent and it handles inbound calls in your voice — no call-center needed.",
    side: "bottom",
  },
  {
    element: '[data-tour-id="nav-websites"]',
    route: "/dashboard/websites",
    title: "AI Websites",
    description:
      "Generate a full custom landing page for any prospect in ~60 seconds. Great for pitching before a call.",
    side: "right",
  },
  {
    element: '[data-tour-id="websites-generate"]',
    title: "Generate in one click",
    description:
      "Describe the business, pick a style, hit generate. You get a live, editable website on a NextNote subdomain.",
    side: "left",
  },
  {
    element: '[data-tour-id="nav-billing"]',
    route: "/dashboard/billing",
    title: "Credits run everything",
    description:
      "1 credit = $0.01. Voicemail drops, AI calls, websites, prospect imports — all metered in credits.",
    side: "right",
  },
  {
    element: '[data-tour-id="billing-topup"]',
    title: "Top up anytime",
    description:
      "Pick a preset or type a custom amount — credits never expire. Your subscription includes a monthly allotment; top-ups only kick in if you go above it.",
    side: "top",
  },
  {
    title: "You're good to go",
    description:
      "Start with Sources or Prospects to build your first pipeline. You can re-run this tour anytime from Settings → Profile.",
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
