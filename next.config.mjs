/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Lint issues shouldn't block a production deploy. Run `npm run lint`
    // locally to clean them up.
    ignoreDuringBuilds: true,
  },
  async headers() {
    // Baseline security headers applied to every response. /api/websites/[id]
    // intentionally relaxes frame-ancestors via its own response headers for
    // the dashboard preview iframe, so we leave X-Frame-Options off there.
    const baseHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    return [
      {
        // Everything except the public shareable site endpoint.
        source: "/((?!api/websites/).*)",
        headers: [
          ...baseHeaders,
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      {
        // Shareable prospect sites — same hardening minus the frame restriction
        // so the dashboard preview iframe on the same origin still works.
        source: "/api/websites/:path*",
        headers: baseHeaders,
      },
    ];
  },
};

export default nextConfig;
