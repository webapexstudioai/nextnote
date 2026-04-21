import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "./supabase";
import { decrypt } from "./crypto";

export interface ResolvedCreds {
  apiKey: string;
  eventTypeId: string;
  timeZone: string;
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
