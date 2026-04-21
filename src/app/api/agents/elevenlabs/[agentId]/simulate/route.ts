import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { assertOwnsAgent } from "@/lib/agentOwnership";

export const maxDuration = 90;

const getKey = () => process.env.ELEVENLABS_API_KEY || "";

export async function POST(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { agentId } = await params;
    try {
      await assertOwnsAgent(session.userId, agentId);
    } catch {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    const { userMessage, history } = await req.json();

    if (!userMessage) return NextResponse.json({ error: "userMessage required" }, { status: 400 });

    // Build prior turns for context
    const priorTurns = Array.isArray(history)
      ? history.map((m: { role: string; content: string }) => ({
          role: m.role === "user" ? "user" : "agent",
          message: m.content,
          time_in_call_secs: 0,
          tool_calls: [],
          tool_results: [],
          feedback: null,
          llm_override: null,
          conversation_turn_metrics: null,
          rag_retrieval_info: null,
          llm_usage: null,
        }))
      : [];

    const body = {
      simulation_specification: {
        simulated_user_config: {
          prompt: {
            prompt: `You are a user testing an AI receptionist. Your very next message is exactly: "${userMessage}". Say only that and nothing else.`,
            llm: "gemini-2.0-flash",
            temperature: 0,
          },
          first_message: userMessage,
          max_turns: 1,
        },
        extra_evaluation_criteria: [],
      },
      ...(priorTurns.length > 0 ? { conversation_overrides: { conversation_turns: priorTurns } } : {}),
    };

    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${agentId}/simulate-conversation`,
      {
        method: "POST",
        headers: { "xi-api-key": getKey(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data?.detail?.message || JSON.stringify(data) }, { status: res.status });
    }

    // ElevenLabs returns simulated_conversation (not transcript)
    const turns: { role: string; message: string }[] =
      data?.simulated_conversation || data?.transcript || [];

    // The simulation runs multiple turns. We want the agent reply
    // that directly follows the user's message (not the last one).
    // Find the first user turn index, then return the agent turn right after it.
    let reply = "No reply";
    for (let i = 0; i < turns.length; i++) {
      if (turns[i].role === "user" && turns[i].message?.toLowerCase().includes(userMessage.toLowerCase().slice(0, 20))) {
        const nextAgent = turns.slice(i + 1).find((t) => t.role === "agent");
        if (nextAgent?.message) { reply = nextAgent.message; break; }
      }
    }
    // Fallback: second agent turn (first is usually the opener)
    if (reply === "No reply") {
      const agentTurns = turns.filter((t) => t.role === "agent");
      reply = agentTurns[1]?.message || agentTurns[0]?.message || "No reply";
    }

    return NextResponse.json({ reply, transcript: turns });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Simulation failed" }, { status: 500 });
  }
}
