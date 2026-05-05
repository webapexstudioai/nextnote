import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";
import { removeVercelDomain } from "@/lib/vercelDomains";

const WHITELABEL_HOST = "pitchsite.dev";

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { siteId } = await req.json();
  if (!siteId) {
    return NextResponse.json({ error: "Missing siteId" }, { status: 400 });
  }

  // Look up the slug + tier before deleting so we know whether to detach a
  // pitchsite.dev subdomain. Scoped to the caller's user_id so we don't leak
  // info about other users' sites.
  const { data: site } = await supabaseAdmin
    .from("generated_websites")
    .select("slug, tier")
    .eq("id", siteId)
    .eq("user_id", session.userId)
    .maybeSingle();

  const { error } = await supabaseAdmin
    .from("generated_websites")
    .delete()
    .eq("id", siteId)
    .eq("user_id", session.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Best-effort detach of the Vercel domain. Never blocks the delete — if the
  // call fails, the DB row is already gone and a manual cleanup is fine.
  if (site?.tier === "whitelabel" && site.slug) {
    const subdomain = `${site.slug}.${WHITELABEL_HOST}`;
    const result = await removeVercelDomain(subdomain);
    if (!result.ok) {
      console.error(`[website-delete] Failed to detach ${subdomain}: ${result.error}`);
    }
  }

  return NextResponse.json({ ok: true });
}
