import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { listOwnedAgentIds } from "@/lib/agentOwnership";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const ownedIds = await listOwnedAgentIds(session.userId);
    if (ownedIds.length === 0) {
      return NextResponse.json({ agents: [] });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ElevenLabs API key not configured." }, { status: 500 });

    const res = await fetch("https://api.elevenlabs.io/v1/convai/agents", {
      headers: { "xi-api-key": apiKey },
      cache: "no-store",
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data?.detail?.message || "Failed to fetch agents" }, { status: 500 });

    const ownedSet = new Set(ownedIds);
    const filtered = (data.agents || []).filter((a: { agent_id?: string }) => a.agent_id && ownedSet.has(a.agent_id));
    return NextResponse.json({ agents: filtered });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
