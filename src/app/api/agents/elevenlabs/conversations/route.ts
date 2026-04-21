import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { assertOwnsAgent, listOwnedAgentIds } from "@/lib/agentOwnership";

const getKey = () => process.env.ELEVENLABS_API_KEY || "";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agent_id") || "";
    const pageSize = searchParams.get("page_size") || "50";
    const cursor = searchParams.get("cursor") || "";

    // If a specific agent_id is requested, verify ownership.
    if (agentId) {
      try {
        await assertOwnsAgent(session.userId, agentId);
      } catch {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      }

      const params = new URLSearchParams({ page_size: pageSize, agent_id: agentId });
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversations?${params}`, {
        headers: { "xi-api-key": getKey() },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ error: data?.detail?.message || "Failed" }, { status: res.status });
      return NextResponse.json(data);
    }

    // Otherwise, return conversations across all owned agents only.
    const owned = await listOwnedAgentIds(session.userId);
    if (owned.length === 0) return NextResponse.json({ conversations: [] });

    const params = new URLSearchParams({ page_size: pageSize });
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversations?${params}`, {
      headers: { "xi-api-key": getKey() },
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data?.detail?.message || "Failed" }, { status: res.status });

    const ownedSet = new Set(owned);
    const all = Array.isArray(data?.conversations) ? data.conversations : [];
    const filtered = all.filter((c: { agent_id?: string }) => c.agent_id && ownedSet.has(c.agent_id));
    return NextResponse.json({ ...data, conversations: filtered });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
