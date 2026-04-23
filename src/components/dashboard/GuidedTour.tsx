"use client";

import { useEffect, useRef } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { FINALE_EVENT } from "@/components/dashboard/TourFinaleSplash";

const TOUR_KEY = "nextnote_guided_tour_done";
const LAUNCH_EVENT = "nextnote:start-tour";

const steps = [
  {
    element: '[data-tour-id="sidebar"]',
    popover: {
      title: "Welcome to NextNote",
      description:
        "This is your outbound command center. Everything — prospects, calls, AI agents, billing — lives in this sidebar. Let me show you around in 30 seconds.",
    },
  },
  {
    element: '[data-tour-id="nav-prospects"]',
    popover: {
      title: "Prospects",
      description:
        "Upload a CSV or XLSX and Claude auto-maps your columns into a Kanban pipeline. Each prospect tracks calls, voicedrops, appointments, and deal value.",
    },
  },
  {
    element: '[data-tour-id="nav-sources"]',
    popover: {
      title: "Sources — pull prospects from Google Maps",
      description:
        "New: type a niche and state, hit import, and NextNote fills a folder with verified phone numbers and addresses. 5 credits per prospect.",
    },
  },
  {
    element: '[data-tour-id="nav-appointments"]',
    popover: {
      title: "Appointments",
      description:
        "Book meetings that auto-create Google Calendar events with Meet links. Confirmation emails send from your Gmail address.",
    },
  },
  {
    element: '[data-tour-id="nav-agents"]',
    popover: {
      title: "AI Agents + Phone Numbers",
      description:
        "Build AI voice receptionists in minutes. Buy a US phone number here (500 credits one-time, 500/mo) and point it at your agent to answer calls 24/7.",
    },
  },
  {
    element: '[data-tour-id="nav-websites"]',
    popover: {
      title: "AI Websites",
      description:
        "Generate a full landing page for any prospect in about 60 seconds. Great for pitching — send them their own custom-built site before the call.",
    },
  },
  {
    element: '[data-tour-id="nav-billing"]',
    popover: {
      title: "Credits run everything",
      description:
        "1 credit = $0.01. You spend them on voicemail drops, AI calls, websites, and prospect imports. Top up anytime from here.",
    },
  },
  {
    popover: {
      title: "You're good to go",
      description:
        "Start with Sources or Prospects to build your first pipeline. The setup checklist in the corner tracks the rest — you can reopen this tour anytime from Settings → Profile.",
    },
  },
];

export default function GuidedTour() {
  const driverRef = useRef<Driver | null>(null);

  useEffect(() => {
    const build = () => {
      let reachedLast = false;
      return driver({
        showProgress: true,
        animate: true,
        overlayColor: "rgba(5, 5, 7, 0.78)",
        stagePadding: 6,
        stageRadius: 12,
        allowClose: true,
        progressText: "{{current}} / {{total}}",
        nextBtnText: "Next",
        prevBtnText: "Previous",
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
            // Fire after destroy() has finished its own cleanup so the finale
            // overlay doesn't collide with driver.js's fading popover.
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent(FINALE_EVENT));
            }, 150);
          }
        },
      });
    };

    const start = () => {
      if (driverRef.current) driverRef.current.destroy();
      const d = build();
      driverRef.current = d;
      // Tiny delay so any dismissing modal finishes unmounting before the first
      // step's highlight positions itself.
      setTimeout(() => d.drive(), 250);
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
  }, []);

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
