import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { assertOwnsAgent } from "@/lib/agentOwnership";

const getKey = () => process.env.ELEVENLABS_API_KEY || "";

async function fetchConversation(conversationId: string) {
  return fetch(`https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`, {
    headers: { "xi-api-key": getKey() },
    cache: "no-store",
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { conversationId } = await params;
    const res = await fetchConversation(conversationId);
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data?.detail?.message || "Failed" }, { status: res.status });

    const agentId = data?.agent_id;
    if (!agentId) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    try {
      await assertOwnsAgent(session.userId, agentId);
    } catch {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const { conversationId } = await params;

    // Verify ownership before deleting.
    const lookupRes = await fetchConversation(conversationId);
    const lookupData = await lookupRes.json();
    const agentId = lookupData?.agent_id;
    if (!lookupRes.ok || !agentId) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    try {
      await assertOwnsAgent(session.userId, agentId);
    } catch {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`, {
      method: "DELETE",
      headers: { "xi-api-key": getKey() },
    });
    if (!res.ok) return NextResponse.json({ error: "Failed to delete" }, { status: res.status });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
