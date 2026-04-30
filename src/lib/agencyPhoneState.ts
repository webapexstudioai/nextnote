// Client-safe helpers for agency phone trial state. No server-only imports
// here — anything in agencyPhone.ts pulls in supabaseAdmin/stripe and must
// stay server-side.

export const TRIAL_DAYS = 14;
export const TRIAL_GRACE_DAYS = 3;

export type AgencyTrialKind = "paid" | "trial" | "grace" | "expired" | "none";

export function getAgencyTrialState(opts: {
  trialEndsAt: string | null | undefined;
  hasRow: boolean;
}): { kind: AgencyTrialKind; daysLeft: number } {
  if (!opts.hasRow) return { kind: "none", daysLeft: 0 };
  if (!opts.trialEndsAt) return { kind: "paid", daysLeft: 0 };
  const endsAt = new Date(opts.trialEndsAt).getTime();
  const graceEndsAt = endsAt + TRIAL_GRACE_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const daysLeft = Math.max(0, Math.ceil((endsAt - now) / (24 * 60 * 60 * 1000)));
  if (now < endsAt) return { kind: "trial", daysLeft };
  if (now < graceEndsAt) return { kind: "grace", daysLeft: 0 };
  return { kind: "expired", daysLeft: 0 };
}
