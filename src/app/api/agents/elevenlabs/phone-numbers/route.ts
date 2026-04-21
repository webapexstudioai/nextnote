import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { listOwnedPhoneNumberIds, recordPhoneNumberOwnership } from "@/lib/agentOwnership";

const BASE = "https://api.elevenlabs.io/v1/convai/phone-numbers";
const getKey = () => process.env.ELEVENLABS_API_KEY || "";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const ownedIds = await listOwnedPhoneNumberIds(session.userId);
    if (ownedIds.length === 0) return NextResponse.json({ phoneNumbers: [] });

    const res = await fetch(BASE, { headers: { "xi-api-key": getKey() }, cache: "no-store" });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data?.detail?.message || "Failed" }, { status: res.status });

    const list = Array.isArray(data) ? data : [];
    const ownedSet = new Set(ownedIds);
    const filtered = list.filter((n: { phone_number_id?: string }) => n.phone_number_id && ownedSet.has(n.phone_number_id));
    return NextResponse.json({ phoneNumbers: filtered });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const res = await fetch(`${BASE}/twilio`, {
      method: "POST",
      headers: { "xi-api-key": getKey(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data?.detail?.message || JSON.stringify(data) }, { status: res.status });

    if (data?.phone_number_id) {
      await recordPhoneNumberOwnership(
        session.userId,
        data.phone_number_id,
        body?.phone_number || "",
        body?.label || "",
        body?.sid || null
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
