import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizePhone } from "@/lib/twilio";

export const runtime = "nodejs";

const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { phone_number?: string; code?: string };
  try { body = await req.json(); } catch { body = {}; }

  const phone = normalizePhone(String(body.phone_number || ""));
  const code = String(body.code || "").trim();
  if (!phone) return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 6-digit code from your text." }, { status: 400 });
  }

  // Always operate on the most recent unconsumed row for this (user, phone).
  // Older rows are abandoned implicitly — `start` overwrites by inserting a
  // newer row, and we only ever look at the latest.
  const { data: row } = await supabaseAdmin
    .from("phone_verification_codes")
    .select("id, code_hash, attempts, expires_at, consumed_at")
    .eq("user_id", session.userId)
    .eq("phone_number", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: "Request a code first." }, { status: 400 });
  }
  if (row.consumed_at) {
    return NextResponse.json({ error: "That code was already used. Request a new one." }, { status: 400 });
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "That code expired. Request a new one." }, { status: 400 });
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "Too many wrong attempts. Request a new code." }, { status: 429 });
  }

  if (hashCode(code) !== row.code_hash) {
    await supabaseAdmin
      .from("phone_verification_codes")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
    return NextResponse.json({ error: "Wrong code. Try again." }, { status: 400 });
  }

  const now = new Date().toISOString();

  await supabaseAdmin
    .from("phone_verification_codes")
    .update({ consumed_at: now })
    .eq("id", row.id);

  await supabaseAdmin
    .from("users")
    .update({
      verified_personal_phone: phone,
      verified_personal_phone_at: now,
    })
    .eq("id", session.userId);

  return NextResponse.json({ verified: true, phone_number: phone });
}
