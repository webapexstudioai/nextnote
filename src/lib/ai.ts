import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";

const ENCRYPTION_KEY =
  process.env.API_KEY_ENCRYPTION_SECRET ||
  process.env.SESSION_SECRET ||
  "nextnote_default_encryption_key_32ch";

function decrypt(encrypted: string): string {
  const [ivHex, encHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export type AIProvider = "anthropic" | "openai";

interface UserAIConfig {
  provider: AIProvider;
  apiKey: string;
}

/**
 * Load the logged-in user's AI settings from Supabase.
 * Returns provider + decrypted key, or an error message.
 */
export async function getUserAIConfig(
  userId: string
): Promise<{ ok: true; config: UserAIConfig } | { ok: false; error: string }> {
  const { data: settings } = await supabaseAdmin
    .from("user_settings")
    .select("preferred_provider, anthropic_api_key_encrypted, openai_api_key_encrypted")
    .eq("user_id", userId)
    .single();

  const provider: AIProvider = settings?.preferred_provider === "openai" ? "openai" : "anthropic";

  // Try to get the key for the preferred provider
  const encryptedKey =
    provider === "anthropic"
      ? settings?.anthropic_api_key_encrypted
      : settings?.openai_api_key_encrypted;

  if (encryptedKey) {
    try {
      const apiKey = decrypt(encryptedKey);
      return { ok: true, config: { provider, apiKey } };
    } catch {
      return {
        ok: false,
        error: `Your saved ${provider === "anthropic" ? "Anthropic" : "OpenAI"} API key could not be decrypted. Please update it in Settings.`,
      };
    }
  }

  // Fallback: try the env key for Anthropic only
  if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "your-api-key-here") {
    return { ok: true, config: { provider: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY } };
  }

  return {
    ok: false,
    error: `No ${provider === "anthropic" ? "Anthropic" : "OpenAI"} API key found. Add your key in Settings → AI API Keys.`,
  };
}

/**
 * Send a message to the user's configured AI provider and return the text response.
 */
export async function aiChat(
  config: UserAIConfig,
  systemPrompt: string | undefined,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  if (config.provider === "anthropic") {
    const client = new Anthropic({ apiKey: config.apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: "user", content: userPrompt }],
    });
    return message.content[0].type === "text" ? message.content[0].text : "";
  }

  // OpenAI
  const client = new OpenAI({ apiKey: config.apiKey });
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: userPrompt });

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: maxTokens,
    messages,
  });
  return completion.choices[0]?.message?.content || "";
}
