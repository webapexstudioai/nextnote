import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { assertOwnsAgent } from "@/lib/agentOwnership";

export const maxDuration = 15;

export async function POST(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
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
    const { message, prompt, firstMessage, history, llm } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const elevenKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenKey) {
      return NextResponse.json({ error: "ElevenLabs API key is not configured" }, { status: 500 });
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      headers: {
        "xi-api-key": elevenKey,
      },
      cache: "no-store",
    });

    const agentData = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: agentData?.detail?.message || "Failed to load agent" }, { status: response.status });
    }

    const activePrompt = prompt || agentData?.conversation_config?.agent?.prompt?.prompt || "";
    const activeFirstMessage = firstMessage || agentData?.conversation_config?.agent?.first_message || "";
    const requestedLlm = llm || agentData?.conversation_config?.agent?.prompt?.llm || "gpt-4o-mini";
    const activeLlm = requestedLlm.startsWith("gpt-") ? requestedLlm : "gpt-4o-mini";

    const priorMessages = Array.isArray(history)
      ? history
          .filter((item: { role?: string; content?: string }) => item?.role && item?.content)
          .slice(-8)
          .map((item: { role: string; content: string }) => ({
            role: item.role === "user" ? "user" : "assistant",
            content: item.content,
          }))
      : [];

    const completionPayload = {
      model: activeLlm,
      messages: [
        {
          role: "system",
          content:
            `You are previewing an ElevenLabs voice agent inside NextNote. ` +
            `You must behave like the configured agent and follow its system prompt carefully. ` +
            `Do not repeat the greeting on every turn. The first greeting should only be used when the conversation is starting. ` +
            `If the user asks about pricing, services, booking, availability, or business details, answer from the agent prompt when possible. ` +
            `If the prompt does not contain the exact answer, respond naturally without inventing fake confirmed facts. ` +
            `Stay conversational and answer only the latest user message.\n\n` +
            `Agent first message:\n${activeFirstMessage || "None"}\n\n` +
            `Agent system prompt:\n${activePrompt}`,
        },
        ...priorMessages,
        { role: "user", content: message },
      ],
      temperature: 0.45,
      max_tokens: 220,
    };

    const openAiKey = process.env.OPENAI_API_KEY;
    if (!openAiKey) {
      const lowerMessage = String(message).toLowerCase();
      const promptText = String(activePrompt || "");

      const pricingMatch = promptText.match(/pricing[\s\S]{0,500}/i) || promptText.match(/price[\s\S]{0,500}/i) || promptText.match(/cost[\s\S]{0,500}/i);
      const servicesMatch = promptText.match(/services?[\s\S]{0,500}/i) || promptText.match(/what we do[\s\S]{0,500}/i);

      let fallbackReply = "";

      const hasPriorTurns = Array.isArray(history) && history.length > 0;

      if (!hasPriorTurns) {
        fallbackReply = activeFirstMessage || "Hello, how can I help you today?";
      } else if (lowerMessage.includes("pricing") || lowerMessage.includes("price") || lowerMessage.includes("cost")) {
        fallbackReply = pricingMatch
          ? `Absolutely. ${pricingMatch[0].trim()}`
          : "Absolutely. Pricing can vary depending on the scope of the project. If you'd like, I can get a few details and help you with the next step.";
      } else if (lowerMessage.includes("service") || lowerMessage.includes("offer") || lowerMessage.includes("do you do") || lowerMessage.includes("what do you do")) {
        fallbackReply = servicesMatch
          ? `Sure, here’s a quick overview: ${servicesMatch[0].trim()}`
          : "We can definitely help with that. If you tell me what kind of project you have in mind, I can point you in the right direction.";
      } else {
        fallbackReply = "I’m happy to help. Can you share a little more about what you need so I can point you in the right direction?";
      }

      return NextResponse.json({
        reply: fallbackReply,
        mode: "fallback",
      });
    }

    const completionRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(completionPayload),
      cache: "no-store",
    });

    const completionData = await completionRes.json();
    if (!completionRes.ok) {
      return NextResponse.json({ error: completionData?.error?.message || "Preview failed" }, { status: completionRes.status });
    }

    let reply = completionData?.choices?.[0]?.message?.content?.trim() || "";

    if (!reply) {
      reply = history?.length ? "I’m happy to help. Could you tell me a little more about what you need?" : (activeFirstMessage || "Hello, how can I help you today?");
    }

    return NextResponse.json({ reply, mode: "preview" });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Preview failed" },
      { status: 500 }
    );
  }
}
