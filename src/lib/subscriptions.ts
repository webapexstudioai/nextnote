export type SubscriptionTier = "starter" | "pro";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled";

export interface TierConfig {
  name: string;
  tier: SubscriptionTier;
  tagline: string;
  features: string[];
  bonusCredits: number;
  // Monthly subscription price in USD cents. Kept here only for UI / admin
  // margin math — the authoritative price lives in Stripe (env-configured
  // price IDs STRIPE_PRICE_STARTER / STRIPE_PRICE_PRO).
  monthlyPriceCents: number;
  limits: {
    prospects: number;
    folders: number;
    aiSummariesPerMonth: number;
    customization: boolean;
    spreadsheetImport: boolean;
    googleCalendar: boolean;
    voicemailTools: boolean;
    teamMembers: number;
  };
}

export const TIERS: Record<SubscriptionTier, TierConfig> = {
  starter: {
    name: "Starter",
    tier: "starter",
    tagline: "For owner-operators just trying it out",
    bonusCredits: 150,
    monthlyPriceCents: 2900,
    features: [
      "Build AI receptionists for your clients · charge them monthly, keep the markup",
      "Generate pitch sites for any prospect · close them with a personalized link",
      "Prospect pipeline + folders (up to 100 leads)",
      "Appointment booking",
      "150 AI credits included",
    ],
    limits: {
      prospects: 100,
      folders: 5,
      aiSummariesPerMonth: 0,
      customization: false,
      spreadsheetImport: false,
      googleCalendar: false,
      voicemailTools: false,
      teamMembers: 1,
    },
  },
  pro: {
    name: "Pro",
    tier: "pro",
    tagline: "For service businesses running full ops",
    bonusCredits: 250,
    monthlyPriceCents: 7900,
    features: [
      "Everything in Starter",
      "Voicemail drops · ringless reach-out at scale",
      "Google Calendar + Meet booking sync",
      "Gmail confirmation emails",
      "AI insights + meeting note summaries",
      "Spreadsheet import (XLSX)",
      "Up to 1,000 prospects · 25 folders",
      "250 AI credits included · full customization",
    ],
    limits: {
      prospects: 1000,
      folders: 25,
      aiSummariesPerMonth: 200,
      customization: true,
      spreadsheetImport: true,
      googleCalendar: true,
      voicemailTools: true,
      teamMembers: 1,
    },
  },
};

export const ACCENT_COLORS = [
  { id: "red-orange", label: "Red Orange", css: "#e8553d", hover: "#f06a54", glow: "rgba(232, 85, 61, 0.15)" },
  { id: "blue", label: "Blue", css: "#3b82f6", hover: "#60a5fa", glow: "rgba(59, 130, 246, 0.15)" },
  { id: "purple", label: "Purple", css: "#8b5cf6", hover: "#a78bfa", glow: "rgba(139, 92, 246, 0.15)" },
  { id: "green", label: "Green", css: "#22c55e", hover: "#4ade80", glow: "rgba(34, 197, 94, 0.15)" },
  { id: "amber", label: "Amber", css: "#f59e0b", hover: "#fbbf24", glow: "rgba(245, 158, 11, 0.15)" },
  { id: "pink", label: "Pink", css: "#ec4899", hover: "#f472b6", glow: "rgba(236, 72, 153, 0.15)" },
  { id: "cyan", label: "Cyan", css: "#06b6d4", hover: "#22d3ee", glow: "rgba(6, 182, 212, 0.15)" },
] as const;

export type AccentColorId = (typeof ACCENT_COLORS)[number]["id"];

export const UI_DENSITIES = [
  { id: "compact", label: "Compact", scale: 0.9 },
  { id: "default", label: "Default", scale: 1.0 },
  { id: "comfortable", label: "Comfortable", scale: 1.1 },
] as const;

export type UIDensityId = (typeof UI_DENSITIES)[number]["id"];

export function getAccentColor(id: string) {
  return ACCENT_COLORS.find((c) => c.id === id) ?? ACCENT_COLORS[0];
}

export function getUIDensity(id: string) {
  return UI_DENSITIES.find((d) => d.id === id) ?? UI_DENSITIES[1];
}
