import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { getUserAIConfig, aiChat } from "@/lib/ai";
import { getBalance, deductCredits, AGENT_TEST_CHAT_CREDITS } from "@/lib/credits";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { prompt, firstMessage, message, history } = await req.json();
    if (!message) return NextResponse.json({ error: "Message required" }, { status: 400 });

    const balance = await getBalance(session.userId);
    if (balance < AGENT_TEST_CHAT_CREDITS) {
      return NextResponse.json({ error: "Insufficient credits", required: AGENT_TEST_CHAT_CREDITS, balance }, { status: 402 });
    }

    const cfg = await getUserAIConfig(session.userId);
    if (!cfg.ok) return NextResponse.json({ error: cfg.error }, { status: 400 });

    const historyText = Array.isArray(history)
      ? history.map((m: { role: string; content: string }) =>
          `${m.role === "agent" ? "Agent" : "User"}: ${m.content}`
        ).join("\n")
      : "";

    const reply = await aiChat(
      cfg.config,
      `You are testing an ElevenLabs AI voice agent inside NextNote. Respond exactly as this agent would.\n\nFirst message: ${firstMessage || "Hello, how can I help you today?"}\n\nSystem prompt:\n${prompt || "You are a helpful assistant."}`,
      `${historyText ? `Conversation so far:\n${historyText}\n\nThe conversation is in progress. Continue naturally.\n\n` : "This is the first turn.\n\n"}User: ${message}\n\nReply as the agent only.`,
      500,
      "fast"
    );

    await deductCredits(session.userId, AGENT_TEST_CHAT_CREDITS, {
      reason: "agent_test_chat",
    });

    return NextResponse.json({ reply });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to test agent";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
