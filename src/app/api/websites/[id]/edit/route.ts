import { getAuthSession } from "@/lib/session";
import { getUserAIConfig } from "@/lib/ai";
import { ANTHROPIC_CHAT_MODEL, OPENAI_CHAT_MODEL } from "@/lib/models";
import { getBalance, deductCredits, WEBSITE_AI_EDIT_CREDITS } from "@/lib/credits";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureFormHandler, ensureCounterFallback, stripPoweredByBadge } from "@/lib/websiteForms";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// Patches are tiny — a few KB at most — so 90s is plenty even on a cold start.
export const maxDuration = 120;
export const runtime = "nodejs";

function sse(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  );
}

type Replacement = {
  find: string;
  replace: string;
  // When true, every occurrence of `find` is replaced. Required for class-name
  // swaps like "bg-blue-600" → "bg-emerald-600". Defaults to false.
  replaceAll?: boolean;
};

type EditPlan = {
  summary: string;
  replacements: Replacement[];
};

const PATCH_TOOL = {
  name: "apply_edits",
  description:
    "Apply a set of find/replace edits to the existing HTML. Use this for any visual change to the site (text, color, layout, copy, sections). Each edit either targets a single unique substring or every occurrence (use replaceAll for repeated tokens like Tailwind class names).",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description: "One short sentence describing what you changed.",
      },
      replacements: {
        type: "array",
        description:
          "Ordered list of find/replace edits. Empty list means no change is needed.",
        items: {
          type: "object",
          properties: {
            find: {
              type: "string",
              description:
                "Exact substring from the HTML. Include enough surrounding context (10-30 chars on each side) so the substring appears EXACTLY ONCE in the document, unless replaceAll is true.",
            },
            replace: {
              type: "string",
              description:
                "Replacement text. Use empty string to delete the matched substring.",
            },
            replaceAll: {
              type: "boolean",
              description:
                "When true, every occurrence of `find` is replaced. Use for class-name swaps (e.g. 'bg-blue-600' → 'bg-emerald-600') or repeated tokens. When false (default), `find` MUST match exactly once in the document.",
            },
          },
          required: ["find", "replace"],
        },
      },
    },
    required: ["summary", "replacements"],
  },
};


type AppliedDiff = { find: string; replace: string; all: boolean };

function applyReplacements(
  html: string,
  replacements: Replacement[],
): {
  html: string;
  applied: number;
  failed: number;
  failures: string[];
  diffs: AppliedDiff[];
} {
  let result = html;
  let applied = 0;
  let failed = 0;
  const failures: string[] = [];
  const diffs: AppliedDiff[] = [];

  for (const r of replacements) {
    if (!r || typeof r.find !== "string" || !r.find) {
      failed++;
      continue;
    }
    const replace = typeof r.replace === "string" ? r.replace : "";

    if (r.replaceAll) {
      if (!result.includes(r.find)) {
        failed++;
        failures.push(`not found: ${truncate(r.find, 60)}`);
        continue;
      }
      result = result.split(r.find).join(replace);
      applied++;
      diffs.push({ find: r.find, replace, all: true });
    } else {
      const first = result.indexOf(r.find);
      if (first === -1) {
        failed++;
        failures.push(`not found: ${truncate(r.find, 60)}`);
        continue;
      }
      const last = result.lastIndexOf(r.find);
      if (first !== last) {
        failed++;
        failures.push(`not unique: ${truncate(r.find, 60)}`);
        continue;
      }
      result = result.slice(0, first) + replace + result.slice(first + r.find.length);
      applied++;
      diffs.push({ find: r.find, replace, all: false });
    }
  }

  return { html: result, applied, failed, failures, diffs };
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + "…";
}

// Recognize chat instructions that are really about hooking up a domain. We
// match a domain action verb near the word "domain" / "DNS" / "URL", or a
// "use/point/host on <hostname>" phrase. Tuned to avoid catching legitimate
// content edits like "change google.com link to apple.com".
const DOMAIN_KEYWORD_RE =
  /\b(domain|dns|nameserver|hostname|url)\b[^.!?]{0,40}\b(connect|attach|buy|register|purchase|change|update|set|setup|swap|switch|point|use|add|host|publish|live|go\s*live)\b|\b(connect|attach|buy|register|purchase|set\s*up|setup|change|update|point|use|add|host|publish|swap|switch|make)\b[^.!?]{0,40}\b(domain|dns|nameserver|hostname|url)\b/i;
const DOMAIN_VERB_PLUS_HOST_RE =
  /\b(connect|attach|buy|register|purchase|host\s*on|publish\s*on|point\s*to|use|set\s*up|setup|change\s*to|update\s*to|swap\s*to|switch\s*to|go\s*live\s*on)\b[^.!?]{0,30}\b[a-z0-9][a-z0-9-]*\.(com|net|org|co|io|biz|app|xyz|us|info|store|shop|site|online|me)\b/i;

