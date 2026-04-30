import { NextRequest, NextResponse } from "next/server";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function POST(req: NextRequest) {
  const text = req.nextUrl.searchParams.get("text") || "Callback from a prospect.";
  const safe = escapeXml(text.slice(0, 200));
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">${safe}</Say></Response>`,
    { status: 200, headers: { "Content-Type": "text/xml" } },
  );
}
