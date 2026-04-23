import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getOAuth2Client, SCOPES } from "@/lib/google";

const OAUTH_STATE_COOKIE = "nextnote_oauth_state";

interface OAuthStateData {
  nonce?: string;
  returnTo?: string;
  createdAt?: number;
}

export async function GET(req: NextRequest) {
  const oauth2Client = getOAuth2Client();
  const rawReturnTo = req.nextUrl.searchParams.get("returnTo") || "/dashboard/appointments?connected=true";

  // Only allow internal paths, never an absolute URL — prevents open-redirect
  // via a crafted OAuth link.
  const returnTo = rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//")
    ? rawReturnTo
    : "/dashboard/appointments?connected=true";

  const nonce = crypto.randomBytes(32).toString("hex");

  // Store the nonce in a short-lived signed cookie; the OAuth provider sees only
  // the nonce in the state param, so the callback can verify the round-trip.
  const cookieStore = cookies();
  const stateSession = await getIronSession<OAuthStateData>(cookieStore, {
    password: process.env.SESSION_SECRET as string,
    cookieName: OAUTH_STATE_COOKIE,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 10, // 10 minutes is plenty to complete an OAuth flow
    },
  });
  stateSession.nonce = nonce;
  stateSession.returnTo = returnTo;
  stateSession.createdAt = Date.now();
  await stateSession.save();

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state: nonce,
  });

  return NextResponse.redirect(authUrl);
}
