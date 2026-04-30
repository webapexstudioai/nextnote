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
