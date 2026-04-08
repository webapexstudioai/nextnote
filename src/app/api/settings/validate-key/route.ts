import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { provider, api_key } = await req.json();

    if (!provider || !api_key) {
      return NextResponse.json({ error: "Missing provider or api_key" }, { status: 400 });
    }

    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": api_key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });

      if (res.ok || res.status === 200) {
        return NextResponse.json({ valid: true, provider: "anthropic" });
      }

      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || (data?.error?.type === "authentication_error")) {
        return NextResponse.json({ valid: false, provider: "anthropic", reason: "Invalid API key" });
      }

      // Other errors (rate limit, etc.) mean the key is likely valid
      if (res.status === 429 || res.status === 529) {
        return NextResponse.json({ valid: true, provider: "anthropic" });
      }

      return NextResponse.json({ valid: false, provider: "anthropic", reason: data?.error?.message || "Validation failed" });
    }

    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${api_key}`,
        },
      });

      if (res.ok) {
        return NextResponse.json({ valid: true, provider: "openai" });
      }

      if (res.status === 401) {
        return NextResponse.json({ valid: false, provider: "openai", reason: "Invalid API key" });
      }

      // Rate limit = key is valid
      if (res.status === 429) {
        return NextResponse.json({ valid: true, provider: "openai" });
      }

      return NextResponse.json({ valid: false, provider: "openai", reason: "Validation failed" });
    }

    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  } catch (err) {
    console.error("Key validation error:", err);
    return NextResponse.json({ error: "Validation request failed" }, { status: 500 });
  }
}
