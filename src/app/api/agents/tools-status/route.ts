import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { getAppUrl, isAppUrlReachable } from "@/lib/appUrl";

/**
 * Reports whether the tool-webhook URL is actually reachable by ElevenLabs.
 * Used by the agent editor to show a live status banner instead of a static
 * "dev note". No secrets are returned — only boolean status flags.
 */
export async function GET() {
  const session = await getAuthSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const appUrl = getAppUrl();
  const reachable = isAppUrlReachable(appUrl);
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(appUrl);
  const secretConfigured = !!(process.env.TOOLS_WEBHOOK_SECRET || "").trim();
  const vercelUrl = process.env.VERCEL_URL || "";
  const appUrlExplicit = !!(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();

  return NextResponse.json({
    appUrl,
    reachable,
    isLocalhost,
    secretConfigured,
    source: appUrlExplicit ? "APP_URL" : vercelUrl ? "VERCEL_URL" : "none",
  });
}
