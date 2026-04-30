import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { getUserAIConfig, aiChat } from "@/lib/ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { name, service, address, contactName } = await req.json();

  const aiResult = await getUserAIConfig(session.userId);
  if (!aiResult.ok) {
    return NextResponse.json({ error: aiResult.error }, { status: 400 });
  }

  const systemPrompt = `You help agency owners write a short "design direction" brief for an AI website generator. The brief is appended to a base prompt that already handles structure (hero, services, testimonials, contact, footer) and brand basics. Your job is to add 3-6 specific, opinionated design notes the generator can act on — vibe, color leaning, hero photography idea, headline angle, copy tone — tailored to the business.

OUTPUT RULES:
- Output ONLY the brief itself. No preamble, no markdown headers, no quotes around the output.
- 3-6 short bullet-style lines OR one tight paragraph (max ~120 words).
- Be specific and visual ("warm sandstone palette with deep navy accents, sun-washed exterior hero shot of a craftsman-style home" — not "modern and clean").
- Do NOT mention sections, layout, fonts via CDN, or anything structural — the generator handles that.
- Do NOT include the business name or phone in the brief — those are already wired in.`;

  const userPrompt = `Draft a design-direction brief for this business:
- Name: ${name || "(unspecified)"}
- Industry / service: ${service || "(unspecified)"}
- Location: ${address || "(unspecified)"}
- Primary contact: ${contactName || "(unspecified)"}

Return only the brief.`;

  try {
    const text = await aiChat(aiResult.config, systemPrompt, userPrompt, 600);
    const cleaned = text.trim().replace(/^"+|"+$/g, "").trim();
    return NextResponse.json({ prompt: cleaned });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Could not draft a prompt";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
