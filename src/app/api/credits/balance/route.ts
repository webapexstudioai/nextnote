import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { getBalance, MIN_CALL_BALANCE } from "@/lib/credits";

export async function GET() {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const balance = await getBalance(session.userId);
  return NextResponse.json({
    balance,
    low: balance < MIN_CALL_BALANCE,
    min_call_balance: MIN_CALL_BALANCE,
  });
}
