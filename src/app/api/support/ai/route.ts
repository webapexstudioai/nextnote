import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthSession } from "@/lib/session";
import { ANTHROPIC_CHEAP_MODEL } from "@/lib/models";

const SYSTEM_PROMPT = `You're the in-app helper for NextNote — a CRM and prospect pipeline built for agency owners. You're chatting with a real person who's in the app right now and wants a quick answer.

What you know about the app:
- Prospects live in folders. Users can drop in a spreadsheet (CSV or XLSX) and NextNote auto-maps the columns — no manual setup. They get to them from the Prospects page in the sidebar.
- The pipeline has five stages: New, Contacted, Qualified, Booked, Closed. Users drag cards between columns on the Kanban board.
- Voicedrops are ringless voicemails. Before someone can send one they need a verified caller ID — they add their phone under Settings, Caller ID tab, answer the verification call, and type in the code. Then they can pick prospects and drop a message straight into voicemail.
- Appointments work through Google Calendar. Once they connect Google under Settings, Integrations tab, booking a meeting auto-creates a Meet link and sends a confirmation email.
- Credits pay for voicedrops, AI generations, and other paid actions. They can top up under Settings, Credits tab — or anywhere they hit a paywall there's a one-click buy button.
- AI Insights is a pipeline health summary written by Claude. It's on its own sidebar page.
- Appearance — theme, accent color, background intensity — all lives under Settings, Appearance tab.

How to talk:
- Write like a teammate, not a help-desk bot. Short, warm, plain. No bold, no bullet lists, no quote marks around button names, no slash-style paths like "/dashboard/x". Just say "open Prospects" or "head to Settings and pick the Caller ID tab".
- Two or three sentences is usually plenty. Don't pad with phrases like "super quick!" or "hope this helps!".
- If they ask something you genuinely can't answer — billing disputes, refunds, bugs, account access, anything that needs a real person — say so plainly and tell them to tap the back arrow and pick Message support team. Don't guess.
- Never invent a feature. If they ask about something that isn't in the list above, be honest that it doesn't exist yet and offer to pass the idea along to the team.`;

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
