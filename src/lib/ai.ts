import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import {
  ANTHROPIC_CHAT_MODEL,
  ANTHROPIC_CHEAP_MODEL,
  ANTHROPIC_PREMIUM_MODEL,
  OPENAI_CHAT_MODEL,
  OPENAI_CHEAP_MODEL,
  OPENAI_PREMIUM_MODEL,
} from "@/lib/models";

export type AIProvider = "anthropic" | "openai";

interface UserAIConfig {
  provider: AIProvider;
  apiKey: string;
}

export async function getUserAIConfig(
  _userId: string
): Promise<{ ok: true; config: UserAIConfig } | { ok: false; error: string }> {
  const platformAnthropicKey = process.env.ANTHROPIC_API_KEY;
  const platformOpenaiKey = process.env.OPENAI_API_KEY;

  if (platformAnthropicKey) {
    return { ok: true, config: { provider: "anthropic", apiKey: platformAnthropicKey } };
  }
  if (platformOpenaiKey) {
    return { ok: true, config: { provider: "openai", apiKey: platformOpenaiKey } };
  }

  return {
    ok: false,
    error: "AI service is temporarily unavailable. Please try again later.",
  };
}

/**
 * Send a message to the user's configured AI provider and return the text response.
 */
export async function aiChat(
  config: UserAIConfig,
  systemPrompt: string | undefined,
  userPrompt: string,
  maxTokens: number,
  quality: "premium" | "high" | "fast" = "high"
): Promise<string> {
  const result = await aiChatDetailed(config, systemPrompt, userPrompt, maxTokens, quality);
  return result.text;
}

/**
 * Same as aiChat but also returns Anthropic's stop_reason so callers can
 * distinguish a clean stop ("end_turn") from hitting the token cap
 * ("max_tokens"). For OpenAI we map finish_reason similarly.
 */
export async function aiChatDetailed(
  config: UserAIConfig,
  systemPrompt: string | undefined,
  userPrompt: string,
  maxTokens: number,
  quality: "premium" | "high" | "fast" = "high"
): Promise<{ text: string; stopReason: string | null }> {
  if (config.provider === "anthropic") {
    const client = new Anthropic({ apiKey: config.apiKey });
    // Stream for any request that could plausibly exceed 10 minutes — the SDK
    // otherwise refuses non-streaming requests at high max_tokens.
    const stream = client.messages.stream({
      model:
        quality === "premium"
          ? ANTHROPIC_PREMIUM_MODEL
          : quality === "fast"
            ? ANTHROPIC_CHEAP_MODEL
            : ANTHROPIC_CHAT_MODEL,
      max_tokens: maxTokens,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: "user", content: userPrompt }],
    });
    const finalMessage = await stream.finalMessage();
    const firstBlock = finalMessage.content[0];
    const text = firstBlock && firstBlock.type === "text" ? firstBlock.text : "";
    return { text, stopReason: finalMessage.stop_reason ?? null };
  }

  const client = new OpenAI({ apiKey: config.apiKey });
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: userPrompt });

  const completion = await client.chat.completions.create({
    model:
      quality === "premium"
        ? OPENAI_PREMIUM_MODEL
        : quality === "fast"
          ? OPENAI_CHEAP_MODEL
          : OPENAI_CHAT_MODEL,
    max_tokens: maxTokens,
    messages,
  });
  return {
    text: completion.choices[0]?.message?.content || "",
    stopReason: completion.choices[0]?.finish_reason ?? null,
  };
}