function looksLikeDomainOp(text: string): boolean {
  return DOMAIN_KEYWORD_RE.test(text) || DOMAIN_VERB_PLUS_HOST_RE.test(text);
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return new Response(
      JSON.stringify({ error: "Not authenticated" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
  const userId = session.userId;

  const { id } = await context.params;
  const { instruction } = (await req.json().catch(() => ({}))) as { instruction?: string };

  if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
    return new Response(
      JSON.stringify({ error: "Instruction is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  const instructionText = instruction.trim();

  // Domain operations live in the "Connect domain" modal, not in chat. If the
  // user types something that looks like a domain request, intercept it before
  // the AI sees it — otherwise it'll dutifully run a find/replace on every
  // hostname in the meta tags and links, which is exactly what we don't want.
  if (looksLikeDomainOp(instructionText)) {
    return new Response(
      JSON.stringify({
        kind: "domain_redirect",
        message: "Domains live in the Connect domain button (top right) — opening it now. You can buy a new domain there or connect one you already own.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const balance = await getBalance(userId);
  if (balance < WEBSITE_AI_EDIT_CREDITS) {
    return new Response(
      JSON.stringify({
        error: "Insufficient credits",
        required: WEBSITE_AI_EDIT_CREDITS,
        balance,
      }),
      { status: 402, headers: { "Content-Type": "application/json" } },
    );
  }

  const { data: site, error: siteErr } = await supabaseAdmin
    .from("generated_websites")
    .select("id, user_id, html_content, tier")
    .eq("id", id)
    .maybeSingle();

  if (siteErr || !site) {
    return new Response(
      JSON.stringify({ error: "Website not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }
  if (site.user_id !== userId) {
    return new Response(
      JSON.stringify({ error: "Not authorized" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const aiResult = await getUserAIConfig(userId);
  if (!aiResult.ok) {
    return new Response(
      JSON.stringify({ error: aiResult.error }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const systemPrompt = `You are a precise HTML editor. The user wants to change an existing single-file landing page. Your job: produce the MINIMAL set of find/replace edits that achieve the change, and call the apply_edits tool with them.

KEY RULES:
- Output the smallest possible edits. Do NOT rewrite the whole page.
- Always target what is **visibly displayed on the page**, not just attributes/scripts. If a stat shows "0" and the user wants it to show "1,136", you MUST change the visible text node "0" inside the relevant <span>/<div>. If a JavaScript counter will overwrite that text, ALSO change the JS target value or remove the counter logic so the static value sticks.
- KNOWN PATTERN: stat counters use \`<span data-count="N">0</span>\` where N is the target number and "0" is the initial display before JS animates. To change a stat, you must update BOTH the data-count attribute AND the visible "0" text — emit two replacements (or one replacement that includes the whole element).
- Each edit either:
  • Targets ONE unique substring (default) — include 10-30 chars of surrounding context so it's unique in the document.
  • Targets ALL occurrences with replaceAll: true — use this for Tailwind class swaps, color hex values, or any repeated token.
- For palette changes, emit one replaceAll edit per old-class → new-class pair (e.g. {find: "bg-blue-600", replace: "bg-emerald-600", replaceAll: true}). Cover bg-, text-, from-, to-, via-, border-, ring-, hover:bg-, hover:text-, etc. Also swap any inline color hex codes.
- For text changes (headlines, button labels, stats, copy), emit a single targeted replacement that includes the surrounding HTML tags to make it unique.
- For "fix the X section" style requests (e.g. replace "0" stats with real numbers), emit one targeted replacement per number/word, including the parent tag in the find-string so each is unique.
- Whitespace and quotes in the find string MUST match the source EXACTLY.
- Do NOT touch: <form data-nn-form>, <input name="company_website">, name="name"|"email"|"phone"|"message", <p data-nn-form-status>, <script id="nn-form-handler">.
- THIS IS STATIC HTML, not JSX/templates. NEVER emit JSX expressions (\`{foo}\`, \`{arr.map(...)}\`), template-literal interpolation (backticks with \`\${...}\`), Array.map/join calls, or mustache/handlebars (\`{{foo}}\`) inside markup. They will render as literal text on the page. If a list needs items, write each item out as plain HTML — repeat the markup by hand. JS is only allowed inside <script> tags, and even there don't inject content via \`innerHTML = \\\`\${...}\\\`\`.
- If you encounter such a leaked expression in the existing HTML (e.g. \`{['Plano','Allen'].map(c => \\\`\${c}\\\`).join('')}\` sitting next to real chips), DELETE it via a targeted replacement — do not try to "fix" it into working JS.
${
  site.tier === "whitelabel"
    ? `- This is a WHITE-LABEL site. Do NOT add a "Powered by NextNote" badge. If asked to remove one, do so.`
    : `- Do NOT remove the "Powered by NextNote" badge if it is present.`
}
- If the change is fundamentally impossible without restructuring (e.g. "rebuild the whole site"), still call the tool with an empty replacements array and a summary explaining why.
- Use replaceAll judiciously — if a string only needs to change in ONE place, do NOT use replaceAll.`;

  const userPrompt = `Requested change:
"""
${instructionText}
"""

Current HTML:
"""
${site.html_content}
"""`;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(sse(event, data));
        } catch {
          // controller closed
        }
      };

      try {
        send("step", { phase: "reading", label: "Reading your site…" });
        await new Promise((r) => setTimeout(r, 50));

        send("step", { phase: "planning", label: "Figuring out what you want…" });

        let plan: EditPlan | null = null;

        if (aiResult.config.provider === "anthropic") {
          const client = new Anthropic({ apiKey: aiResult.config.apiKey });
          const response = await client.messages.create({
            model: ANTHROPIC_CHAT_MODEL,
            max_tokens: 8000,
            system: systemPrompt,
            tools: [PATCH_TOOL],
            tool_choice: { type: "tool", name: PATCH_TOOL.name },
            messages: [{ role: "user", content: userPrompt }],
          });

          const toolUse = response.content.find((b) => b.type === "tool_use");
          if (!toolUse || toolUse.type !== "tool_use" || toolUse.name !== PATCH_TOOL.name) {
            send("error", { error: "AI did not return an edit plan. Try rephrasing." });
            controller.close();
            return;
          }
          plan = toolUse.input as EditPlan;
        } else {
          // OpenAI tool use
          const client = new OpenAI({ apiKey: aiResult.config.apiKey });
          const completion = await client.chat.completions.create({
            model: OPENAI_CHAT_MODEL,
            max_tokens: 8000,
            tools: [
              {
                type: "function",
                function: {
                  name: PATCH_TOOL.name,
                  description: PATCH_TOOL.description,
                  parameters: PATCH_TOOL.input_schema,
                },
              },
            ],
            tool_choice: { type: "function", function: { name: PATCH_TOOL.name } },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });
          const call = completion.choices[0]?.message?.tool_calls?.[0];
          if (!call || call.type !== "function" || call.function.name !== PATCH_TOOL.name) {
            send("error", { error: "AI did not return an edit plan. Try rephrasing." });
            controller.close();
            return;
          }
          try {
            plan = JSON.parse(call.function.arguments) as EditPlan;
          } catch {
            send("error", { error: "AI returned an invalid plan. Try rephrasing." });
            controller.close();
            return;
          }
        }

        if (!plan || !Array.isArray(plan.replacements)) {
          send("error", { error: "AI did not return a valid edit plan." });
          controller.close();
          return;
        }

        if (plan.replacements.length === 0) {
          send("error", {
            error: plan.summary
              ? `No changes applied: ${plan.summary}`
              : "AI couldn't figure out how to apply that change. Try rephrasing.",
          });
          controller.close();
          return;
        }

        send("step", {
          phase: "applying",
          label: `Applying ${plan.replacements.length} change${plan.replacements.length === 1 ? "" : "s"}…`,
        });

        const { html: patched, applied, failed, failures, diffs } = applyReplacements(
          site.html_content,
          plan.replacements,
        );

        if (applied === 0) {
          send("error", {
            error: `No edits could be applied. The AI's find-strings didn't match the page (${failures.slice(0, 2).join("; ")}). Try rephrasing.`,
          });
          controller.close();
          return;
        }

        send("progress", {
          applied,
          failed,
          total: plan.replacements.length,
        });

        let updatedHtml = ensureFormHandler(patched, id);
        updatedHtml = ensureCounterFallback(updatedHtml);
        if (site.tier === "whitelabel") {
          updatedHtml = stripPoweredByBadge(updatedHtml);
        }

        send("step", { phase: "saving", label: "Saving to your site…" });

        const { error: updateErr } = await supabaseAdmin
          .from("generated_websites")
          .update({ html_content: updatedHtml })
          .eq("id", id)
          .eq("user_id", userId);

        if (updateErr) {
          send("error", { error: `Failed to save edit: ${updateErr.message}` });
          controller.close();
          return;
        }

        await deductCredits(userId, WEBSITE_AI_EDIT_CREDITS, {
          reason: "website_ai_edit",
          refId: id,
          metadata: { instruction: instructionText.slice(0, 500) },
        });

        send("done", {
          siteId: id,
          creditsCharged: WEBSITE_AI_EDIT_CREDITS,
          summary: plan.summary,
          applied,
          failed,
          // Truncate diff strings so the client can show what changed without
          // bloating the SSE payload.
          diffs: diffs.slice(0, 8).map((d) => ({
            find: truncate(d.find, 80),
            replace: truncate(d.replace, 80),
            all: d.all,
          })),
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Edit failed";
        send("error", { error: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
