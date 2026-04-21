import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";

// Google OAuth session (existing)
export interface SessionData {
  accessToken?: string;
  refreshToken?: string;
  email?: string;
  expiresAt?: number;
}

const sessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: "nextnote_google_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 14,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

// Auth session (user login)
export interface AuthSessionData {
  userId?: string;
  name?: string;
  agencyName?: string;
  email?: string;
  isLoggedIn?: boolean;
}

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET environment variable must be set and at least 32 characters long.");
}

const authSessionOptions = {
  password: process.env.SESSION_SECRET,
  cookieName: "nextnote_auth_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 14,
  },
};

export async function getAuthSession(): Promise<IronSession<AuthSessionData>> {
  const cookieStore = cookies();
  return getIronSession<AuthSessionData>(cookieStore, authSessionOptions);
}
