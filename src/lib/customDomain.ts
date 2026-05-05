// Shared logic for "BYO custom domain" attach/verify/detach flows.
// Used by both the explicit /api/websites/[id]/domain route and the chat
// tool inside /api/websites/[id]/edit. Each function returns a discriminated
// union so callers can render UI errors without re-throwing.

import { supabaseAdmin } from "@/lib/supabase";
import {
  attachCustomDomain,
  getDomainConfig,
  getProjectDomainState,
  removeVercelDomain,
  verifyProjectDomain,
  type VerificationRecord,
} from "@/lib/vercelDomains";

const FORBIDDEN_HOST_SUFFIXES = [
  "nextnote.to", "pitchsite.dev", "vercel.app", "localhost",
];

const VERCEL_A_RECORD = "76.76.21.21";
const VERCEL_CNAME = "cname.vercel-dns.com";

export type DnsInstruction = {
  type: "A" | "CNAME";
  host: string;
  value: string;
  ttl: number;
};

export type VerificationDns = {
  type: string;
  host: string;
  value: string;
  reason?: string;
};

export type DomainStatePayload = {
  domain: string | null;
  status: "pending" | "verified" | "error" | null;
  attachedAt: string | null;
  error: string | null;
  isApex: boolean;
  dns: DnsInstruction[];
  verification: VerificationDns[];
  misconfigured?: boolean;
};

export function normalizeDomain(input: unknown): { ok: true; domain: string } | { ok: false; error: string } {
  if (typeof input !== "string") return { ok: false, error: "Domain is required" };
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  if (!d) return { ok: false, error: "Domain is required" };
  if (d.length > 253) return { ok: false, error: "Domain is too long" };
  if (d.includes("*")) return { ok: false, error: "Wildcard domains aren't supported" };
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d)) {
    return { ok: false, error: "That doesn't look like a valid domain" };
  }
  if (FORBIDDEN_HOST_SUFFIXES.some((suffix) => d === suffix || d.endsWith(`.${suffix}`))) {
    return { ok: false, error: "Use a domain you own — not a NextNote-controlled one" };
  }
  return { ok: true, domain: d };
}

export function isApex(domain: string): boolean {
  return domain.split(".").length === 2;
}

export function buildDnsInstructions(domain: string): DnsInstruction[] {
  if (isApex(domain)) {
    return [{ type: "A", host: "@", value: VERCEL_A_RECORD, ttl: 60 }];
  }
  const parts = domain.split(".");
  const host = parts.slice(0, parts.length - 2).join(".");
  return [{ type: "CNAME", host, value: VERCEL_CNAME, ttl: 60 }];
}

export function shapeVerification(records: VerificationRecord[]): VerificationDns[] {
  return records.map((r) => ({
    type: r.type,
    host: r.domain,
    value: r.value,
    reason: r.reason,
  }));
}

type SiteRow = {
  id: string;
  user_id: string;
  custom_domain: string | null;
  custom_domain_status: string | null;
  custom_domain_attached_at: string | null;
  custom_domain_error: string | null;
};

