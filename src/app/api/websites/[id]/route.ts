import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const { data, error } = await supabaseAdmin
    .from("generated_websites")
    .select("html_content")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return new NextResponse("Database error", { status: 500 });
  }

  if (!data?.html_content) {
    return new NextResponse("Site not found", { status: 404 });
  }

  return new NextResponse(data.html_content, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
