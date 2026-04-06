import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  try {
    const { notes, prospectName, service } = await req.json();

    if (!notes) {
      return NextResponse.json({ error: "No notes provided" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "your-api-key-here") {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Summarize these meeting/call notes for a prospect named "${prospectName}" interested in "${service}". Keep it concise, professional, and actionable. Highlight key takeaways, next steps, and any objections or concerns mentioned.

Notes:
${notes}

Return a clean, bulleted summary (3-6 bullets max). No preamble.`,
        },
      ],
    });

    const summary = message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Summarize error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
