import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  let query = supabaseAdmin
    .from("user_business_profiles")
    .select(
      "user_id, legal_name, ein, business_type, website, city, region, country, rep_name, rep_email, use_case, tcpa_attested, attested_at, attested_ip, created_at",
    )
    .order("attested_at", { ascending: false, nullsFirst: false })
    .limit(200);

  if (q) {
    query = query.or(`legal_name.ilike.%${q}%,ein.ilike.%${q}%,rep_email.ilike.%${q}%`);
  }

  const { data: profiles, error } = await query;
  if (error) {
    console.error("Admin profiles list error:", error);
    return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 });
  }

  const ids = (profiles ?? []).map((p) => p.user_id);
  const emailById = new Map<string, { email: string; agencyName: string | null }>();
  if (ids.length) {
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id, email, agency_name")
      .in("id", ids);
    for (const u of users ?? []) emailById.set(u.id, { email: u.email, agencyName: u.agency_name });
  }

  return NextResponse.json({
    profiles: (profiles ?? []).map((p) => ({
      userId: p.user_id,
      email: emailById.get(p.user_id)?.email ?? "—",
      agencyName: emailById.get(p.user_id)?.agencyName ?? null,
      legalName: p.legal_name,
      ein: p.ein,
      businessType: p.business_type,
      website: p.website,
      location: [p.city, p.region, p.country].filter(Boolean).join(", "),
      repName: p.rep_name,
      repEmail: p.rep_email,
      useCase: p.use_case,
      tcpaAttested: p.tcpa_attested,
      attestedAt: p.attested_at,
      attestedIp: p.attested_ip,
      createdAt: p.created_at,
    })),
  });
}
