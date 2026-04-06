import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuth2Client } from "@/lib/google";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/dashboard/appointments?error=no_code", req.url));
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user email
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    // Store in encrypted session
    const session = await getSession();
    session.accessToken = tokens.access_token ?? undefined;
    session.refreshToken = tokens.refresh_token ?? undefined;
    session.email = userInfo.email ?? undefined;
    session.expiresAt = tokens.expiry_date ?? undefined;
    await session.save();

    return NextResponse.redirect(new URL("/dashboard/appointments?connected=true", req.url));
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.redirect(new URL("/dashboard/appointments?error=auth_failed", req.url));
  }
}
