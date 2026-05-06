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
// Returns the user's email + business name for downstream notifications.
export async function authorizeNotifyCall(req: NextRequest, userId: string): Promise<
  | { user: { id: string; email: string; businessName: string } }
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
    .select("id, email")
    .eq("id", userId)
    .maybeSingle();

  if (!data?.id) {
    return { error: NextResponse.json({ error: "Account not found", success: false }, { status: 404 }) };
  }

  // Business name lives on the optional KYB profile; fall back gracefully so
  // notify tools work even before the user fills in business_profiles.
  const { data: profile } = await supabaseAdmin
    .from("user_business_profiles")
    .select("legal_name")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    user: {
      id: data.id,
      email: data.email || "",
      businessName: profile?.legal_name || "Your business",
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
