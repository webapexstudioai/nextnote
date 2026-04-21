import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { assertOwnsAgent } from "@/lib/agentOwnership";
import { getBalance, MIN_CALL_BALANCE, RATE_CREDITS_PER_MIN } from "@/lib/credits";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { agentId } = await params;
    try {
      await assertOwnsAgent(session.userId, agentId);
    } catch {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const balance = await getBalance(session.userId);
    if (balance < MIN_CALL_BALANCE) {
      return NextResponse.json(
        {
          error: `Not enough credits to start a call. You need at least ${MIN_CALL_BALANCE} credits (calls are billed ${RATE_CREDITS_PER_MIN}/min). You have ${balance}.`,
          required: MIN_CALL_BALANCE,
          balance,
        },
        { status: 402 },
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ElevenLabs API key is not configured" }, { status: 500 });
    }

    const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`, {
      headers: {
        "xi-api-key": apiKey,
      },
      cache: "no-store",
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data?.detail?.message || data?.message || "Failed to get signed URL" }, { status: res.status });
    }

    return NextResponse.json({ signed_url: data.signed_url });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to get signed URL" }, { status: 500 });
  }
}
