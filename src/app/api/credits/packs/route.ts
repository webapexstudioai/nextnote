import { NextResponse } from "next/server";
import { CREDIT_PACKS } from "@/lib/credits";

export async function GET() {
  return NextResponse.json({ packs: CREDIT_PACKS });
}
