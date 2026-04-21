import { NextRequest, NextResponse } from "next/server";
import { getOAuth2Client, SCOPES } from "@/lib/google";

export async function GET(req: NextRequest) {
  const oauth2Client = getOAuth2Client();
  const returnTo = req.nextUrl.searchParams.get("returnTo") || "/dashboard/appointments?connected=true";

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state: returnTo,
  });

  return NextResponse.redirect(authUrl);
}
