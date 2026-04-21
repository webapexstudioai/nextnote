import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { assertOwnsPhoneNumber, removePhoneNumberOwnership } from "@/lib/agentOwnership";

const BASE = "https://api.elevenlabs.io/v1/convai/phone-numbers";
const getKey = () => process.env.ELEVENLABS_API_KEY || "";

async function guard(userId: string | undefined, phoneNumberId: string) {
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    await assertOwnsPhoneNumber(userId, phoneNumberId);
  } catch {
    return NextResponse.json({ error: "Phone number not found" }, { status: 404 });
  }
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ phoneNumberId: string }> }) {
  const session = await getAuthSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { phoneNumberId } = await params;
  const denied = await guard(session.userId, phoneNumberId);
  if (denied) return denied;
  const res = await fetch(`${BASE}/${phoneNumberId}`, { headers: { "xi-api-key": getKey() }, cache: "no-store" });
  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data?.detail?.message || "Failed" }, { status: res.status });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ phoneNumberId: string }> }) {
  const session = await getAuthSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { phoneNumberId } = await params;
  const denied = await guard(session.userId, phoneNumberId);
  if (denied) return denied;
  const body = await req.json();
  const res = await fetch(`${BASE}/${phoneNumberId}`, {
    method: "PATCH",
    headers: { "xi-api-key": getKey(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data?.detail?.message || "Failed" }, { status: res.status });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ phoneNumberId: string }> }) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { phoneNumberId } = await params;
  const denied = await guard(session.userId, phoneNumberId);
  if (denied) return denied;
  const res = await fetch(`${BASE}/${phoneNumberId}`, { method: "DELETE", headers: { "xi-api-key": getKey() } });
  if (!res.ok) return NextResponse.json({ error: "Failed to delete" }, { status: res.status });
  await removePhoneNumberOwnership(session.userId, phoneNumberId);
  return NextResponse.json({ success: true });
}
