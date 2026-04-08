import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  try {
    const { rows, headers } = await req.json();

    if (!rows || !headers) {
      return NextResponse.json({ error: "Missing rows or headers" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "your-api-key-here") {
      return NextResponse.json(
        { error: "Anthropic API key not configured. Add your key in Settings." },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });

    // Send a sample of data (first 5 rows) to Claude for column mapping
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
- "notes" (any additional notes, comments, or descriptions)
- "status" (their status like New, Contacted, Qualified, Booked, Closed)
- "skip" (columns that don't map to any field)

Return ONLY a valid JSON object mapping each original header to its field. Example:
{"Full Name": "name", "Email Address": "email", "Phone #": "phone", "Interest": "service", "Comments": "notes", "Stage": "status", "ID": "skip"}

Be smart about detecting fields even with unusual header names. If a column contains phone-number-like data, map it to "phone" even if the header is ambiguous. Same for emails, names, etc.

Return ONLY the JSON mapping, nothing else.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";

    // Parse the JSON mapping from Claude's response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    const columnMapping = JSON.parse(jsonMatch[0]);

    // Now map all rows using the AI-detected mapping
    const mappedProspects = rows.map((row: Record<string, string>, index: number) => {
      const prospect: Record<string, string> = {
        id: `import-${Date.now()}-${index}`,
        name: "",
        email: "",
        phone: "",
        service: "",
        notes: "",
        status: "New",
        createdAt: new Date().toISOString().split("T")[0],
      };

      for (const [header, field] of Object.entries(columnMapping)) {
        if (field === "skip" || !row[header]) continue;
        const value = String(row[header]).trim();

        if (field === "status") {
          // Normalize status values
          const normalized = value.toLowerCase();
          if (normalized.includes("contact")) prospect.status = "Contacted";
          else if (normalized.includes("qualif")) prospect.status = "Qualified";
          else if (normalized.includes("book")) prospect.status = "Booked";
          else if (normalized.includes("close") || normalized.includes("won")) prospect.status = "Closed";
          else prospect.status = "New";
        } else if (typeof field === "string" && field in prospect) {
          // Append to notes if field already has data (multiple columns mapped to same field)
          if (prospect[field] && field === "notes") {
            prospect[field] += ` | ${value}`;
          } else {
            prospect[field] = value;
          }
        }
      }

      // Set a fallback name if empty
      if (!prospect.name) prospect.name = `Lead #${index + 1}`;

      return prospect;
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
