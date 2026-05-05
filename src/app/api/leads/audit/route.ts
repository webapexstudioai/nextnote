import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/crm";
import { runAudit, getLatestAudit, AuditError } from "@/lib/leadAudit";

// PSI alone can take 20-30s, plus reviews + Claude. Budget 90s.
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const prospectId = typeof body?.prospect_id === "string" ? body.prospect_id.trim() : "";
  if (!prospectId) {
    return NextResponse.json({ error: "prospect_id required" }, { status: 400 });
  }
  const force = body?.force === true;

  try {
    const result = await runAudit(userId, prospectId, { force });
    return NextResponse.json({ audit: result.audit, cached: result.cached });
  } catch (err) {
    if (err instanceof AuditError) {
      return NextResponse.json(
        { error: err.message, code: err.code, ...err.extra },
        { status: err.status },
      );
    }
    console.error("Lead audit failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Audit failed" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const prospectId = req.nextUrl.searchParams.get("prospect_id")?.trim();
  if (!prospectId) {
    return NextResponse.json({ error: "prospect_id required" }, { status: 400 });
  }

  const audit = await getLatestAudit(userId, prospectId);
  return NextResponse.json({ audit });
}
