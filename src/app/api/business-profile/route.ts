import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";

export interface BusinessProfile {
  user_id: string;
  legal_name: string;
  ein: string | null;
  business_type: string | null;
  website: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  rep_name: string;
  rep_email: string;
  rep_title: string | null;
  rep_phone: string | null;
  use_case: string;
  tcpa_attested: boolean;
  attested_at: string | null;
}

const REQUIRED_TEXT_FIELDS = [
  "legal_name",
  "address_line1",
  "city",
  "region",
  "postal_code",
  "rep_name",
  "rep_email",
  "use_case",
] as const;

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function GET() {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("user_business_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return NextResponse.json({
    profile: data || null,
    complete: !!data && !!data.tcpa_attested && !!data.legal_name,
  });
}

export async function POST(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();

  for (const field of REQUIRED_TEXT_FIELDS) {
    const v = body[field];
    if (typeof v !== "string" || !v.trim()) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
  }
  if (!isEmail(body.rep_email)) {
    return NextResponse.json({ error: "Valid rep_email required" }, { status: 400 });
  }
  if (body.tcpa_attested !== true) {
    return NextResponse.json(
      { error: "You must agree to the TCPA / sender attestation to continue." },
      { status: 400 },
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") || null;

  const row = {
    user_id: userId,
    legal_name: String(body.legal_name).trim(),
    ein: body.ein ? String(body.ein).trim() : null,
    business_type: body.business_type ? String(body.business_type).trim() : null,
    website: body.website ? String(body.website).trim() : null,
    address_line1: String(body.address_line1).trim(),
    address_line2: body.address_line2 ? String(body.address_line2).trim() : null,
    city: String(body.city).trim(),
    region: String(body.region).trim(),
    postal_code: String(body.postal_code).trim(),
    country: body.country ? String(body.country).trim().toUpperCase() : "US",
    rep_name: String(body.rep_name).trim(),
    rep_email: String(body.rep_email).trim().toLowerCase(),
    rep_title: body.rep_title ? String(body.rep_title).trim() : null,
    rep_phone: body.rep_phone ? String(body.rep_phone).trim() : null,
    use_case: String(body.use_case).trim(),
    tcpa_attested: true,
    attested_at: new Date().toISOString(),
    attested_ip: ip,
    attested_user_agent: userAgent,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("user_business_profiles")
    .upsert(row, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data, complete: true });
}
