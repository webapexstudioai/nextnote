import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { sendTransactionalSmsToUser } from "@/lib/transactionalSms";

export const runtime = "nodejs";

const MAX_BODY_CHARS = 1500;

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let payload: { body?: string };
  try { payload = await req.json(); } catch { payload = {}; }

  const body = String(payload.body || "").trim();
  if (!body) {
    return NextResponse.json({ error: "Nothing to send." }, { status: 400 });
  }
  if (body.length > MAX_BODY_CHARS) {
    return NextResponse.json({ error: "Message is too long." }, { status: 400 });
  }

  const result = await sendTransactionalSmsToUser(session.userId, body);
  if (!result.ok) {
    const status = result.code === "no_phone" ? 412 : result.code === "not_configured" ? 503 : 502;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return NextResponse.json({ sent: true });
}
