// Programmatic Vercel domain registration for white-label sites.
//
// When a user generates a white-label site we call Vercel's API to attach
// `{slug}.pitchsite.dev` to this project. Vercel then issues an HTTP-01 cert
// for that specific subdomain (the wildcard cert path is blocked because the
// apex `pitchsite.dev` is registered through Cloudflare Registrar, which
// locks nameservers to Cloudflare and prevents the DNS-01 challenge Vercel's
// wildcard flow needs).
//
// Failures here are logged but never block site generation — the row is
// already in the DB, and a missing cert just means the URL won't resolve over
// HTTPS until a retry attaches it.

const VERCEL_API = "https://api.vercel.com";

type AddResult =
  | { ok: true; alreadyExists: boolean }
  | { ok: false; error: string };

export async function addVercelDomain(subdomain: string): Promise<AddResult> {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token || !projectId) {
    return { ok: false, error: "VERCEL_API_TOKEN or VERCEL_PROJECT_ID not configured" };
  }

  const url = new URL(`${VERCEL_API}/v10/projects/${projectId}/domains`);
  if (teamId) url.searchParams.set("teamId", teamId);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: subdomain }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch failed";
    return { ok: false, error: `Vercel API request failed: ${msg}` };
  }

  if (res.ok) {
    return { ok: true, alreadyExists: false };
  }

  // 409 = domain already attached to this project. That's fine for our
  // purposes (idempotent) — treat as success.
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // ignore
  }
  const code = (body as { error?: { code?: string } } | null)?.error?.code;
  if (res.status === 409 || code === "domain_already_in_use_by_this_project") {
    return { ok: true, alreadyExists: true };
  }

  const message = (body as { error?: { message?: string } } | null)?.error?.message
    ?? `Vercel API ${res.status}`;
  return { ok: false, error: message };
}

// ─── Custom domain (BYO) helpers ───────────────────────────────────────────
// Used for users attaching their own registered domain (e.g. "mybiz.com" or
// "go.mybiz.com"). Same Vercel project, same `addProjectDomain` endpoint as
// the white-label subdomain flow — we just allow arbitrary hostnames and
// surface the verification challenge + DNS instructions back to the UI so
// the user knows what record(s) to add at their registrar.

export type DomainStatus =
  | { state: "pending"; verification: VerificationRecord[] }
  | { state: "misconfigured"; recommendedIPv4: string[]; recommendedCNAME: string[] }
  | { state: "verified" }
  | { state: "error"; message: string };

export type VerificationRecord = {
  type: string; // "TXT" | "CNAME" | "A"
  domain: string; // record name to set
  value: string; // record value
  reason?: string;
};

function withTeam(url: URL, teamId?: string) {
  if (teamId) url.searchParams.set("teamId", teamId);
  return url;
}

function envOrThrow() {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token || !projectId) {
    throw new Error("VERCEL_API_TOKEN or VERCEL_PROJECT_ID not configured");
  }
  return { token, projectId, teamId };
}

/**
 * Attach an arbitrary domain (apex or subdomain) to the project. Returns the
 * verification challenge Vercel hands back when the domain isn't yet pointed
 * at us. 409 / already-attached is treated as success.
 */
export async function attachCustomDomain(domain: string): Promise<
  | { ok: true; alreadyExists: boolean; verification: VerificationRecord[] }
  | { ok: false; error: string; code?: string }
> {
  let env;
  try { env = envOrThrow(); } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "config" };
  }
  const url = withTeam(new URL(`${VERCEL_API}/v10/projects/${env.projectId}/domains`), env.teamId);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: domain }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch failed";
    return { ok: false, error: `Vercel API request failed: ${msg}` };
  }

  let body: unknown = null;
  try { body = await res.json(); } catch { /* ignore */ }

  if (res.ok) {
    const verification = ((body as { verification?: VerificationRecord[] } | null)?.verification) ?? [];
    return { ok: true, alreadyExists: false, verification };
  }

  const code = (body as { error?: { code?: string } } | null)?.error?.code;
  if (res.status === 409 || code === "domain_already_in_use_by_this_project") {
    return { ok: true, alreadyExists: true, verification: [] };
  }
  const message = (body as { error?: { message?: string } } | null)?.error?.message
    ?? `Vercel API ${res.status}`;
  return { ok: false, error: message, code };
}

/**
 * Read the project's record of this domain — gives us `verified`, the live
 * verification challenges (if any), and the assigned cert state.
 */
export async function getProjectDomainState(domain: string): Promise<
  | {
      ok: true;
      verified: boolean;
      verification: VerificationRecord[];
      attachedToProject: boolean;
    }
  | { ok: false; error: string; status: number }