export async function loadOwnedSite(siteId: string, userId: string): Promise<SiteRow | null> {
  const { data, error } = await supabaseAdmin
    .from("generated_websites")
    .select("id, user_id, custom_domain, custom_domain_status, custom_domain_attached_at, custom_domain_error")
    .eq("id", siteId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as SiteRow;
}

function emptyState(): DomainStatePayload {
  return {
    domain: null,
    status: null,
    attachedAt: null,
    error: null,
    isApex: false,
    dns: [],
    verification: [],
  };
}

/** Read live state and reconcile DB. */
export async function getDomainState(siteId: string, userId: string): Promise<
  | { ok: true; state: DomainStatePayload }
  | { ok: false; error: string; status: number }
> {
  const site = await loadOwnedSite(siteId, userId);
  if (!site) return { ok: false, error: "Not found", status: 404 };
  if (!site.custom_domain) return { ok: true, state: emptyState() };

  let verified = site.custom_domain_status === "verified";
  let verification: VerificationRecord[] = [];
  let misconfigured = false;
  try {
    const state = await getProjectDomainState(site.custom_domain);
    if (state.ok) {
      verified = state.verified;
      verification = state.verification;
    }
    const config = await getDomainConfig(site.custom_domain);
    if (config.ok) misconfigured = config.misconfigured;
  } catch {
    // ignore — DB state is the fallback
  }

  const newStatus = verified ? "verified" : "pending";
  if (newStatus !== site.custom_domain_status) {
    await supabaseAdmin
      .from("generated_websites")
      .update({ custom_domain_status: newStatus, custom_domain_error: null })
      .eq("id", siteId);
  }

  return {
    ok: true,
    state: {
      domain: site.custom_domain,
      status: newStatus,
      attachedAt: site.custom_domain_attached_at,
      error: site.custom_domain_error,
      isApex: isApex(site.custom_domain),
      dns: buildDnsInstructions(site.custom_domain),
      verification: shapeVerification(verification),
      misconfigured,
    },
  };
}

export async function attachDomain(siteId: string, userId: string, rawDomain: string): Promise<
  | { ok: true; state: DomainStatePayload }
  | { ok: false; error: string; status: number }
> {
  const site = await loadOwnedSite(siteId, userId);
  if (!site) return { ok: false, error: "Not found", status: 404 };
  if (site.custom_domain) {
    return { ok: false, error: "A domain is already attached. Detach it first to change.", status: 409 };
  }
  const norm = normalizeDomain(rawDomain);
  if (!norm.ok) return { ok: false, error: norm.error, status: 400 };

  const { data: clash } = await supabaseAdmin
    .from("generated_websites")
    .select("id")
    .eq("custom_domain", norm.domain)
    .maybeSingle();
  if (clash && clash.id !== siteId) {
    return { ok: false, error: "That domain is already attached to another site.", status: 409 };
  }

  const result = await attachCustomDomain(norm.domain);
  if (!result.ok) return { ok: false, error: result.error, status: 502 };

  const attachedAt = new Date().toISOString();
  await supabaseAdmin
    .from("generated_websites")
    .update({
      custom_domain: norm.domain,
      custom_domain_status: "pending",
      custom_domain_attached_at: attachedAt,
      custom_domain_error: null,
    })
    .eq("id", siteId);

  return {
    ok: true,
    state: {
      domain: norm.domain,
      status: "pending",
      attachedAt,
      error: null,
      isApex: isApex(norm.domain),
      dns: buildDnsInstructions(norm.domain),
      verification: shapeVerification(result.verification),
    },
  };
}

export async function verifyDomain(siteId: string, userId: string): Promise<
  | { ok: true; state: DomainStatePayload }
  | { ok: false; error: string; status: number }
> {
  const site = await loadOwnedSite(siteId, userId);
  if (!site) return { ok: false, error: "Not found", status: 404 };
  if (!site.custom_domain) return { ok: false, error: "No domain attached", status: 400 };

  const result = await verifyProjectDomain(site.custom_domain);
  if (!result.ok) {
    await supabaseAdmin
      .from("generated_websites")
      .update({ custom_domain_error: result.error })
      .eq("id", siteId);
    return { ok: false, error: result.error, status: 502 };
  }

  const newStatus = result.verified ? "verified" : "pending";
  await supabaseAdmin
    .from("generated_websites")
    .update({ custom_domain_status: newStatus, custom_domain_error: null })
    .eq("id", siteId);

  return {
    ok: true,
    state: {
      domain: site.custom_domain,
      status: newStatus,
      attachedAt: site.custom_domain_attached_at,
      error: null,
      isApex: isApex(site.custom_domain),
      dns: buildDnsInstructions(site.custom_domain),
      verification: shapeVerification(result.verification),
    },
  };
}

export async function detachDomain(siteId: string, userId: string): Promise<
  | { ok: true }
  | { ok: false; error: string; status: number }
> {
  const site = await loadOwnedSite(siteId, userId);
  if (!site) return { ok: false, error: "Not found", status: 404 };
  if (!site.custom_domain) return { ok: true };

  await removeVercelDomain(site.custom_domain);
  await supabaseAdmin
    .from("generated_websites")
    .update({
      custom_domain: null,
      custom_domain_status: null,
      custom_domain_attached_at: null,
      custom_domain_error: null,
    })
    .eq("id", siteId);
  return { ok: true };
}
