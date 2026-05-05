import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

// 90s window — the dashboard heartbeats every 30s. Three missed heartbeats
// and we consider the user offline (their cell takes the call instead).
const PRESENCE_TTL_MS = 90 * 1000;

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ available: false }, { status: 401 });
  }

  const { data } = await supabaseAdmin
    .from("phone_presence")
    .select("available_until")
    .eq("user_id", session.userId)
    .maybeSingle();

  const available = !!data && new Date(data.available_until).getTime() > Date.now();
  return NextResponse.json({ available });
}

// POST { available: boolean } toggles state.
// POST {} (no body) is treated as a heartbeat — only renews if currently available.
export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { available?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (body.available === false) {
    await supabaseAdmin.from("phone_presence").delete().eq("user_id", session.userId);
    return NextResponse.json({ available: false });
  }

  // available === true OR heartbeat (treated as renew if already up)
  const availableUntil = new Date(Date.now() + PRESENCE_TTL_MS).toISOString();
  await supabaseAdmin.from("phone_presence").upsert(
    {
      user_id: session.userId,
      available_until: availableUntil,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  return NextResponse.json({ available: true, availableUntil });
}
