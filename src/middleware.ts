import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public paths that don't need auth
  const publicPaths = [
    "/",
    "/auth/login",
    "/auth/signup",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/api/auth/login",
    "/api/auth/signup",
    "/api/auth/google",
    "/api/auth/google/callback",
    "/api/auth/status",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
  ];
  if (publicPaths.some((p) => pathname === p) || pathname.startsWith("/api/auth/") || pathname.startsWith("/api/websites/")) {
    return NextResponse.next();
  }

  // Check session cookie
  const sessionCookie = req.cookies.get("nextnote_auth_session");

  // Allow verify-email for logged-in users (needs session)
  if (pathname === "/auth/verify-email") {
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }
    return NextResponse.next();
  }

  // Protect dashboard routes
  if (pathname.startsWith("/dashboard") && !sessionCookie) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  // Protect settings API
  if (pathname.startsWith("/api/settings") && !sessionCookie) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Redirect logged-in users away from auth pages
  if ((pathname === "/auth/login" || pathname === "/auth/signup") && sessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/audio).*)"],
};
