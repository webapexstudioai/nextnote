import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { getUserAIConfig, aiChat } from "@/lib/ai";
import { getBalance, deductCredits, WEBSITE_AI_EDIT_CREDITS } from "@/lib/credits";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureFormHandler, stripPoweredByBadge } from "@/lib/websiteForms";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await context.params;
    const { instruction } = await req.json();

    if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
      return NextResponse.json({ error: "Instruction is required" }, { status: 400 });
    }

    const balance = await getBalance(session.userId);
    if (balance < WEBSITE_AI_EDIT_CREDITS) {
      return NextResponse.json(
        { error: "Insufficient credits", required: WEBSITE_AI_EDIT_CREDITS, balance },
        { status: 402 },
      );
    }

    const { data: site, error: siteErr } = await supabaseAdmin
      .from("generated_websites")
      .select("id, user_id, html_content, tier")
      .eq("id", id)
      .maybeSingle();

    if (siteErr || !site) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }
    if (site.user_id !== session.userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const aiResult = await getUserAIConfig(session.userId);
    if (!aiResult.ok) {
      return NextResponse.json({ error: aiResult.error }, { status: 400 });
    }

    const systemPrompt = `You are an expert web designer editing an existing single-file HTML landing page.

CRITICAL OUTPUT RULES:
- Output format: raw HTML only. Your FIRST characters must be "<!DOCTYPE html>" and your LAST characters must be "</html>".
- NEVER wrap the output in markdown code fences (no \`\`\`html, no \`\`\`). No commentary, no preamble, no "Here is the updated HTML".
- Return the COMPLETE document from <!DOCTYPE html> through </html>. Do not truncate, do not use "..." or "rest unchanged" placeholders.

EDIT RULES:
- Apply the user's requested change to the HTML.
- When the user asks to change the color palette, update EVERY Tailwind color utility class (bg-*, text-*, from-*, to-*, via-*, border-*, ring-*, hover:bg-*, etc.) AND every inline style color/background/gradient to the new palette across the ENTIRE document — hero, sections, buttons, CTAs, footer, links. Do not leave remnants of the old palette.
- Preserve non-color structure: Tailwind CDN script, Google Fonts link, hero <img> URL, contact links (tel:, mailto:), overall section layout.
- Keep responsive design and accessibility intact.
${
  site.tier === "whitelabel"
    ? `- This is a WHITE-LABEL site. Do NOT add a "Powered by NextNote" badge or any third-party credit. If one is somehow present, remove it.`
    : `- Do NOT remove the "Powered by NextNote" badge if it is present in the footer.`
}
- PRESERVE EXACTLY (these wire the form to our lead-capture backend — removing them breaks lead capture):
  • Every <form data-nn-form> element and its data-nn-form attribute
  • The hidden honeypot field: <input type="text" name="company_website" ...>
  • The field name attributes: name="name", name="email", name="phone", name="message"
  • The <p data-nn-form-status> status line inside each form
  • The <script id="nn-form-handler"> block (do not remove, do not rewrite its contents)
  You MAY restyle the form, change the heading copy, re-arrange layout, or change the submit button label — but do NOT remove or rename the attributes and script above.`;

    const userPrompt = `Requested change from the user:
"""
${instruction.trim()}
"""

Current HTML (edit this and return the full updated document, starting with <!DOCTYPE html> and ending with </html>):
"""
${site.html_content}
"""`;

    // Anthropic (Sonnet 4) supports larger outputs; OpenAI (gpt-4o) caps at 16384.
    const editMaxTokens = aiResult.config.provider === "anthropic" ? 32000 : 16000;
    const rawHtml = await aiChat(aiResult.config, systemPrompt, userPrompt, editMaxTokens);

    // Strip markdown fences if the model ignored instructions and wrapped the HTML.
    const fenceMatch = rawHtml.match(/```(?:html)?\s*([\s\S]*?)\s*```/i);
    let updatedHtml = fenceMatch ? fenceMatch[1].trim() : rawHtml.trim();

    // Strip any leading preamble like "Here is the updated HTML:" before <!DOCTYPE.
    const doctypeIdx = updatedHtml.search(/<!DOCTYPE\s+html/i);
    if (doctypeIdx > 0) updatedHtml = updatedHtml.slice(doctypeIdx);
    else {
      const htmlIdx = updatedHtml.indexOf("<html");
      if (htmlIdx > 0) updatedHtml = updatedHtml.slice(htmlIdx);
    }

    if (!/<!DOCTYPE\s+html/i.test(updatedHtml) && !updatedHtml.includes("<html")) {
      return NextResponse.json({ error: "AI did not return valid HTML" }, { status: 500 });
    }

    // Guard against truncated responses — must end with </html>.
    if (!/<\/html>\s*$/i.test(updatedHtml)) {
      return NextResponse.json(
        { error: "AI response was truncated. Try a smaller change or split it into multiple edits." },
        { status: 500 },
      );
    }

    // Sanity: make sure the model actually changed something.
    if (updatedHtml === site.html_content) {
      return NextResponse.json(
        { error: "AI returned the page unchanged. Try rephrasing your instruction (e.g. 'change every accent color to emerald green')." },
        { status: 500 },
      );
    }

    // Re-assert the form-submit handler — if the edit stripped the script,
    // we re-inject it so lead capture never silently breaks after an AI edit.
    updatedHtml = ensureFormHandler(updatedHtml, id);

    // White-label: strip any badge the AI may have re-added during the edit.
    if (site.tier === "whitelabel") {
      updatedHtml = stripPoweredByBadge(updatedHtml);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("generated_websites")
      .update({ html_content: updatedHtml })
      .eq("id", id)
      .eq("user_id", session.userId);

    if (updateErr) {
      return NextResponse.json({ error: `Failed to save edit: ${updateErr.message}` }, { status: 500 });
    }

    await deductCredits(session.userId, WEBSITE_AI_EDIT_CREDITS, {
      reason: "website_ai_edit",
      refId: id,
      metadata: { instruction: instruction.trim().slice(0, 500) },
    });

    return NextResponse.json({ siteId: id, creditsCharged: WEBSITE_AI_EDIT_CREDITS });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Edit failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
