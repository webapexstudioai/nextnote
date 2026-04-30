import { NextRequest, NextResponse } from "next/server";

const WHITELABEL_HOST = "pitchsite.dev";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = (req.headers.get("host") || "").toLowerCase();

  // White-label hosting: requests to {slug}.pitchsite.dev are public landing
  // pages. Rewrite them to the slug-resolver route — and short-circuit the
  // auth checks below so prospects never get bounced to /auth/login.
  if (host.endsWith(`.${WHITELABEL_HOST}`) && host !== WHITELABEL_HOST) {
    const slug = host.slice(0, host.length - WHITELABEL_HOST.length - 1);
    if (slug && slug !== "www") {
      const url = req.nextUrl.clone();
      url.pathname = `/api/websites/by-slug/${encodeURIComponent(slug)}`;
      return NextResponse.rewrite(url);
    }
  }
  // Apex pitchsite.dev: only serve the neutral landing page. Any other path
  // (dashboard, auth, admin, …) must NOT leak the NextNote brand from this
  // domain — rewrite everything to the apex landing.
  if (host === WHITELABEL_HOST) {
    const url = req.nextUrl.clone();
    url.pathname = "/api/websites/whitelabel-root";
    return NextResponse.rewrite(url);
  }

  // Admin routes: require a session cookie at the middleware layer. The route
  // handlers re-check is_admin on every request. This avoids leaking the admin
  // surface to unauthenticated scanners.
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const sessionCookie = req.cookies.get("nextnote_auth_session");
    if (!sessionCookie) {
      if (pathname.startsWith("/api/admin")) {
        return new NextResponse("Not found", { status: 404 });
      }
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }
    // Fall through — requireAdmin() in each admin handler does the real is_admin check.
    return NextResponse.next();
  }

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
