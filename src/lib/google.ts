import { google } from "googleapis";
import { NextResponse } from "next/server";
import type { IronSession } from "iron-session";
import { getSession, type SessionData } from "@/lib/session";

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

export const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

type GoogleApiError = {
  code?: number;
  response?: { status?: number; data?: { error?: string } };
  message?: string;
};

// invalid_grant is the response Google gives when the refresh token has been
// revoked (user disconnected the app, changed their password, or the token
// expired after 7 days in Testing mode). 401/403 also indicate an auth issue
// that the user must resolve by reconnecting Google.
export function isGoogleAuthError(err: unknown): boolean {
  const e = err as GoogleApiError;
  if (!e) return false;
  if (e.code === 401 || e.code === 403) return true;
  const status = e.response?.status;
  if (status === 401 || status === 403) return true;
  const data = e.response?.data?.error;
  if (data === "invalid_grant" || data === "invalid_token") return true;
  const msg = e.message || "";
  return msg.includes("invalid_grant") || msg.includes("No refresh token");
}

export function googleReconnectResponse() {
  return NextResponse.json(
    {
      error: "Google connection expired. Please reconnect your Google account.",
      code: "google_reconnect_required",
    },
    { status: 401 },
  );
}

// Returns an OAuth2 client configured with the current session's credentials,
// with a token-refresh listener that safely persists refreshed access tokens
// back to the session. Errors inside the listener are swallowed so they don't
// crash the request — callers should still wrap their Google API calls in
// try/catch and use isGoogleAuthError() to handle auth failures cleanly.
export async function getAuthedGoogleClient(
  session: IronSession<SessionData>,
) {
  const client = getOAuth2Client();
  client.setCredentials({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
  });

  client.on("tokens", (tokens) => {
    // Persist refreshed tokens. We intentionally don't await inside the
    // listener — googleapis fires this synchronously during the API call.
    // Any persistence error is logged but doesn't break the request.
    (async () => {
      try {
        const s = await getSession();
        if (tokens.access_token) s.accessToken = tokens.access_token;
        if (tokens.refresh_token) s.refreshToken = tokens.refresh_token;
        if (tokens.expiry_date) s.expiresAt = tokens.expiry_date;
        await s.save();
      } catch (err) {
        console.error("Failed to persist refreshed Google token:", err);
      }
    })();
  });

  return client;
}
