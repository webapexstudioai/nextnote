import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { requirePro } from "@/lib/tierGuard";
import { getUserAIConfig, aiChat } from "@/lib/ai";
import { getBalance, deductCredits, NOTE_SUMMARIZE_CREDITS } from "@/lib/credits";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const gate = await requirePro(session.userId, "AI meeting summaries");
    if (!gate.ok) return gate.response;

    const { notes, prospectName, service } = await req.json();
    if (!notes) {
      return NextResponse.json({ error: "No notes provided" }, { status: 400 });
    }

    const balance = await getBalance(session.userId);
    if (balance < NOTE_SUMMARIZE_CREDITS) {
      return NextResponse.json({ error: "Insufficient credits", required: NOTE_SUMMARIZE_CREDITS, balance }, { status: 402 });
    }

    const result = await getUserAIConfig(session.userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const prompt = `Summarize these meeting/call notes for a prospect named "${prospectName}" interested in "${service}". Keep it concise, professional, and actionable. Highlight key takeaways, next steps, and any objections or concerns mentioned.

Notes:
${notes}

Return a clean, bulleted summary (3-6 bullets max). No preamble.`;

    let summary: string;
    try {
      summary = await aiChat(result.config, undefined, prompt, 512, "fast");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("invalid") || msg.includes("API key")) {
        return NextResponse.json(
          { error: "Your AI API key is invalid or expired. Please update it in Settings." },
          { status: 400 }
        );
      }
      throw err;
    }

    await deductCredits(session.userId, NOTE_SUMMARIZE_CREDITS, {
      reason: "note_summarize",
      metadata: { prospectName },
    });

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Summarize error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
