import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthSession } from "@/lib/session";
import { ANTHROPIC_CHEAP_MODEL } from "@/lib/models";

const SYSTEM_PROMPT = `You are the NextNote AI assistant, a friendly in-app helper for users of NextNote — a CRM / prospect pipeline tool built for agency owners.

Key features you can help with:
- Prospects: Import prospects from CSV/XLSX into folders. Go to /dashboard/prospects, create a folder, then click "Import" to upload a spreadsheet. AI auto-maps columns.
- Pipeline stages: New → Contacted → Qualified → Booked → Closed. Drag prospects between columns on the Kanban board.
- Voicedrops (ringless voicemail): Requires a verified caller ID. Go to Settings → Caller ID, add your phone, answer the verification call, and enter the code. Then select prospects and click "Send Voicedrop".
- Appointments: Connect Google Calendar in Settings → Integrations to auto-create Meet links when you book meetings with prospects.
- Credits: Voicedrops cost credits. Buy more in Settings → Credits.
- AI Insights: /dashboard/ai-insights gives a Claude-powered summary of your pipeline health.
- Appearance: Theme, accent color, and background intensity are in Settings → Appearance.

Style:
- Keep responses short (2–4 sentences max).
- Give clear, actionable steps with the exact menu path.
- If the question is about billing issues, refunds, bugs, account access, or anything you can't confidently answer, respond: "This one's better for a human — tap the back arrow and choose 'Message support team'."
- Never invent features that aren't listed above.
- Be warm and direct, not corporate.`;

interface InboundMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const messages: InboundMessage[] = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI assistant is temporarily unavailable. Please message support instead." },
      { status: 503 }
    );
  }

  const cleaned = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 2000) }));

  try {
    const client = new Anthropic({ apiKey });
    const result = await client.messages.create({
      model: ANTHROPIC_CHEAP_MODEL,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: cleaned,
    });
    const first = result.content[0];
    const reply = first && first.type === "text" ? first.text : "";
    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Support AI error:", err);
    return NextResponse.json(
      { error: "AI assistant hit a snag. Try messaging support instead." },
      { status: 500 }
    );
  }
}
