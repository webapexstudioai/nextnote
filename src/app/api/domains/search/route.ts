import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { searchDomains } from "@/lib/domainPurchase";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { query?: string };
  try { body = await req.json(); } catch { body = {}; }

  const query = (body.query || "").trim();
  if (!query) return NextResponse.json({ error: "Query is required" }, { status: 400 });
  if (query.length > 60) return NextResponse.json({ error: "Query is too long" }, { status: 400 });

  try {
    const { results, errors } = await searchDomains(query);
    // If we got back zero candidates but Vercel errored on every one, that's
    // a config issue (bad token, missing scope, no team payment method on
    // file, etc.) — bubble the first error up so the UI shows something
    // actionable instead of "no results".
    if (results.length === 0 && errors.length > 0) {
      console.error("domain search — all candidates errored:", errors);
      return NextResponse.json(
        { error: `Domain lookup failed: ${errors[0]}`, details: errors },
        { status: 502 },
      );
    }
    return NextResponse.json({ results });
  } catch (err) {
    console.error("domain search failed", err);
    const msg = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
