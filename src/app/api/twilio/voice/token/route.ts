import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import {
  mintVoiceAccessToken,
  softphoneIdentityFor,
  voiceAccessTokenConfigured,
} from "@/lib/twilioAccessToken";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!voiceAccessTokenConfigured()) {
    return NextResponse.json(
      { error: "Voice softphone not configured on server" },
      { status: 503 },
    );
  }

  const identity = softphoneIdentityFor(session.userId);
  const token = mintVoiceAccessToken({ identity, ttlSeconds: 3600 });
  return NextResponse.json({ token, identity });
}
