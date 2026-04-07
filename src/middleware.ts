import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public paths that don't need auth
  const publicPaths = ["/", "/auth/login", "/auth/signup", "/api/auth/login", "/api/auth/signup", "/api/auth/google", "/api/auth/google/callback", "/api/auth/status"];
  if (publicPaths.some((p) => pathname === p) || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // Check session cookie
  const sessionCookie = req.cookies.get("nextnote_auth_session");

  // Protect dashboard routes
  if (pathname.startsWith("/dashboard") && !sessionCookie) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
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
