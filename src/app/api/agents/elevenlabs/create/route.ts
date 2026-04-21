import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { recordAgentOwnership } from "@/lib/agentOwnership";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { agentName, firstMessage, systemPrompt, voiceId } = await req.json();
    if (!agentName || !systemPrompt) {
      return NextResponse.json({ error: "Agent name and system prompt are required" }, { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ElevenLabs API key is not configured." }, { status: 500 });
    }

    const hangupInstruction = "\n\nCall handling: When the caller has no further questions, confirms they're done, or says goodbye, use the end_call tool to hang up. Do not keep the line open after the conversation is clearly complete.";
    const finalPrompt = /end[_ ]call/i.test(systemPrompt) ? systemPrompt : `${systemPrompt}${hangupInstruction}`;

    const payload = {
      conversation_config: {
        agent: {
          prompt: {
            prompt: finalPrompt,
            llm: "gemini-2.0-flash",
            tools: [
              {
                type: "system",
                name: "end_call",
                description: "End the call when the caller says goodbye, confirms they have no other questions, or the conversation is clearly complete. Do not end the call while the caller is still asking questions.",
              },
            ],
          },
          first_message: firstMessage || `Thank you for calling ${agentName}. How can I help you today?`,
          language: "en",
        },
        tts: {
          voice_id: voiceId || process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM",
        },
        conversation: {
          max_duration_seconds: 900,
        },
      },
      name: agentName,
    };

    const res = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data?.detail?.message || data?.message || JSON.stringify(data);
      return NextResponse.json({ error: `ElevenLabs: ${msg}` }, { status: res.status });
    }

    try {
      await recordAgentOwnership(session.userId, data.agent_id, data.name || agentName);
    } catch (ownErr) {
      // Roll back the ElevenLabs agent so we don't orphan it on the shared account.
      await fetch(`https://api.elevenlabs.io/v1/convai/agents/${data.agent_id}`, {
        method: "DELETE",
        headers: { "xi-api-key": apiKey },
      }).catch(() => {});
      const msg = ownErr instanceof Error ? ownErr.message : "Failed to record ownership";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json({
      agentId: data.agent_id,
      agentName: data.name || agentName,
      success: true,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create ElevenLabs agent";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
