import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "./supabase";
import { decrypt } from "./crypto";
import { getAgentBranding } from "./agentOwnership";

export interface ResolvedCreds {
  apiKey: string;
  eventTypeId: string;
  timeZone: string;
}

// Lightweight auth for tools that don't need calendar credentials — verifies
// the shared webhook secret and that the userId points at a real account.
// Returns a branding profile for outbound communications. When an `agent`
// query param is present, branding resolves at the agent level (the prospect
// business this receptionist represents) and falls back to the agency owner's
// profile only when those fields are unset.
export async function authorizeNotifyCall(req: NextRequest, userId: string): Promise<
  | {
      user: {
        id: string;
        email: string;
        ownerName: string;
        agencyName: string;
        businessName: string;
        logoUrl: string | null;
      };
    }
  | { error: NextResponse }
> {
  const expected = process.env.TOOLS_WEBHOOK_SECRET;
  if (!expected) {
    return { error: NextResponse.json({ error: "Tool webhooks not configured" }, { status: 500 }) };
  }
  if (req.headers.get("x-nextnote-secret") !== expected) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data } = await supabaseAdmin
    .from("users")
    .select("id, email, name, agency_name, profile_image_url")
    .eq("id", userId)
    .maybeSingle();

  if (!data?.id) {
    return { error: NextResponse.json({ error: "Account not found", success: false }, { status: 404 }) };
  }

  const agentId = req.nextUrl.searchParams.get("agent")?.trim() || "";
  if (agentId) {
    const branding = await getAgentBranding(userId, agentId);
    if (branding) {
      return {
        user: {
          id: data.id,
          email: data.email || "",
          ownerName: branding.contactName,
          agencyName: branding.businessName,
          businessName: branding.businessName,
          logoUrl: branding.logoUrl,
        },
      };
    }
  }

  // No agent context — fall back to agency-level identity (legacy behavior).
  const { data: profile } = await supabaseAdmin
    .from("user_business_profiles")
    .select("legal_name")
    .eq("user_id", userId)
    .maybeSingle();

  const ownerName = (data.name as string | null)?.trim() || "";
  const agencyName = (data.agency_name as string | null)?.trim() || "";
  const businessName = profile?.legal_name?.trim() || agencyName || ownerName || "Your business";

  return {
    user: {
      id: data.id,
      email: data.email || "",
      ownerName,
      agencyName: agencyName || ownerName || businessName,
      businessName,
      logoUrl: (data.profile_image_url as string | null) || null,
    },
  };
}

export async function authorizeToolCall(req: NextRequest, userId: string): Promise<{ creds: ResolvedCreds } | { error: NextResponse }> {
  const expected = process.env.TOOLS_WEBHOOK_SECRET;
  if (!expected) {
    return { error: NextResponse.json({ error: "Tool webhooks not configured" }, { status: 500 }) };
  }
  if (req.headers.get("x-nextnote-secret") !== expected) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data } = await supabaseAdmin
    .from("user_settings")
    .select("cal_api_key_encrypted, cal_event_type_id, cal_timezone")
    .eq("user_id", userId)
    .single();

  if (!data?.cal_api_key_encrypted || !data?.cal_event_type_id) {
    return { error: NextResponse.json({ error: "Cal.com is not connected for this account." }, { status: 400 }) };
  }

  let apiKey: string;
  try {
    apiKey = decrypt(data.cal_api_key_encrypted);
  } catch {
    return { error: NextResponse.json({ error: "Stored Cal.com credentials could not be read." }, { status: 500 }) };
  }

  return {
    creds: {
      apiKey,
      eventTypeId: data.cal_event_type_id,
      timeZone: data.cal_timezone || "America/New_York",
    },
  };
}
