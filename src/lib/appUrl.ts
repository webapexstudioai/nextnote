/**
 * Public app URL used for outbound webhook registrations (ElevenLabs tools,
 * third-party callbacks, etc.). Order of preference:
 *
 *   1. APP_URL             — explicit override (custom domain)
 *   2. NEXT_PUBLIC_APP_URL — some features read from the client bundle
 *   3. VERCEL_URL          — set automatically on Vercel deployments
 *
 * Falls back to "" (empty) in localhost with no overrides, which callers
 * should treat as "not reachable — tools will not fire remotely."
 */
export function getAppUrl(): string {
  const explicit = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_URL;
  if (vercel) {
    return vercel.startsWith("http") ? vercel.replace(/\/+$/, "") : `https://${vercel}`;
  }

  return "";
}

export function isAppUrlReachable(url: string): boolean {
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  const host = url.replace(/^https?:\/\//i, "").split("/")[0];
  if (!host) return false;
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)(:|$)/i.test(host)) return false;
  if (/\.local(:|$)/i.test(host)) return false;
  return url.startsWith("https://");
}
