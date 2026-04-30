import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { requirePro } from "@/lib/tierGuard";
import { getUserAIConfig, aiChat } from "@/lib/ai";
import { getBalance, deductCredits, AI_INSIGHTS_CREDITS } from "@/lib/credits";

interface StageStat { count: number; avgDaysInStage: number; revenue: number; }

interface Digest {
  totals: {
    prospects: number;
    closedThisWeek: number;
    closedLastWeek: number;
    revenueThisWeek: number;
    revenueLastWeek: number;
    revenueAllTime: number;
    bookingsThisWeek: number;
  };
  stages: Record<"New" | "Contacted" | "Qualified" | "Booked" | "Closed", StageStat>;
  topServices: Array<{ service: string; count: number }>;
  stuck: Array<{ id: string; name: string; stage: string; daysSinceCreated: number; dealValue?: number; service?: string }>;
  recentWins: Array<{ name: string; dealValue?: number; closedAt?: string }>;
}

interface Action {
  prospectId: string;
  prospectName: string;
  action: string;
  reason: string;
  priority: "high" | "med" | "low";
}

const SYSTEM = `You are a sharp, no-fluff outbound sales advisor for solo agency owners. You speak in tight, specific sentences. You call out the real leak in their workflow. You recommend concrete actions, not motivation.`;

function buildPrompt(digest: Digest): string {
  return `Here is the user's prospect pipeline digest:

${JSON.stringify(digest, null, 2)}

Write two things:

1. "narrative" — 3 to 4 sentences max. Open with this week's revenue vs last week (call out the delta as a percent if meaningful). Identify the single biggest bottleneck in their pipeline (the stage where leads stall longest, or where the biggest $ is stuck). End with ONE concrete thing to do tomorrow. Warm but direct. No emojis. No generic platitudes.

2. "actions" — up to 6 ranked next-best-actions, each tied to a specific prospect from the "stuck" list. Each item is { prospectId, prospectName, action, reason, priority }. Priority is "high" | "med" | "low". Action is a short imperative ("Call Jordan", "Send proposal", "Follow up via email"). Reason is one sentence of justification grounded in the data.

Return ONLY valid JSON in this exact shape:
{
  "narrative": "...",
  "actions": [
    { "prospectId": "...", "prospectName": "...", "action": "...", "reason": "...", "priority": "high" }
  ]
}`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const gate = await requirePro(session.userId, "AI Insights");
    if (!gate.ok) return gate.response;

    const body = await req.json();
    const digest = body?.digest as Digest | undefined;
    if (!digest || !digest.totals) {
      return NextResponse.json({ error: "Missing digest" }, { status: 400 });
    }

    const balance = await getBalance(session.userId);
    if (balance < AI_INSIGHTS_CREDITS) {
      return NextResponse.json({ error: "Insufficient credits", required: AI_INSIGHTS_CREDITS, balance }, { status: 402 });
    }

    const result = await getUserAIConfig(session.userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    let text: string;
    try {
      text = await aiChat(result.config, SYSTEM, buildPrompt(digest), 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("invalid") || msg.includes("API key")) {
        return NextResponse.json(
          { error: "Your AI API key is invalid or expired. Update it in Settings → API Keys." },
          { status: 400 }
        );
      }
      throw err;
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI returned an unparseable response." }, { status: 502 });
    }

    let parsed: { narrative: string; actions: Action[] };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ error: "AI returned malformed JSON." }, { status: 502 });
    }

    await deductCredits(session.userId, AI_INSIGHTS_CREDITS, {
      reason: "ai_insights",
      metadata: { prospects: digest.totals.prospects },
    });

    return NextResponse.json({
      narrative: parsed.narrative || "",
      actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 6) : [],
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[ai-insights/summary]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
