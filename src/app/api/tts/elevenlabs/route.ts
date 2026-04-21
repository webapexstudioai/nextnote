import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { text, voiceId } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const defaultVoice = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
    if (!apiKey) {
      return NextResponse.json({ error: "ELEVENLABS_API_KEY is not configured." }, { status: 500 });
    }

    const synth = async (targetVoiceId: string) => fetch(`https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
        },
      }),
    });

    let response = await synth(voiceId || defaultVoice);

    if (!response.ok) {
      const fallbackRes = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": apiKey },
        cache: "no-store",
      });
      const fallbackData = await fallbackRes.json().catch(() => ({}));
      const firstVoiceId = fallbackData?.voices?.[0]?.voice_id;
      if (fallbackRes.ok && firstVoiceId && firstVoiceId !== (voiceId || defaultVoice)) {
        response = await synth(firstVoiceId);
      }
    }

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err || "ElevenLabs request failed" }, { status: 500 });
    }

    const audioBuffer = await response.arrayBuffer();
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to generate speech";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
