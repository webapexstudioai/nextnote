import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { getUserAIConfig, aiChat } from "@/lib/ai";
import { getBalance, deductCredits, AI_PARSE_CREDITS } from "@/lib/credits";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { rows, headers } = await req.json();
    if (!rows || !headers) {
      return NextResponse.json({ error: "Missing rows or headers" }, { status: 400 });
    }

    const balance = await getBalance(session.userId);
    if (balance < AI_PARSE_CREDITS) {
      return NextResponse.json({ error: "Insufficient credits", required: AI_PARSE_CREDITS, balance }, { status: 402 });
    }

    const result = await getUserAIConfig(session.userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const sampleRows = rows.slice(0, 5);
    const prompt = `You are analyzing a spreadsheet of business leads/prospects. Here are the column headers and sample data:

Headers: ${JSON.stringify(headers)}

Sample rows (first ${sampleRows.length}):
${sampleRows.map((row: Record<string, string>, i: number) => `Row ${i + 1}: ${JSON.stringify(row)}`).join("\n")}

Your job is to map each header to one of these prospect fields:
- "name" (the person's full name)
- "email" (email address)
- "phone" (phone number)
- "service" (service they're interested in, or business type, or product)
- "address" (street address, business address, location, city+state, or any mappable postal address — will be used to generate a Google Maps link)
- "mapsUrl" (a column containing a Google Maps URL like "https://www.google.com/maps/place/..." or "https://maps.app.goo.gl/...")
- "website" (company website or URL — NOT a Google Maps URL)
- "contactName" (the person's name when the "name" column is the company/business name)
- "notes" (any additional notes, comments, or descriptions)
- "status" (their status like New, Contacted, Qualified, Booked, Closed)
- "skip" (columns that don't map to any field)

Return ONLY a valid JSON object mapping each original header to its field. Example:
{"Full Name": "name", "Email Address": "email", "Phone #": "phone", "Interest": "service", "Address": "address", "Website": "website", "Comments": "notes", "Stage": "status", "ID": "skip"}

Be smart about detecting fields even with unusual header names. If a column contains phone-number-like data, map it to "phone" even if the header is ambiguous. Same for emails, names, etc.

Return ONLY the JSON mapping, nothing else.`;

    let responseText: string;
    try {
      responseText = await aiChat(result.config, undefined, prompt, 1024, "fast");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("invalid") || msg.includes("API key")) {
        return NextResponse.json(
          { error: "Your AI API key is invalid or expired. Please update it in Settings." },
          { status: 400 }
        );
      }
      throw err;
    }

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    const columnMapping = JSON.parse(jsonMatch[0]);

    const mappedProspects = rows.map((row: Record<string, string>, index: number) => {
      const prospect: Record<string, string> = {
        id: `import-${Date.now()}-${index}`,
        name: "",
        email: "",
        phone: "",
        service: "",
        address: "",
        website: "",
        contactName: "",
        mapsUrl: "",
        notes: "",
        status: "New",
        createdAt: new Date().toISOString().split("T")[0],
      };

      for (const [header, field] of Object.entries(columnMapping)) {
        if (field === "skip" || !row[header]) continue;
        const value = String(row[header]).trim();

        if (field === "status") {
          const normalized = value.toLowerCase();
          if (normalized.includes("contact")) prospect.status = "Contacted";
          else if (normalized.includes("qualif")) prospect.status = "Qualified";
          else if (normalized.includes("book")) prospect.status = "Booked";
          else if (normalized.includes("close") || normalized.includes("won")) prospect.status = "Closed";
          else prospect.status = "New";
        } else if (typeof field === "string" && field in prospect) {
          if (prospect[field] && field === "notes") {
            prospect[field] += ` | ${value}`;
          } else {
            prospect[field] = value;
          }
        }
      }

      if (!prospect.name) prospect.name = `Lead #${index + 1}`;
      return prospect;
    });

    await deductCredits(session.userId, AI_PARSE_CREDITS, {
      reason: "ai_parse",
      metadata: { totalRows: rows.length },
    });

    return NextResponse.json({
      mapping: columnMapping,
      prospects: mappedProspects,
      totalRows: rows.length,
    });
  } catch (error) {
    console.error("AI Parse error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
