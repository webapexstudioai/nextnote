import { NextResponse } from "next/server";

// pitchsite.dev itself is a passive parent domain — visitors who type the
// apex directly aren't customers, they're curious onlookers. Serve a tiny,
// neutral page that does NOT mention NextNote (per white-label policy).
export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>pitchsite.dev</title>
<style>
  html,body{margin:0;height:100%;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0b0d;color:#e4e4e7;}
  .wrap{display:flex;align-items:center;justify-content:center;height:100%;text-align:center;padding:1rem;}
  h1{font-size:1.05rem;font-weight:500;letter-spacing:.04em;color:#a1a1aa;margin:0;}
</style>
</head>
<body>
<div class="wrap"><h1>This domain hosts shared landing pages.</h1></div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
