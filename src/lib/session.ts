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

const authSessionOptions = {
  password: process.env.SESSION_SECRET || "complex_password_at_least_32_characters_long_nextnote_2024",
  cookieName: "nextnote_auth_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
  },
};

export async function getAuthSession(): Promise<IronSession<AuthSessionData>> {
  const cookieStore = cookies();
  return getIronSession<AuthSessionData>(cookieStore, authSessionOptions);
}
