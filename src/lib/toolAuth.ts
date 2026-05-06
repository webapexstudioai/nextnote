import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "./supabase";
import { decrypt } from "./crypto";

export interface ResolvedCreds {
  apiKey: string;
  eventTypeId: string;
  timeZone: string;
}

// Lightweight auth for tools that don't need calendar credentials — verifies
// the shared webhook secret and that the userId points at a real account.
// Returns the user's email + white-label profile (agency name, owner name,
// logo URL) so outgoing emails can be branded as the agency, not NextNote.
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

  // Legal business name from the optional KYB profile is the most formal label
  // (used for things like booking confirmations). Agency name from the user
  // profile is what shows up as the email From; falls back through name → legal.
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
