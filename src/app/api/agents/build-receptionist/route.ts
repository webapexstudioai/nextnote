import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { getUserAIConfig, aiChat } from "@/lib/ai";
import { getBalance, deductCredits, RECEPTIONIST_BUILD_CREDITS } from "@/lib/credits";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { businessName, niche, services, notes, mapsDescription, reviews, gender } = body || {};
    if (!businessName) {
      return NextResponse.json({ error: "Business name is required" }, { status: 400 });
    }

    const genderChoice: "female" | "male" | "auto" =
      gender === "male" || gender === "female" ? gender : "auto";

    const genderGuidance =
      genderChoice === "auto"
        ? "Choose a gender that best fits the niche's typical customer expectations (e.g., beauty/wellness/healthcare commonly female; trades/automotive/security commonly male; hospitality/tech neutral — pick either)."
        : `The receptionist must be ${genderChoice}. Pick a clearly ${genderChoice} first name.`;

    const nameGuidance = [
      "CRITICAL NAMING RULE: Do NOT default to 'Sarah'. Pick a fresh, varied first name that feels native to the business's niche, tone, and likely customer base.",
      genderGuidance,
      "Vary names across businesses — avoid overused picks like Sarah, Emma, Jessica, Ashley, Mike, John.",
      "Examples of niche-appropriate picks (for inspiration only, do NOT reuse these exact names every time):",
      "- Medspa / beauty: Camila, Isabella, Sienna, Noa, Priya",
      "- Dental / healthcare: Morgan, Hannah, Elena, Rachel, Nina",
      "- Law firm: Victoria, Eleanor, Margaret, Daniel, Thomas",
      "- HVAC / plumbing / auto: Marcus, Diego, Tyler, Ray, Javier",
      "- Real estate: Sophia, Olivia, Harper, Liam, Ethan",
      "- Fitness / coaching: Jade, Zara, Leo, Kai, Jordan",
      "- Restaurant / hospitality: Luca, Amara, Rosa, Dimitri, Soren",
      "- Tech / SaaS / agency: Ava, Mira, Taylor, Devon, Arlo",
      "Pick ONE name that is uncommon but approachable, easy to pronounce on a phone call, and fits the brand.",
    ].join("\n");

    const balance = await getBalance(session.userId);
    if (balance < RECEPTIONIST_BUILD_CREDITS) {
      return NextResponse.json({ error: "Insufficient credits", required: RECEPTIONIST_BUILD_CREDITS, balance }, { status: 402 });
    }

    const cfg = await getUserAIConfig(session.userId);
    if (!cfg.ok) {
      return NextResponse.json({ error: cfg.error }, { status: 400 });
    }

    const businessContext = [
      `Business Name: ${businessName}`,
      niche ? `Niche: ${niche}` : null,
      services ? `Services: ${services}` : null,
      `Receptionist Gender Preference: ${genderChoice}`,
      notes ? `Business Notes / Spreadsheet Info: ${notes}` : null,
      mapsDescription ? `Google Maps Description: ${mapsDescription}` : null,
      reviews ? `Google Reviews: ${reviews}` : null,
    ].filter(Boolean).join("\n");

    // Step 1: Generate the full long-form receptionist prompt as plain text
    const fullPrompt = await aiChat(
      cfg.config,
      `You are an expert AI receptionist prompt writer. You write complete, production-ready, long-form receptionist system prompts for businesses that use AI voice agents. Your output should be a full detailed script similar to a professional receptionist brief — not a short summary.`,
      `Write a complete AI receptionist system prompt for the following business.\n\n${businessContext}\n\n${nameGuidance}\n\nInclude these sections:\n- Business header and agent name (use the name you picked following the CRITICAL NAMING RULE above)\n- Opening greeting (exact words, starting with the agent's first name)\n- Language and personality rules\n- One-question-at-a-time rule\n- Goals list\n- Service routing logic based on their services\n- Step-by-step question flow for booking\n- Business knowledge section\n- FAQ section\n- Objection handling section\n- Escalation rules\n- General rules\n\nWrite it as a complete formatted script, not JSON. Make it premium, detailed, and near production-ready.`,
      2048
    );

    // Step 2: Extract structured metadata from the prompt — smaller, safer JSON
    const metaText = await aiChat(
      cfg.config,
      `Extract structured metadata from a receptionist prompt. Return ONLY valid compact JSON with no extra text.`,
      `From this receptionist prompt, extract metadata and return ONLY this JSON:\n{"agentName":"...","firstMessage":"...","tone":"...","services":["..."],"businessSummary":"..."}\n\nThe agentName must be the first name used by the receptionist in the prompt (do not invent a different one, do not default to 'Sarah').\n\nPrompt:\n${fullPrompt.slice(0, 1200)}`,
      400,
      "fast"
    );

    // Parse metadata safely
    let meta: Record<string, unknown> = {};
    try {
      const match = metaText.match(/\{[\s\S]*\}/);
      if (match) meta = JSON.parse(match[0]);
    } catch {
      // fallback
    }

    await deductCredits(session.userId, RECEPTIONIST_BUILD_CREDITS, {
      reason: "receptionist_build",
      metadata: { businessName },
    });

    return NextResponse.json({
      draft: {
        agentName: (meta.agentName as string) || businessName + " Virtual Receptionist",
        firstMessage: (meta.firstMessage as string) || "",
        tone: (meta.tone as string) || "Warm and professional",
        systemPrompt: fullPrompt,
        fullPrompt,
        knowledge: (meta.businessSummary as string) || "",
        bookingFlow: [],
        faqExamples: [],
        extractedBusinessProfile: {
          businessName,
          summary: (meta.businessSummary as string) || "",
          services: (meta.services as string[]) || [],
          locationContext: "",
          reviewInsights: [],
          brandTone: (meta.tone as string) || "",
        },
        elevenLabsAgentPayload: {
          agentName: (meta.agentName as string) || businessName + " Virtual Receptionist",
          firstMessage: (meta.firstMessage as string) || "",
          systemPrompt: fullPrompt,
          knowledgeBase: (meta.businessSummary as string) || "",
          voiceTone: (meta.tone as string) || "Warm and professional",
        },
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to build receptionist";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
