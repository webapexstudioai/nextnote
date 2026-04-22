import { NextResponse } from "next/server";
import { loadCrmState, requireUser } from "@/lib/crm";

export async function GET() {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const state = await loadCrmState(userId);
    return NextResponse.json(state);
  } catch (err) {
    console.error("CRM load error:", err);
    return NextResponse.json({ error: "Failed to load CRM state" }, { status: 500 });
  }
}
