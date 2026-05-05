import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizePhone, sendSms } from "@/lib/twilio";

export const runtime = "nodejs";

// 6-digit code, 10-minute window, 5 attempts max. Verification rows are
// invalidated as soon as a newer one is issued for the same (user, phone).
const CODE_TTL_MS = 10 * 60 * 1000;
const MIN_RESEND_INTERVAL_MS = 45 * 1000;

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  // crypto.randomInt is uniform; pad to 6 digits.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sender = process.env.NEXTNOTE_TRANSACTIONAL_FROM;
  if (!sender) {
    return NextResponse.json(
      { error: "SMS notifications aren't configured yet. Please try again later." },
      { status: 503 },
    );
  }

  let body: { phone_number?: string };
  try { body = await req.json(); } catch { body = {}; }

  const phone = normalizePhone(String(body.phone_number || ""));
  if (!phone) {
    return NextResponse.json({ error: "Enter a valid US phone number." }, { status: 400 });
  }

  // Throttle: don't issue a new code if a recent one is still fresh enough
  // that the user could just retry. Avoids paying Twilio for double-sends
  // when a user impatiently clicks "Send code" twice.
  const { data: recent } = await supabaseAdmin
    .from("phone_verification_codes")
    .select("created_at, consumed_at")
    .eq("user_id", session.userId)
    .eq("phone_number", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent && !recent.consumed_at) {
    const ageMs = Date.now() - new Date(recent.created_at).getTime();
    if (ageMs < MIN_RESEND_INTERVAL_MS) {
      const waitS = Math.ceil((MIN_RESEND_INTERVAL_MS - ageMs) / 1000);
      return NextResponse.json(
        { error: `Wait ${waitS}s before requesting another code.` },
        { status: 429 },
      );
    }
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  const { error: insertErr } = await supabaseAdmin.from("phone_verification_codes").insert({
    user_id: session.userId,
    phone_number: phone,
    code_hash: hashCode(code),
    expires_at: expiresAt,
  });
  if (insertErr) {
    return NextResponse.json({ error: "Couldn't save verification code." }, { status: 500 });
  }

  try {
    await sendSms({
      from: sender,
      to: phone,
      body: `Your NextNote verification code is ${code}. It expires in 10 minutes.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send SMS";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ phone_number: phone, sent: true });
}
