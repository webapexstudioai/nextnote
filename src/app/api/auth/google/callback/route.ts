import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { google } from "googleapis";
import { getOAuth2Client } from "@/lib/google";
import { getSession, getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";
import { encrypt } from "@/lib/crypto";

const OAUTH_STATE_COOKIE = "nextnote_oauth_state";

interface OAuthStateData {
  nonce?: string;
  returnTo?: string;
  createdAt?: number;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const incomingState = req.nextUrl.searchParams.get("state");

  const cookieStore = cookies();
  const stateSession = await getIronSession<OAuthStateData>(cookieStore, {
    password: process.env.SESSION_SECRET as string,
    cookieName: OAUTH_STATE_COOKIE,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 10,
    },
  });

  const expectedNonce = stateSession.nonce;
  const storedReturnTo = stateSession.returnTo || "/dashboard/appointments?connected=true";
  const createdAt = stateSession.createdAt ?? 0;

  // Always clear the state cookie — single-use.
  stateSession.destroy();

  if (!code) {
    return NextResponse.redirect(new URL("/dashboard/appointments?error=no_code", req.url));
  }
  if (!incomingState || !expectedNonce || !safeEqual(incomingState, expectedNonce)) {
    return NextResponse.redirect(new URL("/dashboard/appointments?error=invalid_state", req.url));
  }
  // Enforce the 10-minute state lifetime at the app layer too (belt + suspenders).
  if (!createdAt || Date.now() - createdAt > 10 * 60 * 1000) {
    return NextResponse.redirect(new URL("/dashboard/appointments?error=state_expired", req.url));
  }

  // The callback must only return the user to an internal path.
  const returnTo = storedReturnTo.startsWith("/") && !storedReturnTo.startsWith("//")
    ? storedReturnTo
    : "/dashboard/appointments?connected=true";

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    const session = await getSession();
    session.accessToken = tokens.access_token ?? undefined;
    session.refreshToken = tokens.refresh_token ?? undefined;
    session.email = userInfo.email ?? undefined;
    session.expiresAt = tokens.expiry_date ?? undefined;
    await session.save();

    // Also persist to user_settings so webhook tool calls (without a session cookie) can use them.
    const authSession = await getAuthSession();
    if (authSession.isLoggedIn && authSession.userId && tokens.refresh_token) {
      const updates: Record<string, string | number> = {
        google_refresh_token_encrypted: encrypt(tokens.refresh_token),
      };
      if (tokens.access_token) updates.google_access_token_encrypted = encrypt(tokens.access_token);
      if (tokens.expiry_date) updates.google_token_expiry = tokens.expiry_date;

      const { data: existing } = await supabaseAdmin
        .from("user_settings").select("id").eq("user_id", authSession.userId).single();
      if (existing) {
        await supabaseAdmin.from("user_settings").update(updates).eq("user_id", authSession.userId);
      } else {
        await supabaseAdmin.from("user_settings").insert({ user_id: authSession.userId, ...updates });
      }
    }

    return NextResponse.redirect(new URL(returnTo, req.url));
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.redirect(new URL("/dashboard/appointments?error=auth_failed", req.url));
  }
}
