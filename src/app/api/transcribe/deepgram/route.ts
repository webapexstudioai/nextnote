import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Deepgram API key is not configured" }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const response = await fetch("https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&language=en-US", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": file.type || "audio/webm",
      },
      body: arrayBuffer,
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: data?.err_msg || data?.message || "Transcription failed" }, { status: response.status });
    }

    const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

    return NextResponse.json({ transcript, raw: data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transcription failed" },
      { status: 500 }
    );
  }
}
