import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuth2Client } from "@/lib/google";
import { getSession, getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";
import { encrypt } from "@/lib/crypto";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const returnTo = req.nextUrl.searchParams.get("state") || "/dashboard/appointments?connected=true";

  if (!code) {
    return NextResponse.redirect(new URL("/dashboard/appointments?error=no_code", req.url));
  }

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