> {
  let env;
  try { env = envOrThrow(); } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "config", status: 500 };
  }
  const url = withTeam(
    new URL(`${VERCEL_API}/v9/projects/${env.projectId}/domains/${encodeURIComponent(domain)}`),
    env.teamId,
  );
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${env.token}` },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch failed";
    return { ok: false, error: msg, status: 0 };
  }

  if (res.status === 404) {
    return { ok: true, verified: false, verification: [], attachedToProject: false };
  }
  let body: unknown = null;
  try { body = await res.json(); } catch { /* ignore */ }
  if (!res.ok) {
    const message = (body as { error?: { message?: string } } | null)?.error?.message
      ?? `Vercel API ${res.status}`;
    return { ok: false, error: message, status: res.status };
  }
  const data = body as { verified?: boolean; verification?: VerificationRecord[] };
  return {
    ok: true,
    verified: Boolean(data.verified),
    verification: data.verification ?? [],
    attachedToProject: true,
  };
}

/**
 * Read DNS configuration health from Vercel — tells us whether the domain
 * currently resolves to us (and surfaces the recommended A / CNAME values
 * if it doesn't, so we can show them to the user).
 */
export async function getDomainConfig(domain: string): Promise<
  | {
      ok: true;
      misconfigured: boolean;
      recommendedIPv4: string[];
      recommendedCNAME: string[];
    }
  | { ok: false; error: string }
> {
  const token = process.env.VERCEL_API_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token) return { ok: false, error: "VERCEL_API_TOKEN not configured" };

  const url = withTeam(
    new URL(`${VERCEL_API}/v6/domains/${encodeURIComponent(domain)}/config`),
    teamId,
  );
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch failed";
    return { ok: false, error: msg };
  }
  let body: unknown = null;
  try { body = await res.json(); } catch { /* ignore */ }
  if (!res.ok) {
    const message = (body as { error?: { message?: string } } | null)?.error?.message
      ?? `Vercel API ${res.status}`;
    return { ok: false, error: message };
  }
  const data = body as {
    misconfigured?: boolean;
    recommendedIPv4?: string[];
    recommendedCNAME?: string[];
  };
  return {
    ok: true,
    misconfigured: Boolean(data.misconfigured),
    recommendedIPv4: data.recommendedIPv4 ?? [],
    recommendedCNAME: data.recommendedCNAME ?? [],
  };
}

/**
 * Ask Vercel to re-check verification (fires after the user adds the records
 * at their registrar). Returns whether ownership is now confirmed.
 */
export async function verifyProjectDomain(domain: string): Promise<
  | { ok: true; verified: boolean; verification: VerificationRecord[] }
  | { ok: false; error: string }
> {
  let env;
  try { env = envOrThrow(); } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "config" };
  }
  const url = withTeam(
    new URL(`${VERCEL_API}/v9/projects/${env.projectId}/domains/${encodeURIComponent(domain)}/verify`),
    env.teamId,
  );
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "POST",
      headers: { Authorization: `Bearer ${env.token}` },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch failed";
    return { ok: false, error: msg };
  }
  let body: unknown = null;
  try { body = await res.json(); } catch { /* ignore */ }
  if (!res.ok) {
    const message = (body as { error?: { message?: string } } | null)?.error?.message
      ?? `Vercel API ${res.status}`;
    return { ok: false, error: message };
  }
  const data = body as { verified?: boolean; verification?: VerificationRecord[] };
  return { ok: true, verified: Boolean(data.verified), verification: data.verification ?? [] };
}

type RemoveResult =
  | { ok: true; alreadyGone: boolean }
  | { ok: false; error: string };

/**
 * Detach `{slug}.pitchsite.dev` from this Vercel project. Used when a user
 * deletes a white-label website so the subdomain frees up for someone else
 * (slugs are unique per project on Vercel's side, not just per-user in our DB).
 *
 * Treats 404 as success (idempotent — if the domain isn't on the project
 * anymore, the desired end state is already met).
 */
export async function removeVercelDomain(subdomain: string): Promise<RemoveResult> {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token || !projectId) {
    return { ok: false, error: "VERCEL_API_TOKEN or VERCEL_PROJECT_ID not configured" };
  }

  const url = new URL(
    `${VERCEL_API}/v9/projects/${projectId}/domains/${encodeURIComponent(subdomain)}`,
  );
  if (teamId) url.searchParams.set("teamId", teamId);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch failed";
    return { ok: false, error: `Vercel API request failed: ${msg}` };
  }

  if (res.ok) return { ok: true, alreadyGone: false };
  if (res.status === 404) return { ok: true, alreadyGone: true };

  let body: unknown = null;
  try { body = await res.json(); } catch { /* ignore */ }
  const message = (body as { error?: { message?: string } } | null)?.error?.message
    ?? `Vercel API ${res.status}`;
  return { ok: false, error: message };
}
